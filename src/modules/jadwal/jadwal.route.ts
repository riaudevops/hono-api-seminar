import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import JadwalHandler from './jadwal.handler';
import {
  getJadwalDosenSayaQuerySchema,
  getJadwalLogsQuerySchema,
  getJadwalQuerySchema,
  jadwalIdParamSchema,
  jadwalPenilaianRoleParamSchema,
  patchStatusKelulusanJadwalSchema,
  postJadwalSchema,
  putJadwalSchema,
} from './jadwal.validator';
import { submitPenilaianSchema } from '../penilaian/penilaian.validator';

const jadwalRoute = new Hono({ router: new RegExpRouter() });

jadwalRoute.get(
  '/dosen/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getJadwalDosenSayaQuerySchema, zodError),
  JadwalHandler.getJadwalDosenSaya
);

jadwalRoute.get(
  '/dosen/jadwal-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.getJadwalDosenSayaById
);

jadwalRoute.get(
  '/dosen/jadwal/statistik-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getStatistikDosenSaya
);

jadwalRoute.get(
  '/mahasiswa/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalHandler.getJadwalMahasiswaSaya
);

jadwalRoute.get(
  '/mahasiswa/jadwal-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.getJadwalMahasiswaSayaById
);

jadwalRoute.get(
  '/koordinator/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getJadwalQuerySchema, zodError),
  JadwalHandler.getAll
);

jadwalRoute.get(
  '/data-master/jadwal',
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
  '/koordinator/jadwal/:id/penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.getPenilaianByJadwal
);

jadwalRoute.post(
  '/koordinator/jadwal/:id/penilaian/:role/submit',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('param', jadwalPenilaianRoleParamSchema, zodError),
  zValidator('json', submitPenilaianSchema, zodError),
  JadwalHandler.submitPenilaianByJadwalRole
);

jadwalRoute.get(
  '/dosen/jadwal/penilaian/:id/detail',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.getPenilaianByJadwal
);

jadwalRoute.get(
  '/jadwal/:id/penilaian/detail',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.getPenilaianByJadwal
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
  RateLimitMiddleware.write(),
  zValidator('json', postJadwalSchema, zodError),
  JadwalHandler.post
);

jadwalRoute.put(
  '/koordinator/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('param', jadwalIdParamSchema, zodError),
  zValidator('json', putJadwalSchema, zodError),
  JadwalHandler.put
);

jadwalRoute.patch(
  '/koordinator/jadwal/:id/status-kelulusan',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('param', jadwalIdParamSchema, zodError),
  zValidator('json', patchStatusKelulusanJadwalSchema, zodError),
  JadwalHandler.patchStatusKelulusan
);

jadwalRoute.patch(
  '/dosen/jadwal/:id/status-kelulusan',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('param', jadwalIdParamSchema, zodError),
  zValidator('json', patchStatusKelulusanJadwalSchema, zodError),
  JadwalHandler.patchStatusKelulusan
);

jadwalRoute.delete(
  '/koordinator/jadwal/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('param', jadwalIdParamSchema, zodError),
  JadwalHandler.delete
);

export default jadwalRoute;
