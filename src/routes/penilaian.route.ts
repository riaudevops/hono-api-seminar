import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import AuthMiddleware from '../middlewares/auth.middleware';
import PenilaianHandler from '../handlers/penilaian.handler';
import { submitPenilaianSchema } from '../validators/penilaian.validator';

const penilaianRoute = new Hono({ router: new RegExpRouter() });

// Dosen endpoints
penilaianRoute.get(
  '/penilaian/jadwal-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  PenilaianHandler.getJadwalToAssess
);
penilaianRoute.post(
  '/penilaian/:id/submit',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', submitPenilaianSchema, zodError),
  PenilaianHandler.submitPenilaian
);

// General endpoints
penilaianRoute.get(
  '/penilaian/jadwal/:id_jadwal',
  AuthMiddleware.JWTBearerTokenExtraction,
  PenilaianHandler.getNilaiByJadwal
);

export default penilaianRoute;
