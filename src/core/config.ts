import { z } from 'zod';

// =============================================================================
// Environment Schema Validation
// =============================================================================
const envSchema = z.object({
  // Application Configuration
  APP_NAME: z.string().default('API SEMINAR TIF'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_ENV: z
    .enum(['development', 'staging', 'production', 'testing'])
    .default('development'),
  DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Server Configuration
  HOST: z.string().default('0.0.0.0'),
  PORT: z.string().transform(Number).default('8000'),
  APP_PORT: z.string().transform(Number).optional(),
  WORKERS: z.string().transform(Number).default('1'),
  APP_PROCESS: z.enum(['server', 'api', 'worker']).default('server'),

  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://localhost:5432/test'),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('5'),
  DATABASE_MAX_OVERFLOW: z.string().transform(Number).default('10'),
  DATABASE_POOL_TIMEOUT: z.string().transform(Number).default('30'),
  DATABASE_ECHO: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // CORS Configuration
  CORS_ORIGINS: z
    .string()
    .transform((val) => {
      try {
        return JSON.parse(val) as string[];
      } catch {
        return ['*'];
      }
    })
    .default('["*"]'),
  CORS_ALLOW_CREDENTIALS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  CORS_ALLOW_METHODS: z
    .string()
    .transform((val) => {
      try {
        return JSON.parse(val) as string[];
      } catch {
        return ['*'];
      }
    })
    .default('["*"]'),
  CORS_ALLOW_HEADERS: z
    .string()
    .transform((val) => {
      try {
        return JSON.parse(val) as string[];
      } catch {
        return ['*'];
      }
    })
    .default('["*"]'),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'])
    .default('INFO'),
  LOG_FORMAT: z
    .string()
    .default('%(asctime)s - %(name)s - %(levelname)s - %(message)s'),
  LOG_FILE: z.string().optional(),

  // API Configuration
  API_PREFIX: z.string().default('/api/v1'),

  // Crypto Configuration
  HANZ_CRYPTO_KEY: z
    .string()
    .default('default-crypto-key-change-in-production'),

  // Email Configuration
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  DEV_EMAIL_SINK: z.string().optional(),

  // Google Configuration
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z
    .string()
    .transform((val) => val.replace(/\\n/g, '\n'))
    .optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_CALENDAR_IMPERSONATE_EMAIL: z.string().optional(),

  // Webhook Configuration
  WEBHOOK_SECRET: z.string().default('change-this-webhook-secret'),

  // Redis Configuration
  REDIS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default('seminar-tif'),
  REDIS_DEFAULT_TTL_SECONDS: z.string().transform(Number).default('300'),
  WORKER_JOB_TTL_SECONDS: z.string().transform(Number).default('86400'),

  // Rate Limiter Configuration
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  RATE_LIMIT_GLOBAL_LIMIT: z.string().transform(Number).default('300'),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_READ_LIMIT: z.string().transform(Number).default('120'),
  RATE_LIMIT_READ_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_WRITE_LIMIT: z.string().transform(Number).default('30'),
  RATE_LIMIT_WRITE_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_AUTH_LIMIT: z.string().transform(Number).default('10'),
  RATE_LIMIT_AUTH_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_AI_LIMIT: z.string().transform(Number).default('10'),
  RATE_LIMIT_AI_WINDOW_MS: z.string().transform(Number).default('600000'),

  // OpenRouter Configuration
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
  OPENROUTER_MODELS: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .default(''),
  OPENROUTER_TIMEOUT_MS: z.string().transform(Number).default('90000'),
  OPENROUTER_MAX_RETRIES: z.string().transform(Number).default('2'),
  OPENROUTER_USE_LOW_LATENCY_ROUTING: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
});

// =============================================================================
// Config Type
// =============================================================================
export type EnvConfig = z.infer<typeof envSchema>;

// =============================================================================
// Singleton Config Class
// =============================================================================
class Config {
  private static instance: Config | null = null;
  private config: EnvConfig;
  private initialized: boolean = false;

  private constructor() {
    this.config = this.loadConfig();
    this.initialized = true;
  }

  private loadConfig(): EnvConfig {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('[CONFIG] Environment validation failed:');
      console.error(result.error.format());
      throw new Error('Invalid environment configuration');
    }

    return result.data;
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  public getAll(): Readonly<EnvConfig> {
    return Object.freeze({ ...this.config });
  }

  // Application getters
  public get app() {
    return {
      name: this.config.APP_NAME,
      version: this.config.APP_VERSION,
      env: this.config.APP_ENV,
      debug: this.config.DEBUG,
      isDevelopment: this.config.APP_ENV === 'development',
      isProduction: this.config.APP_ENV === 'production',
      isStaging: this.config.APP_ENV === 'staging',
      isTesting: this.config.APP_ENV === 'testing',
    };
  }

  // Server getters
  public get server() {
    return {
      host: this.config.HOST,
      port: this.config.APP_PORT || this.config.PORT,
      workers: this.config.WORKERS,
      process: this.config.APP_PROCESS,
    };
  }

  // Database getters
  public get database() {
    return {
      url: this.config.DATABASE_URL,
      poolSize: this.config.DATABASE_POOL_SIZE,
      maxOverflow: this.config.DATABASE_MAX_OVERFLOW,
      poolTimeout: this.config.DATABASE_POOL_TIMEOUT,
      echo: this.config.DATABASE_ECHO,
    };
  }

  // CORS getters
  public get cors() {
    return {
      origins: this.config.CORS_ORIGINS,
      allowCredentials: this.config.CORS_ALLOW_CREDENTIALS,
      allowMethods: this.config.CORS_ALLOW_METHODS,
      allowHeaders: this.config.CORS_ALLOW_HEADERS,
    };
  }

  // Logging getters
  public get logging() {
    return {
      level: this.config.LOG_LEVEL,
      format: this.config.LOG_FORMAT,
      file: this.config.LOG_FILE,
    };
  }

  // API getters
  public get api() {
    return {
      prefix: this.config.API_PREFIX,
    };
  }

  // Security getters
  public get security() {
    return {
      cryptoKey: this.config.HANZ_CRYPTO_KEY,
    };
  }

  // Email getters
  public get email() {
    return {
      user: this.config.EMAIL_USER,
      pass: this.config.EMAIL_PASS,
      devEmailSink: this.config.DEV_EMAIL_SINK,
    };
  }

  // Rate limiter getters
  public get rateLimit() {
    return {
      enabled: this.config.RATE_LIMIT_ENABLED,
      tiers: {
        global: {
          limit: this.config.RATE_LIMIT_GLOBAL_LIMIT,
          windowMs: this.config.RATE_LIMIT_GLOBAL_WINDOW_MS,
        },
        read: {
          limit: this.config.RATE_LIMIT_READ_LIMIT,
          windowMs: this.config.RATE_LIMIT_READ_WINDOW_MS,
        },
        write: {
          limit: this.config.RATE_LIMIT_WRITE_LIMIT,
          windowMs: this.config.RATE_LIMIT_WRITE_WINDOW_MS,
        },
        authStrict: {
          limit: this.config.RATE_LIMIT_AUTH_LIMIT,
          windowMs: this.config.RATE_LIMIT_AUTH_WINDOW_MS,
        },
        aiExpensive: {
          limit: this.config.RATE_LIMIT_AI_LIMIT,
          windowMs: this.config.RATE_LIMIT_AI_WINDOW_MS,
        },
      },
    };
  }

  // Redis getters
  public get redis() {
    const url =
      this.config.REDIS_URL ||
      (this.config.REDIS_HOST
        ? `redis://${this.config.REDIS_HOST}:${this.config.REDIS_PORT}`
        : undefined);

    return {
      enabled: this.config.REDIS_ENABLED,
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      password: this.config.REDIS_PASSWORD,
      url,
      keyPrefix: this.config.REDIS_KEY_PREFIX,
      defaultTtlSeconds: this.config.REDIS_DEFAULT_TTL_SECONDS,
      workerJobTtlSeconds: this.config.WORKER_JOB_TTL_SECONDS,
    };
  }

  // Google getters
  public get google() {
    return {
      clientEmail: this.config.GOOGLE_CLIENT_EMAIL,
      privateKey: this.config.GOOGLE_PRIVATE_KEY,
      driveFolderId: this.config.GOOGLE_DRIVE_FOLDER_ID,
      calendarId: this.config.GOOGLE_CALENDAR_ID,
      calendarImpersonateEmail: this.config.GOOGLE_CALENDAR_IMPERSONATE_EMAIL,
    };
  }

  // Google Drive getters
  public get googleDrive() {
    return {
      clientEmail: this.config.GOOGLE_CLIENT_EMAIL,
      privateKey: this.config.GOOGLE_PRIVATE_KEY,
      folderId: this.config.GOOGLE_DRIVE_FOLDER_ID,
    };
  }

  // OpenRouter getters
  public get openrouter() {
    return {
      apiKey: this.config.OPENROUTER_API_KEY,
      baseUrl: this.config.OPENROUTER_BASE_URL,
      model: this.config.OPENROUTER_MODEL,
      models: this.config.OPENROUTER_MODELS,
      timeoutMs: this.config.OPENROUTER_TIMEOUT_MS,
      maxRetries: this.config.OPENROUTER_MAX_RETRIES,
      useLowLatencyRouting: this.config.OPENROUTER_USE_LOW_LATENCY_ROUTING,
    };
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // Reset instance (useful for testing)
  public static resetInstance(): void {
    Config.instance = null;
  }
}

// =============================================================================
// Export singleton instance getter
// =============================================================================
export const config = Config.getInstance();
export default Config;
