import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import JadwalDraftHandler from './jadwal-draft.handler';
import {
  generateJadwalSchema,
  getDraftsQuerySchema,
  updateDraftSchema,
} from './jadwal-draft.validator';

const jadwalDraftRoute = new Hono({ router: new RegExpRouter() });

jadwalDraftRoute.get(
  '/koordinator/jadwal-draft',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getDraftsQuerySchema, zodError),
  JadwalDraftHandler.getDrafts
);

jadwalDraftRoute.post(
  '/koordinator/jadwal-draft/generate',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.aiExpensive(),
  zValidator('json', generateJadwalSchema, zodError),
  JadwalDraftHandler.generate
);

jadwalDraftRoute.post(
  '/koordinator/jadwal-draft/generate/stream',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.aiExpensive(),
  zValidator('json', generateJadwalSchema, zodError),
  JadwalDraftHandler.generateStream
);

jadwalDraftRoute.get(
  '/koordinator/jadwal-draft/batch/:batch_id',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.getDraftsByBatch
);

jadwalDraftRoute.put(
  '/koordinator/jadwal-draft/item/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', updateDraftSchema, zodError),
  JadwalDraftHandler.updateDraft
);

jadwalDraftRoute.post(
  '/koordinator/jadwal-draft/batch/:batch_id/approve',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.approveBatch
);

jadwalDraftRoute.post(
  '/koordinator/jadwal-draft/batch/:batch_id/reject',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.rejectBatch
);

export default jadwalDraftRoute;
