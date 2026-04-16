import { container, ServiceTokens } from './container';
import { createLogger } from '../utils/logger.util';
import { database, getPrisma } from '../infrastructures/db.infrastructure';
import {
  mailService,
  getTransporter,
} from '../infrastructures/mail.infrastructure';

// =============================================================================
// Bootstrap: Register all services in the DI Container
// =============================================================================

const bootstrapLogger = createLogger('Bootstrap');

export async function bootstrap(): Promise<void> {
  bootstrapLogger.info('Starting application bootstrap...');

  // Import config lazily
  const { config } = await import('./config');

  // Register Configuration (Singleton)
  container.registerInstance(ServiceTokens.CONFIG, config);
  bootstrapLogger.debug('Config registered');

  // Register Logger (Singleton)
  const { logger } = await import('../utils/logger.util');
  container.registerInstance(ServiceTokens.LOGGER, logger);
  bootstrapLogger.debug('Logger registered');

  // Register Database (Singleton - lazy getter)
  container.registerSingleton(ServiceTokens.DATABASE, () => getPrisma());
  bootstrapLogger.debug('Database registered');

  // Register Mailer (Singleton - lazy getter)
  container.registerSingleton(ServiceTokens.MAILER, () => getTransporter());
  bootstrapLogger.debug('Mailer registered');

  // Log registered services
  bootstrapLogger.info('Bootstrap completed', {
    services: container.getRegisteredServices(),
    environment: config.app.env,
    debug: config.app.debug,
  });
}

export async function shutdown(): Promise<void> {
  bootstrapLogger.info('Starting graceful shutdown...');

  try {
    // Disconnect database
    await database.disconnect();

    // Close mail transporter
    await mailService.close();

    bootstrapLogger.info('Graceful shutdown completed');
  } catch (error) {
    bootstrapLogger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// Export utilities for DI resolution
// =============================================================================

export function getConfig() {
  return container.resolve(ServiceTokens.CONFIG);
}

export function getLogger() {
  return container.resolve(ServiceTokens.LOGGER);
}

export function getDatabase() {
  return container.resolve(ServiceTokens.DATABASE);
}

export function getMailer() {
  return container.resolve(ServiceTokens.MAILER);
}

export default bootstrap;
