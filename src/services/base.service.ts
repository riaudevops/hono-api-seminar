import { createLogger } from '../utils/logger.util';
import Logger from '../utils/logger.util';

// =============================================================================
// Base Service with DI Support
// =============================================================================
export abstract class BaseService {
  protected logger: ReturnType<typeof createLogger>;

  constructor(context: string) {
    this.logger = createLogger(context);
  }

  protected logInfo(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  protected logError(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  protected logDebug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  protected logWarn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }
}

export default BaseService;
