import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';
import {
  rateLimiter,
  MemoryStore,
  type Store,
  type ClientRateLimitInfo,
  type HonoConfigType,
} from 'hono-rate-limiter';
import { config } from '../core/config';
import redisService from '../infrastructures/redis.infrastructure';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('RateLimit');

/**
 * Custom hono-rate-limiter Store backed by the project's existing
 * ioredis singleton. Falls back to in-memory counting when Redis is
 * unavailable so the app keeps serving (graceful degradation).
 *
 * Algorithm: fixed window. INCR + EXPIRE on first hit per window.
 * `windowMs` is provided by hono-rate-limiter via init().
 */
class IoredisRateLimitStore implements Store {
  public prefix: string;
  public windowMs = 60_000;
  private fallback = new MemoryStore();

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  public init(options: HonoConfigType): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  public async increment(key: string): Promise<ClientRateLimitInfo> {
    const client = redisService.getClient();
    if (!client || !redisService.isHealthy()) {
      return this.fallback.increment(key);
    }

    try {
      const namespacedKey = this.prefixKey(key);
      const ttlSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));

      const totalHits = await client.incr(namespacedKey);
      let pttl = await client.pttl(namespacedKey);

      // First hit in this window — set expiry.
      if (pttl < 0) {
        await client.expire(namespacedKey, ttlSeconds);
        pttl = ttlSeconds * 1000;
      }

      const resetTime = new Date(Date.now() + pttl);
      return { totalHits, resetTime };
    } catch (error) {
      logger.warn('Rate-limit increment fell back to memory', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback.increment(key);
    }
  }

  public async decrement(key: string): Promise<void> {
    const client = redisService.getClient();
    if (!client || !redisService.isHealthy()) {
      this.fallback.decrement(key);
      return;
    }

    try {
      await client.decr(this.prefixKey(key));
    } catch (error) {
      logger.warn('Rate-limit decrement failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async resetKey(key: string): Promise<void> {
    const client = redisService.getClient();
    if (!client || !redisService.isHealthy()) {
      this.fallback.resetKey(key);
      return;
    }

    try {
      await client.del(this.prefixKey(key));
    } catch (error) {
      logger.warn('Rate-limit resetKey failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// =============================================================================
// Key generator: per authenticated user when available, else per socket IP.
// IP comes from Bun's server.requestIP() — header-based IPs (X-Forwarded-For,
// X-Real-IP, CF-Connecting-IP) are intentionally ignored to prevent spoofing
// since this app sits behind no reverse proxy.
// =============================================================================
function extractIp(c: Context): string {
  try {
    const info = getConnInfo(c);
    return info.remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function buildKeyGenerator(scope: string) {
  return (c: Context) => {
    const user = c.get('user') as Record<string, unknown> | undefined;
    const userId =
      (user?.email as string | undefined) ??
      (user?.id as string | undefined) ??
      (user?.sub as string | undefined);

    if (userId) return `${scope}:user:${userId}`;

    return `${scope}:ip:${extractIp(c)}`;
  };
}

// =============================================================================
// Standard 429 response shape ({ response, message, data }).
// =============================================================================
function buildHandler(scope: string) {
  return (
    c: Context,
    _next: unknown,
    options: { statusCode: number; message: unknown }
  ) => {
    const info = c.get('rateLimit') as
      | { limit: number; remaining: number; resetTime?: Date }
      | undefined;
    const retryAfterSeconds = info?.resetTime
      ? Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / 1000))
      : undefined;

    if (retryAfterSeconds) {
      c.header('Retry-After', String(retryAfterSeconds));
    }

    logger.warn('Rate limit exceeded', {
      scope,
      path: c.req.path,
      method: c.req.method,
      limit: info?.limit,
      retryAfterSeconds,
    });

    c.status(options.statusCode as 429);
    return c.json({
      response: false,
      message:
        typeof options.message === 'string'
          ? options.message
          : 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
      data: {
        scope,
        retryAfterSeconds,
        resetTime: info?.resetTime,
      },
    });
  };
}

// =============================================================================
// Tier factory.
// =============================================================================
type Tier = 'global' | 'read' | 'write' | 'authStrict' | 'aiExpensive';

function makeLimiter(scope: Tier, message: string) {
  const tier = config.rateLimit.tiers[scope];

  // AI generate + stream share one counter so users can't trick the limit by
  // alternating between endpoints. Other tiers stay scoped per tier.
  const storePrefix =
    scope === 'aiExpensive' ? 'rl:ai-generate:' : `rl:${scope}:`;

  return rateLimiter({
    windowMs: tier.windowMs,
    limit: tier.limit,
    standardHeaders: 'draft-7',
    keyGenerator: buildKeyGenerator(scope),
    store: new IoredisRateLimitStore(storePrefix),
    skipFailedRequests: scope === 'authStrict' ? false : true,
    skip: (c) => {
      if (!config.rateLimit.enabled) return true;
      const path = c.req.path;
      // Always allow health/docs/openapi to bypass.
      return (
        path === '/' ||
        path === '/api' ||
        path === '/api/' ||
        path === '/api/health' ||
        path === '/openapi.json' ||
        path === '/docs' ||
        path.startsWith('/docs/')
      );
    },
    message,
    handler: buildHandler(scope),
  });
}

export const RateLimitMiddleware = {
  /** Safety-net for the entire `/api/*` surface. IP-based fallback. */
  global: () =>
    makeLimiter(
      'global',
      'Terlalu banyak permintaan dari sumber ini. Silakan coba lagi nanti.'
    ),

  /** Standard read endpoints (lists, details). */
  read: () =>
    makeLimiter(
      'read',
      'Terlalu banyak permintaan baca. Silakan tunggu sebentar.'
    ),

  /** Mutating endpoints (create/update/delete). */
  write: () =>
    makeLimiter(
      'write',
      'Terlalu banyak permintaan ubah data. Silakan tunggu sebentar.'
    ),

  /** Login / verifikasi / OTP-style endpoints. */
  authStrict: () =>
    makeLimiter(
      'authStrict',
      'Terlalu banyak percobaan. Silakan tunggu beberapa menit.'
    ),

  /** Expensive AI endpoints (jadwal-draft generate, dll). */
  aiExpensive: () =>
    makeLimiter(
      'aiExpensive',
      'Permintaan generate AI mencapai batas. Silakan tunggu beberapa menit.'
    ),
};

export default RateLimitMiddleware;
