import { createLogger } from '../utils/logger.util';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  FallbackModel,
  Prediction,
  ProviderPreferences,
  ReasoningEffort,
} from '../utils/openrouter.util';

const logger = createLogger('OpenRouter');

// =============================================================================
// Get OpenRouter config from environment directly (lazy loading)
// =============================================================================
function getOpenRouterConfig() {
  const freeModelsRaw = process.env.OPENROUTER_FREE_MODELS || '';
  const freeModels = freeModelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    paidModel: process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.5:free',
    freeModels,
  };
}

/**
 * Build default fallback chain: free models first → paid model last.
 */
function buildDefaultFallbackChain(): FallbackModel[] {
  const config = getOpenRouterConfig();
  const chain: FallbackModel[] = [];

  // Free models first
  for (const model of config.freeModels) {
    chain.push({ model });
  }

  // Paid model as final fallback
  chain.push({ model: config.paidModel });

  return chain;
}

// =============================================================================
// OpenRouter Service Singleton Class
// =============================================================================
class OpenRouterService {
  private static instance: OpenRouterService | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  private validateConfig(): void {
    const config = getOpenRouterConfig();
    if (!config.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
  }

  // ===========================================================================
  // Core chat completion
  // By default: tries free models first, falls back to paid model.
  // ===========================================================================
  public async chatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    this.validateConfig();
    const config = getOpenRouterConfig();

    // Determine if caller provided explicit fallback models
    const hasExplicitModels = options.models && options.models.length > 0;
    const hasExplicitModel = !!options.model;

    // Build fallback chain: caller's models > default free→paid chain
    const fallbackChain: FallbackModel[] = hasExplicitModels
      ? options.models!
      : buildDefaultFallbackChain();

    // Primary model: caller's model > first free model > paid model
    const primaryModel = hasExplicitModel
      ? options.model!
      : config.freeModels[0] || config.paidModel;

    // Build request body
    const body: Record<string, unknown> = {
      model: primaryModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      models: fallbackChain,
      route: options.route || 'fallback',
      allow_fallbacks: options.allow_fallbacks ?? true,
    };

    // Latency & Performance
    if (options.prediction) {
      body.prediction = options.prediction;
    }
    if (options.provider) {
      body.provider = options.provider;
    }

    // Reasoning Tokens
    if (options.reasoning_effort) {
      body.reasoning = { effort: options.reasoning_effort };
    }

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `OpenRouter API error (${response.status}): ${errorBody}`
        );
      }

      const result = (await response.json()) as ChatCompletionResponse;

      if (!this.isInitialized) {
        this.isInitialized = true;
        logger.info('OpenRouter client initialized', {
          freeModels: config.freeModels,
          paidModel: config.paidModel,
        });
      }

      // Log which model actually responded (could be free or paid fallback)
      const usedModel = result.model || primaryModel;
      const isFreeModel = config.freeModels.some((m) =>
        usedModel.startsWith(m.split(':')[0])
      );

      logger.debug('Chat completion successful', {
        model: usedModel,
        tier: isFreeModel ? 'free' : 'paid',
        tokens: result.usage?.total_tokens,
        cachedTokens: result.usage?.prompt_tokens_details?.cached_tokens,
        reasoningTokens:
          result.usage?.completion_tokens_details?.reasoning_tokens,
      });

      return result;
    } catch (error) {
      logger.error('Chat completion failed', {
        error: error instanceof Error ? error.message : String(error),
        model: primaryModel,
      });
      throw error;
    }
  }

  // ===========================================================================
  // Convenience: Chat with explicit fallback models (override default chain)
  // ===========================================================================
  public async chatWithFallback(
    messages: ChatMessage[],
    fallbacks: FallbackModel[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      provider?: ProviderPreferences;
      allow_fallbacks?: boolean;
    }
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      provider: options?.provider,
      models: fallbacks,
      route: 'fallback',
      allow_fallbacks: options?.allow_fallbacks ?? true,
    });
  }

  // ===========================================================================
  // Convenience: Chat with provider sorted by latency
  // ===========================================================================
  public async chatLowLatency(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      maxLatencySeconds?: number;
      preferredMinThroughput?: number;
      prediction?: Prediction;
    }
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      prediction: options?.prediction,
      provider: {
        sort: 'latency',
        ...(options?.maxLatencySeconds
          ? { preferred_max_latency: options.maxLatencySeconds }
          : {}),
        ...(options?.preferredMinThroughput
          ? { preferred_min_throughput: options.preferredMinThroughput }
          : {}),
      },
    });
  }

  // ===========================================================================
  // Convenience: Chat with prompt caching
  // ===========================================================================
  public async chatWithCaching(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      provider?: ProviderPreferences;
    }
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      provider: options?.provider,
    });
  }

  // ===========================================================================
  // Convenience: Chat with reasoning effort
  // ===========================================================================
  public async chatWithReasoning(
    messages: ChatMessage[],
    effort: ReasoningEffort,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      provider?: ProviderPreferences;
    }
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      provider: options?.provider,
      reasoning_effort: effort,
    });
  }

  // ===========================================================================
  // Health check
  // ===========================================================================
  public async isHealthy(): Promise<boolean> {
    try {
      this.validateConfig();
      const config = getOpenRouterConfig();

      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  public static resetInstance(): void {
    OpenRouterService.instance = null;
  }
}

// =============================================================================
// Export singleton instance and convenience function
// =============================================================================
export const openRouterService = OpenRouterService.getInstance();

export function getOpenRouter(): OpenRouterService {
  return openRouterService;
}

export default openRouterService;
