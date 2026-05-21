import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import JadwalHandler from './jadwal.handler';
import {
  getJadwalLogsQuerySchema,
  getJadwalQuerySchema,
  jadwalIdParamSchema,
  postJadwalSchema,
  putJadwalSchema,
} from './jadwal.validator';

const jadwalRoute = new Hono({ router: new RegExpRouter() });

jadwalRoute.get(
  '/dosen/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getJadwalDosenSaya
);

jadwalRoute.get(
  '/mahasiswa/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getJadwalMahasiswaSaya
);

jadwalRoute.get(
  '/koordinator/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getJadwalQuerySchema, zodError),
  JadwalHandler.getAll
);

jadwalRoute.get(
  '/koordinator/jadwal/:id/logs',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  zValidator('query', getJadwalLogsQuerySchema, zodError),
  JadwalHandler.getLogs
);

jadwalRoute.get(
  '/koordinator/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.get
);

jadwalRoute.post(
  '/koordinator/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postJadwalSchema, zodError),
  JadwalHandler.post
);

jadwalRoute.put(
  '/koordinator/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  zValidator('json', putJadwalSchema, zodError),
  JadwalHandler.put
);

jadwalRoute.delete(
  '/koordinator/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.delete
);

export default jadwalRoute;
