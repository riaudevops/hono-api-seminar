import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import BobotPenilaianRoleHandler from './bobot-penilaian-role.handler';
import {
  updateSingleBobotSchema,
  upsertBobotPenilaianRoleSchema,
} from './bobot-penilaian-role.validator';

const bobotPenilaianRoleRoute = new Hono({ router: new RegExpRouter() });

bobotPenilaianRoleRoute.get(
  '/data-master/bobot-penilaian-role',
  BobotPenilaianRoleHandler.getAll
);

bobotPenilaianRoleRoute.get(
  '/data-master/bobot-penilaian-role/jenis-seminar/:id_jenis_seminar',
  BobotPenilaianRoleHandler.getByJenisSeminar
);

bobotPenilaianRoleRoute.put(
  '/koordinator/bobot-penilaian-role',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', upsertBobotPenilaianRoleSchema, zodError),
  BobotPenilaianRoleHandler.upsertBatch
);

bobotPenilaianRoleRoute.patch(
  '/koordinator/bobot-penilaian-role/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', updateSingleBobotSchema, zodError),
  BobotPenilaianRoleHandler.updateSingle
);

bobotPenilaianRoleRoute.delete(
  '/koordinator/bobot-penilaian-role/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  BobotPenilaianRoleHandler.deleteOne
);

export default bobotPenilaianRoleRoute;
