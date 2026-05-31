import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import BobotPenilaiHandler from './bobot-penilai.handler';
import {
  updateSingleBobotSchema,
  upsertBobotPenilaiSchema,
} from './bobot-penilai.validator';

const bobotPenilaianRoleRoute = new Hono({ router: new RegExpRouter() });

bobotPenilaianRoleRoute.get(
  '/data-master/bobot-penilai',
  BobotPenilaiHandler.getAll
);

bobotPenilaianRoleRoute.get(
  '/data-master/bobot-penilai/jenis-seminar/kode/:kode',
  BobotPenilaiHandler.getByKodeJenisSeminar
);

// bobotPenilaianRoleRoute.get(
//   '/data-master/bobot-penilai/jenis-seminar/:id_jenis_seminar',
//   BobotPenilaiHandler.getByJenisSeminar
// );

bobotPenilaianRoleRoute.put(
  '/koordinator/bobot-penilai',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', upsertBobotPenilaiSchema, zodError),
  BobotPenilaiHandler.upsertBatch
);

bobotPenilaianRoleRoute.patch(
  '/koordinator/bobot-penilai/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', updateSingleBobotSchema, zodError),
  BobotPenilaiHandler.updateSingle
);

bobotPenilaianRoleRoute.delete(
  '/koordinator/bobot-penilai/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  BobotPenilaiHandler.deleteOne
);

export default bobotPenilaianRoleRoute;
