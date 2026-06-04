import Redis from 'ioredis';
import { config } from '../core/config';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('Redis');

type RedisClient = Redis;
type RedisConfig = typeof config.redis;

function buildRedisUrl(redisConfig: RedisConfig) {
  if (redisConfig.url) return redisConfig.url;
  if (!redisConfig.host) return undefined;
  return `redis://${redisConfig.host}:${redisConfig.port}`;
}

class RedisService {
  private static instance: RedisService | null = null;
  private client: RedisClient | null = null;
  private isConnected = false;
  private unavailable = false;

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private get redisConfig() {
    return config.redis;
  }

  public isEnabled(): boolean {
    return this.redisConfig.enabled && Boolean(buildRedisUrl(this.redisConfig));
  }

  private prefixKey(key: string) {
    const prefix = this.redisConfig.keyPrefix.replace(/:+$/, '');
    return `${prefix}:${key}`;
  }

  public namespacedKey(key: string) {
    return this.prefixKey(key);
  }

  public getClient(): RedisClient | null {
    if (!this.isEnabled()) return null;
    if (this.client) return this.client;

    const redisConfig = this.redisConfig;
    const url = buildRedisUrl(redisConfig);
    if (!url) return null;

    this.client = new Redis(url, {
      password: redisConfig.password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      retryStrategy(times: number) {
        return Math.min(times * 100, 2_000);
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.unavailable = false;
      logger.info('Redis connected', {
        url: url.replace(/:[^:@/]+@/, ':***@'),
      });
    });

    this.client.on('error', (error: Error) => {
      this.unavailable = true;
      logger.warn('Redis error, falling back to database', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    return this.client;
  }

  public async connect(): Promise<void> {
    const client = this.getClient();
    if (!client || this.isConnected || this.unavailable) return;

    try {
      await client.connect();
    } catch (error) {
      this.unavailable = true;
      logger.warn('Redis connection failed, cache disabled until reconnect', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    } finally {
      this.client = null;
      this.isConnected = false;
      this.unavailable = false;
      logger.info('Redis disconnected');
    }
  }

  private async ensureClient(): Promise<RedisClient | null> {
    const client = this.getClient();
    if (!client) return null;

    if (client.status === 'ready') return client;
    if (this.unavailable && client.status !== 'wait') return null;

    await this.connect();
    return this.isHealthy() ? client : null;
  }

  public async getRawClient(): Promise<RedisClient | null> {
    return this.ensureClient();
  }

  public async getJson<T>(key: string): Promise<T | null> {
    try {
      const client = await this.ensureClient();
      if (!client) return null;

      const namespacedKey = this.prefixKey(key);
      const raw = await client.get(namespacedKey);
      if (!raw) {
        logger.debug('Cache miss', { key });
        return null;
      }

      logger.debug('Cache hit', { key });
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn('Cache get failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async setJson(
    key: string,
    value: unknown,
    ttlSeconds = this.redisConfig.defaultTtlSeconds
  ): Promise<void> {
    try {
      const client = await this.ensureClient();
      if (!client) return;

      const namespacedKey = this.prefixKey(key);
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await client.set(namespacedKey, serialized, 'EX', ttlSeconds);
      } else {
        await client.set(namespacedKey, serialized);
      }
      logger.debug('Cache set', { key, ttlSeconds });
    } catch (error) {
      logger.warn('Cache set failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  public async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      const client = await this.ensureClient();
      if (!client) return;

      await client.del(...keys.map((key) => this.prefixKey(key)));
      logger.debug('Cache deleted', { keys });
    } catch (error) {
      logger.warn('Cache delete failed', {
        keys,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async delByPattern(pattern: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      if (!client) return;

      const namespacedPattern = this.prefixKey(pattern);
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await client.scan(
          cursor,
          'MATCH',
          namespacedPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await client.del(...keys);
      }
      logger.debug('Cache pattern deleted', { pattern, count: keys.length });
    } catch (error) {
      logger.warn('Cache pattern delete failed', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public isHealthy(): boolean {
    return Boolean(this.client && this.client.status === 'ready');
  }

  public static resetInstance(): void {
    if (RedisService.instance) {
      void RedisService.instance.disconnect();
    }
    RedisService.instance = null;
  }
}

export const redisService = RedisService.getInstance();

export function getRedis(): RedisService {
  return redisService;
}

export default redisService;
