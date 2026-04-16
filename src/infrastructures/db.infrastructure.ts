import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('Database');

// =============================================================================
// Get database config from environment directly (lazy loading)
// =============================================================================
function getDatabaseConfig() {
  return {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/test',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '5', 10),
    echo: process.env.DATABASE_ECHO === 'true',
  };
}

// =============================================================================
// Database Singleton Class with Lazy Initialization
// =============================================================================

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

function createPrismaClient() {
  const dbConfig = getDatabaseConfig();

  const adapter = new PrismaPg({
    connectionString: dbConfig.url,
  });

  return new PrismaClient({
    adapter,
    log: dbConfig.echo ? ['query', 'info', 'warn', 'error'] : ['error'],
  }).$extends(withAccelerate());
}

class Database {
  private static instance: Database | null = null;
  private client: ExtendedPrismaClient | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getClient(): ExtendedPrismaClient {
    if (!this.client) {
      this.client = createPrismaClient();
      this.isConnected = true;
      const dbConfig = getDatabaseConfig();
      logger.info('Database client initialized', {
        poolSize: dbConfig.poolSize,
        echo: dbConfig.echo,
      });
    }
    return this.client;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('Database already connected');
      return;
    }

    try {
      const client = this.getClient();
      await (client as any).$connect();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      logger.debug('Database already disconnected');
      return;
    }

    try {
      await (this.client as any).$disconnect();
      this.isConnected = false;
      this.client = null;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from database', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  public static resetInstance(): void {
    if (Database.instance) {
      Database.instance.client = null;
      Database.instance.isConnected = false;
    }
    Database.instance = null;
  }
}

// =============================================================================
// Export singleton instance and lazy getter
// =============================================================================
export const database = Database.getInstance();

// Lazy getter for prisma client - only initializes when accessed
let _prismaClient: ExtendedPrismaClient | null = null;

export function getPrisma(): ExtendedPrismaClient {
  if (!_prismaClient) {
    _prismaClient = database.getClient();
  }
  return _prismaClient;
}

// For backward compatibility - use proxy for lazy initialization
export const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_, prop) {
    return (getPrisma() as any)[prop];
  },
});

export default prisma;
