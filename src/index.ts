import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { swaggerUI } from '@hono/swagger-ui';
import { config } from './core';
import { bootstrap, shutdown } from './core';
import { createLogger } from './utils/logger.util';
import GlobalHandler from './handlers/global.handler';
import globalRoute from './routes/global.route';
import LogMiddleware from './middlewares/log.middleware';
import jadwalRoute from './routes/jadwal.route';
import ruanganRoute from './routes/ruangan.route';
import dosenRoute from './routes/dosen.route';
import mahasiswaRoute from './routes/mahasiswa.route';
import komponenRoute from './routes/komponen-penilaian.route';
import penilaianRoute from './routes/penilaian.route';
import constraintDosenRoute from './routes/constraint-dosen.route';
import jadwalDraftRoute from './routes/jadwal-draft.route';
import bidangKeahlianRoute from './routes/bidang-keahlian.route';
import keahlianDosenRoute from './routes/keahlian-dosen.route';
import logRoute from './routes/log.route';
import dosenSeminarRoute from './routes/dosen-seminar.route';
import koordinatorRoute from './routes/koordinator.route';
import pendaftaranRoute from './routes/pendaftaran.route';
import { JenisSeminarRoute } from './modules/jenis-seminar';
import { DokumenTemplateRoute } from './modules/dokumen-template';
import { RequirementDokumenRoute } from './modules/requirement-dokumen';
import { MahasiswaModuleRoute } from './modules/mahasiswa';

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

app.route('/api', globalRoute);
app.route('/api', jadwalRoute);
app.route('/api', ruanganRoute);
app.route('/api', dosenRoute);
app.route('/api', mahasiswaRoute);
app.route('/api', komponenRoute);
app.route('/api', penilaianRoute);
app.route('/api', constraintDosenRoute);
app.route('/api', jadwalDraftRoute);
app.route('/api', bidangKeahlianRoute);
app.route('/api', keahlianDosenRoute);
app.route('/api', logRoute);
app.route('/api', dosenSeminarRoute);
app.route('/api', koordinatorRoute);
app.route('/api', pendaftaranRoute);
app.route('/api', JenisSeminarRoute);
app.route('/api', DokumenTemplateRoute);
app.route('/api', RequirementDokumenRoute);
app.route('/api', MahasiswaModuleRoute);

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
};
