import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import AuthMiddleware from '../../middlewares/auth.middleware';
import { zodError } from '../../utils/zod-error.util';
import DetailPenilaianHandler from './detail-penilaian.handler';
import {
  idJadwalParamSchema,
  idPenilaianParamSchema,
  upsertDetailPenilaianSchema,
} from './detail-penilaian.validator';

const detailPenilaianRoute = new Hono({ router: new RegExpRouter() });

detailPenilaianRoute.get(
  '/detail-penilaian/penilaian/:id_penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', idPenilaianParamSchema, zodError),
  DetailPenilaianHandler.getByPenilaianId
);

detailPenilaianRoute.put(
  '/detail-penilaian/penilaian/:id_penilaian',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', idPenilaianParamSchema, zodError),
  zValidator('json', upsertDetailPenilaianSchema, zodError),
  DetailPenilaianHandler.upsertByPenilaianId
);

detailPenilaianRoute.get(
  '/detail-penilaian/jadwal/:id_jadwal/rekap',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('param', idJadwalParamSchema, zodError),
  DetailPenilaianHandler.getRekapByJadwal
);

export default detailPenilaianRoute;
