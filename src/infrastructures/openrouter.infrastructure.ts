import { createLogger } from '../utils/logger.util';
import { APIError } from '../utils/api-error.util';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  Prediction,
  ProviderPreferences,
  ReasoningEffort,
} from '../utils/openrouter.util';

const logger = createLogger('OpenRouter');
const DEFAULT_CHAT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524]);

class OpenRouterUpstreamError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'OpenRouterUpstreamError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError';
}

function isRetryableError(error: unknown) {
  if (error instanceof OpenRouterUpstreamError) {
    return (
      error.statusCode === undefined || RETRYABLE_STATUS_CODES.has(error.statusCode)
    );
  }

  return isAbortError(error) || isTimeoutError(error);
}

function mapOpenRouterError(error: unknown): APIError {
  if (error instanceof APIError) return error;

  if (error instanceof OpenRouterUpstreamError) {
    if (error.statusCode === 524) {
      return new APIError(
        'Layanan AI timeout dari upstream. Silakan coba lagi beberapa saat lagi.',
        503
      );
    }

    if (error.statusCode && RETRYABLE_STATUS_CODES.has(error.statusCode)) {
      return new APIError(
        'Layanan AI sedang sibuk atau timeout. Silakan coba lagi beberapa saat lagi.',
        503
      );
    }

    return new APIError(error.message, error.statusCode || 500);
  }

  if (isAbortError(error) || isTimeoutError(error)) {
    return new APIError(
      'Permintaan ke layanan AI melewati batas waktu. Silakan coba lagi.',
      503
    );
  }

  return new APIError(
    error instanceof Error ? error.message : 'Gagal menghubungi layanan AI.',
    500
  );
}

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
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await this.requestChatCompletion(options, config, model);
        } catch (error) {
          const shouldRetry = attempt < maxRetries && isRetryableError(error);

          logger.warn('Chat completion attempt failed', {
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            retrying: shouldRetry,
            error: error instanceof Error ? error.message : String(error),
            model,
          });

          if (!shouldRetry) throw error;

          await sleep(Math.min(10_000, 2_000 * 2 ** attempt));
        }
      }
    } catch (error) {
      const mappedError = mapOpenRouterError(error);
      logger.error('Chat completion failed', {
        error: mappedError.message,
        statusCode: mappedError.statusCode,
        model,
      });
      throw mappedError;
    }

    throw new APIError('Gagal menghubungi layanan AI.', 500);
  }

  private async requestChatCompletion(
    options: ChatCompletionOptions,
    config: ReturnType<typeof getOpenRouterConfig>,
    model: string
  ): Promise<ChatCompletionResponse> {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };

    if (options.models && options.models.length > 0) {
      body.models = options.models.slice(0, 3);
      body.route = options.route || 'fallback';
      body.allow_fallbacks = options.allow_fallbacks ?? true;
    }

    if (options.prediction) {
      body.prediction = options.prediction;
    }
    if (options.provider) {
      body.provider = options.provider;
    }

    if (options.reasoning_effort) {
      body.reasoning = { effort: options.reasoning_effort };
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const timeoutMs = options.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new OpenRouterUpstreamError(
        `OpenRouter API error (${response.status}): ${responseBody.slice(0, 500)}`,
        response.status,
        responseBody
      );
    }

    let result: ChatCompletionResponse;
    try {
      result = JSON.parse(responseBody) as ChatCompletionResponse;
    } catch {
      throw new OpenRouterUpstreamError(
        `OpenRouter API returned invalid JSON (${response.status}): ${responseBody.slice(0, 500)}`,
        response.status,
        responseBody
      );
    }

    if (!Array.isArray(result.choices) || result.choices.length === 0) {
      throw new OpenRouterUpstreamError(
        `OpenRouter API returned response without choices: ${responseBody.slice(0, 500)}`,
        response.status,
        responseBody
      );
    }

    const choice = result.choices[0];
    const finishReason = choice?.finish_reason;
    const content = choice?.message?.content;

    if (finishReason === 'length') {
      throw new APIError(
        `AI output terpotong karena batas token. Naikkan maxTokens atau kecilkan chunk size.`,
        422
      );
    }

    if (!content || typeof content !== 'string') {
      throw new OpenRouterUpstreamError(
        `OpenRouter API returned empty content: ${responseBody.slice(0, 500)}`,
        response.status,
        responseBody
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
