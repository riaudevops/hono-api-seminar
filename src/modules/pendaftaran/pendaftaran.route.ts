import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import PendaftaranHandler from './pendaftaran.handler';
import {
  dashboardQuerySchema,
  getAllPendaftaranQuerySchema,
  patchStatusBerkasSchema,
  postPendaftaranMahasiswaSchema,
  putDosenPenggantiSchema,
  putPendaftaranMahasiswaSchema,
} from './pendaftaran.validator';

const pendaftaranRoute = new Hono({ router: new RegExpRouter() });

// ============================================================================
// Mahasiswa endpoints — NIM diambil dari JWT
// ============================================================================
pendaftaranRoute.get(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  PendaftaranHandler.getMyAll
);

pendaftaranRoute.get(
  '/mahasiswa/pendaftaran-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  PendaftaranHandler.getMyById
);

pendaftaranRoute.post(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', postPendaftaranMahasiswaSchema, zodError),
  PendaftaranHandler.createByMahasiswa
);

pendaftaranRoute.put(
  '/mahasiswa/pendaftaran-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', putPendaftaranMahasiswaSchema, zodError),
  PendaftaranHandler.updateByMahasiswa
);

pendaftaranRoute.get(
  '/koordinator/pendaftaran',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getAllPendaftaranQuerySchema, zodError),
  PendaftaranHandler.getAll
);

pendaftaranRoute.get(
  '/koordinator/pendaftaran/dashboard',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', dashboardQuerySchema, zodError),
  PendaftaranHandler.getDashboard
);

pendaftaranRoute.get(
  '/koordinator/pendaftaran/detail/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  PendaftaranHandler.getById
);

pendaftaranRoute.patch(
  '/koordinator/pendaftaran/:id/validasi',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', patchStatusBerkasSchema, zodError),
  PendaftaranHandler.validateBerkas
);

pendaftaranRoute.put(
  '/koordinator/pendaftaran/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', putDosenPenggantiSchema, zodError),
  PendaftaranHandler.updateDosenByKoordinator
);

pendaftaranRoute.delete(
  '/koordinator/pendaftaran/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  PendaftaranHandler.delete
);

export default pendaftaranRoute;
