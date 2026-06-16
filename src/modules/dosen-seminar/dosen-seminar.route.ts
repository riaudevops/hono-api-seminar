import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import DosenSeminarHandler from './dosen-seminar.handler';
import {
  submitNilaiSchema,
  postConstraintSchema,
  getKomponenPenilaianSayaQuerySchema,
} from './dosen-seminar.validator';

const dosenSeminarRoute = new Hono({ router: new RegExpRouter() });

// #1 GET /dosen/jadwal
dosenSeminarRoute.get(
  '/dosen/jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getJadwalSeminar
);

// #2 GET /dosen/stats
dosenSeminarRoute.get(
  '/dosen/stats',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getStats
);

// #3 GET /dosen/komponen-penilaian-saya
dosenSeminarRoute.get(
  '/dosen/komponen-penilaian-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getKomponenPenilaianSayaQuerySchema, zodError),
  DosenSeminarHandler.getKomponenPenilaianSaya
);

// #4 GET /dosen/komponen-penilaian
dosenSeminarRoute.get(
  '/dosen/komponen-penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getKomponenPenilaian
);

// #5 GET /dosen/penilaian?jadwal_id=
dosenSeminarRoute.get(
  '/dosen/penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getPenilaianByJadwal
);

// #6 POST /dosen/penilaian
dosenSeminarRoute.post(
  '/dosen/penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', submitNilaiSchema, zodError),
  DosenSeminarHandler.submitNilai
);

// #7 GET /dosen/log
dosenSeminarRoute.get(
  '/dosen/log',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getLogPenilaian
);

// #8 GET /dosen/constraints
dosenSeminarRoute.get(
  '/dosen/constraints',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenSeminarHandler.getConstraints
);

// #9 POST /dosen/constraints
dosenSeminarRoute.post(
  '/dosen/constraints',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postConstraintSchema, zodError),
  DosenSeminarHandler.createConstraint
);

export default dosenSeminarRoute;
