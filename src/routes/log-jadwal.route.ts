import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import AuthMiddleware from '../middlewares/auth.middleware';
import { zodError } from '../utils/zod-error.util';
import LogJadwalHandler from '../handlers/log-jadwal.handler';
import {
  createLogJadwalSchema,
  getLogJadwalQuerySchema,
  updateLogJadwalSchema,
} from '../validators/log-jadwal.validator';

const logJadwalRoute = new Hono({ router: new RegExpRouter() });

logJadwalRoute.get(
  '/log-jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getLogJadwalQuerySchema, zodError),
  LogJadwalHandler.getAll
);
logJadwalRoute.get(
  '/log-jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  LogJadwalHandler.get
);
logJadwalRoute.post(
  '/log-jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', createLogJadwalSchema, zodError),
  LogJadwalHandler.create
);
logJadwalRoute.put(
  '/log-jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', updateLogJadwalSchema, zodError),
  LogJadwalHandler.update
);
logJadwalRoute.delete(
  '/log-jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  LogJadwalHandler.delete
);

export default logJadwalRoute;
