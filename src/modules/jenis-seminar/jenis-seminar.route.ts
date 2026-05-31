import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import JenisSeminarHandler from './jenis-seminar.handler';
import { upsertJenisSeminarSchema } from './jenis-seminar.validator';

const jenisSeminarRoute = new Hono({ router: new RegExpRouter() });

// CRUD Endpoints for Jenis Seminar
jenisSeminarRoute.get(
  '/data-master/jenis-seminar',
  AuthMiddleware.JWTBearerTokenExtraction,
  JenisSeminarHandler.getAll
);

jenisSeminarRoute.get(
  '/data-master/jenis-seminar/:kode',
  AuthMiddleware.JWTBearerTokenExtraction,
  JenisSeminarHandler.getByKode
);

jenisSeminarRoute.put(
  '/koordinator/jenis-seminar',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', upsertJenisSeminarSchema, zodError),
  JenisSeminarHandler.upsert
);

jenisSeminarRoute.delete(
  '/koordinator/jenis-seminar/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  JenisSeminarHandler.delete
);

export default jenisSeminarRoute;
