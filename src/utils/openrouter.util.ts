// =============================================================================
// OpenRouter Types & Utility Functions
// =============================================================================

// --- Chat Message Types ---

export interface TextContent {
  type: "text";
  text: string;
}

export interface CacheControl {
  type: "ephemeral";
}

export interface CacheableTextContent {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export type MessageContent = string | (TextContent | CacheableTextContent)[];

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
}

// --- Provider Routing ---

export type ProviderSort = "price" | "throughput" | "latency";

export interface ProviderPreferences {
  /** Sort providers by criteria */
  sort?: ProviderSort;
  /** Only use these providers (string or array) */
  only?: string | string[];
  /** Ignore these providers */
  ignore?: string | string[];
  /** Provider ordering */
  order?: string[];
  /** Allow fallbacks to other providers */
  allow_fallbacks?: boolean;
  /** Max latency in seconds */
  preferred_max_latency?: number;
  /** Min throughput in tokens/sec */
  preferred_min_throughput?: number;
  /** Allowed quantization levels */
  quantizations?: string[];
  /** Max price per million tokens */
  max_price?: number;
  /** Require parameter support */
  require_parameters?: boolean;
  /** Data collection policy */
  data_collection?: "allow" | "deny";
}

// --- Fallback Model ---

export interface FallbackModel {
  /** Model ID (e.g. "openai/gpt-4o-mini") */
  model: string;
  /** Provider override for this fallback */
  provider?: ProviderPreferences;
}

// --- Prediction (Predicted Outputs) ---

export interface Prediction {
  type: "content";
  content: string;
}

// --- Reasoning ---

export type ReasoningEffort = "low" | "medium" | "high";

// --- Chat Completion Options ---

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;

  // Latency & Performance
  /** Predicted output to reduce latency */
  prediction?: Prediction;
  /** Provider routing preferences */
  provider?: ProviderPreferences;

  // Uptime Optimization
  /** Fallback models array — enables route: 'fallback' */
  models?: FallbackModel[];
  /** Routing strategy: 'fallback' for uptime, 'leaderboard' for quality */
  route?: "fallback" | "leaderboard";
  /** Allow fallbacks to other providers when primary fails */
  allow_fallbacks?: boolean;

  // Reasoning Tokens
  /** Reasoning effort level (for reasoning models) */
  reasoning_effort?: ReasoningEffort;
}

// --- Response Types ---

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
  model?: string;
}

// --- Convenience Helpers ---

/** Create a text message */
export function textMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return { role, content };
}

/** Create a multipart message with cache breakpoints */
export function cachedMessage(
  role: ChatMessage["role"],
  parts: { text: string; cache?: boolean }[],
): ChatMessage {
  return {
    role,
    content: parts.map((p) => ({
      type: "text" as const,
      text: p.text,
      ...(p.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
    })),
  };
}
