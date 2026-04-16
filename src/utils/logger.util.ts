// =============================================================================
// Log Levels
// =============================================================================
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  CRITICAL = 4,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARNING: LogLevel.WARNING,
  ERROR: LogLevel.ERROR,
  CRITICAL: LogLevel.CRITICAL,
};

// =============================================================================
// Colors for console output
// =============================================================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const levelColors: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: colors.gray,
  [LogLevel.INFO]: colors.blue,
  [LogLevel.WARNING]: colors.yellow,
  [LogLevel.ERROR]: colors.red,
  [LogLevel.CRITICAL]: `${colors.bright}${colors.red}`,
};

const levelLabels: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARNING]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.CRITICAL]: 'CRITICAL',
};

// =============================================================================
// Get log level from environment (without config dependency)
// =============================================================================
function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  return LOG_LEVEL_MAP[envLevel] ?? LogLevel.INFO;
}

// =============================================================================
// Logger Singleton Class
// =============================================================================
class Logger {
  private static instance: Logger | null = null;
  private minLevel: LogLevel;
  private context: string;

  private constructor(context: string = 'App') {
    this.context = context;
    this.minLevel = getLogLevelFromEnv();
  }

  public static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  public static createLogger(context: string): Logger {
    const logger = new Logger(context);
    logger.minLevel = getLogLevelFromEnv();
    return logger;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): string {
    const timestamp = this.formatTimestamp();
    const levelLabel = levelLabels[level];
    const color = levelColors[level];

    let formattedMessage = `${colors.dim}${timestamp}${colors.reset} ${color}[${levelLabel}]${colors.reset} ${colors.cyan}[${this.context}]${colors.reset} ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      formattedMessage += ` ${colors.dim}${JSON.stringify(meta)}${colors.reset}`;
    }

    return formattedMessage;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    switch (level) {
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage);
        break;
      case LogLevel.WARNING:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  public debug(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  public info(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.WARNING, message, meta);
  }

  public error(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  public critical(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, meta);
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public child(context: string): Logger {
    return Logger.createLogger(`${this.context}:${context}`);
  }

  public static resetInstance(): void {
    Logger.instance = null;
  }
}

// =============================================================================
// Export singleton instance and factory
// =============================================================================
export const logger = Logger.getInstance();
export const createLogger = Logger.createLogger;
export default Logger;
