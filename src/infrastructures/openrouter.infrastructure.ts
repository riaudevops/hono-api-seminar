import { createLogger } from '../utils/logger.util';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  Prediction,
  ProviderPreferences,
  ReasoningEffort,
} from '../utils/openrouter.util';

const logger = createLogger('OpenRouter');

// =============================================================================
// Get OpenRouter config from environment directly (lazy loading)
// =============================================================================
function getOpenRouterConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl:
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  };
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

  public async initialize(): Promise<void> {
    this.validateConfig();
    const config = getOpenRouterConfig();
    const baseUrl = config.baseUrl.replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `OpenRouter initialization failed (${response.status}): ${responseBody}`
      );
    }

    this.isInitialized = true;
    logger.info('OpenRouter client initialized', {
      baseUrl,
      model: config.model,
    });
  }

  // ===========================================================================
  // Core chat completion
  // ===========================================================================
  public async chatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    this.validateConfig();
    const config = getOpenRouterConfig();

    const model = options.model || config.model;

    // Build request body
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };

    // Only include models array if caller provides explicit fallbacks
    if (options.models && options.models.length > 0) {
      body.models = options.models.slice(0, 3);
      body.route = options.route || 'fallback';
      body.allow_fallbacks = options.allow_fallbacks ?? true;
    }

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
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error (${response.status}): ${responseBody}`
        );
      }

      let result: ChatCompletionResponse;
      try {
        result = JSON.parse(responseBody) as ChatCompletionResponse;
      } catch {
        throw new Error(
          `OpenRouter API returned invalid JSON (${response.status}): ${responseBody.slice(0, 500)}`
        );
      }

      if (!Array.isArray(result.choices) || result.choices.length === 0) {
        throw new Error(
          `OpenRouter API returned response without choices: ${responseBody.slice(0, 500)}`
        );
      }

      const content = result.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error(
          `OpenRouter API returned empty content: ${responseBody.slice(0, 500)}`
        );
      }

      if (!this.isInitialized) {
        this.isInitialized = true;
        logger.info('OpenRouter client initialized', {
          baseUrl,
          model: config.model,
        });
      }

      const usedModel = result.model || model;

      logger.debug('Chat completion successful', {
        model: usedModel,
        tokens: result.usage?.total_tokens,
      });

      return result;
    } catch (error) {
      logger.error('Chat completion failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });
      throw error;
    }
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
      const baseUrl = config.baseUrl.replace(/\/$/, '');

      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Accept: 'application/json',
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
