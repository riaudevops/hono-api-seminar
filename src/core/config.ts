import { z } from 'zod';

// =============================================================================
// Environment Schema Validation
// =============================================================================
const envSchema = z.object({
  // Application Configuration
  APP_NAME: z.string().default('ZRAES AI API'),
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

  // Webhook Configuration
  WEBHOOK_SECRET: z.string().default('change-this-webhook-secret'),

  // Spreadsheet Configuration
  SPREADSHEET_KEY: z.string().optional(),
  SPREADSHEET_GID: z.string().default('0'),

  // OpenRouter Configuration
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
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
    };
  }

  // OpenRouter getters
  public get openrouter() {
    return {
      apiKey: this.config.OPENROUTER_API_KEY,
      baseUrl: this.config.OPENROUTER_BASE_URL,
      model: this.config.OPENROUTER_MODEL,
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
