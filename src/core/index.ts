// =============================================================================
// Centralized Exports
// =============================================================================

// Config
export { config, default as Config } from './config';
export type { EnvConfig } from './config';

// Container & DI
export { container, ServiceTokens, default as Container } from './container';
export type { ServiceToken } from './container';

// Bootstrap
export {
  bootstrap,
  shutdown,
  getConfig,
  getLogger,
  getDatabase,
  getMailer,
} from './bootstrap';
