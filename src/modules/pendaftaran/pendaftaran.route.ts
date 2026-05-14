import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import PendaftaranHandler from './pendaftaran.handler';
import {
  getAllPendaftaranQuerySchema,
  patchStatusBerkasSchema,
  postPendaftaranMahasiswaSchema,
  putPendaftaranMahasiswaSchema,
} from './pendaftaran.validator';

const pendaftaranRoute = new Hono({ router: new RegExpRouter() });

// ============================================================================
// Mahasiswa endpoints — NIM diambil dari JWT
// ============================================================================
pendaftaranRoute.get(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('mahasiswa'),
  PendaftaranHandler.getMyAll
);

pendaftaranRoute.get(
  '/mahasiswa/pendaftaran-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('mahasiswa'),
  PendaftaranHandler.getMyById
);

pendaftaranRoute.post(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('mahasiswa'),
  zValidator('json', postPendaftaranMahasiswaSchema, zodError),
  PendaftaranHandler.createByMahasiswa
);

pendaftaranRoute.put(
  '/mahasiswa/pendaftaran-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('mahasiswa'),
  zValidator('json', putPendaftaranMahasiswaSchema, zodError),
  PendaftaranHandler.updateByMahasiswa
);

// ============================================================================
// Koordinator endpoints — list, detail, validasi status, hapus
// ============================================================================
pendaftaranRoute.get(
  '/koordinator/pendaftaran',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('query', getAllPendaftaranQuerySchema, zodError),
  PendaftaranHandler.getAll
);

pendaftaranRoute.get(
  '/koordinator/pendaftaran/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  PendaftaranHandler.getById
);

pendaftaranRoute.patch(
  '/koordinator/pendaftaran/:id/validasi',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('json', patchStatusBerkasSchema, zodError),
  PendaftaranHandler.validateBerkas
);

pendaftaranRoute.delete(
  '/koordinator/pendaftaran/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  PendaftaranHandler.delete
);

export default pendaftaranRoute;
