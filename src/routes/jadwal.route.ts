import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import JadwalHandler from '../handlers/jadwal.handler';
import AuthMiddleware from '../middlewares/auth.middleware';
import { postPutJadwalSchema } from '../validators/jadwal.validator';

const jadwalRoute = new Hono({ router: new RegExpRouter() });

jadwalRoute.get(
  '/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getMe
);
jadwalRoute.get(
  '/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getAll
);
jadwalRoute.get(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.get
);
jadwalRoute.post(
  '/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postPutJadwalSchema, zodError),
  JadwalHandler.post
);
jadwalRoute.put(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postPutJadwalSchema, zodError),
  JadwalHandler.put
);
jadwalRoute.delete(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.delete
);

export default jadwalRoute;
