import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { swaggerUI } from '@hono/swagger-ui';
import { config } from './core';
import { bootstrap, shutdown } from './core';
import { createLogger } from './utils/logger.util';
import GlobalHandler from './handlers/global.handler';
import LogMiddleware from './middlewares/log.middleware';
import RateLimitMiddleware from './middlewares/rate-limit.middleware';
import apiRouter from './api';

const logger = createLogger('Server');

// Initialize DI Container
await bootstrap();

const app = new OpenAPIHono({
  router: new RegExpRouter(),
});

// CORS Configuration from config
app.use(
  '*',
  cors({
    origin: config.cors.origins.includes('*') ? '*' : config.cors.origins,
    credentials: config.cors.allowCredentials,
    allowMethods: config.cors.allowMethods as any,
    allowHeaders: config.cors.allowHeaders,
  })
);

app.use('*', LogMiddleware.structuredLogger);

// Global rate limiter — IP-based safety net for the whole /api/* surface.
app.use('/api/*', RateLimitMiddleware.global());

app.notFound(GlobalHandler.notFound);
app.onError(GlobalHandler.error);

// OpenAPI Documentation
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Hono API Seminar - TIF UIN Suska',
    version: config.app.version,
    description:
      'API untuk sistem manajemen seminar kerja praktik dan tugas akhir',
  },
  servers: [
    {
      url: `http://${config.server.host}:${config.server.port}`,
      description: 'Development Server',
    },
  ],
});

// Swagger UI
app.get(
  '/docs',
  swaggerUI({
    url: '/openapi.json',
  })
);

app.route('/api', apiRouter);

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

const serverPort = config.server.port;

logger.info(`Server is running`, {
  port: serverPort,
  env: config.app.env,
  version: config.app.version,
  host: config.server.host,
});

export default {
  port: serverPort,
  fetch: app.fetch,
  idleTimeout: 120,
};
