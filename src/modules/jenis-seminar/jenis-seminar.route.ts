import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import JenisSeminarHandler from './jenis-seminar.handler';
import {
  postJenisSeminarSchema,
  putJenisSeminarSchema,
} from './jenis-seminar.validator';

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

jenisSeminarRoute.post(
  '/koordinator/jenis-seminar',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postJenisSeminarSchema, zodError),
  JenisSeminarHandler.create
);

jenisSeminarRoute.put(
  '/koordinator/jenis-seminar/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', putJenisSeminarSchema, zodError),
  JenisSeminarHandler.update
);

jenisSeminarRoute.delete(
  '/koordinator/jenis-seminar/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  JenisSeminarHandler.delete
);

export default jenisSeminarRoute;
