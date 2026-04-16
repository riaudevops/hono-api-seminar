import { config } from '../core';
import { prisma } from '../infrastructures/db.infrastructure';
import { transporter } from '../infrastructures/mail.infrastructure';
import { logger } from '../utils/logger.util';

// =============================================================================
// Service Type Definitions for DI Container
// =============================================================================

export interface ServiceTypes {
  Config: typeof config;
  Database: typeof prisma;
  Mailer: typeof transporter;
  Logger: typeof logger;
}

export type ConfigService = typeof config;
export type DatabaseService = typeof prisma;
export type MailerService = typeof transporter;
export type LoggerService = typeof logger;
