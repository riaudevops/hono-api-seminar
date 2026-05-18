import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import JadwalHandler from './jadwal.handler';
import { postPutJadwalSchema } from './jadwal.validator';

const jadwalRoute = new Hono({ router: new RegExpRouter() });

jadwalRoute.get(
  '/dosen/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('dosen'),
  JadwalHandler.getJadwalDosenSaya
);

jadwalRoute.get(
  '/mahasiswa/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('mahasiswa'),
  JadwalHandler.getJadwalMahasiswaSaya
);

jadwalRoute.get(
  '/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalHandler.getAll
);

jadwalRoute.get(
  '/jadwal/:id/logs',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalHandler.getLogs
);

jadwalRoute.get(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalHandler.get
);

jadwalRoute.post(
  '/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('json', postPutJadwalSchema, zodError),
  JadwalHandler.post
);

jadwalRoute.put(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('json', postPutJadwalSchema, zodError),
  JadwalHandler.put
);

jadwalRoute.delete(
  '/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalHandler.delete
);

export default jadwalRoute;
