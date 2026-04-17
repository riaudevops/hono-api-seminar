import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import JadwalDraftHandler from '../handlers/jadwal-draft.handler';
import AuthMiddleware from '../middlewares/auth.middleware';
import {
  generateJadwalSchema,
  getDraftsQuerySchema,
  updateDraftSchema,
} from '../validators/jadwal-draft.validator';

const jadwalDraftRoute = new Hono({ router: new RegExpRouter() });

jadwalDraftRoute.post(
  '/jadwal/generate',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('json', generateJadwalSchema, zodError),
  JadwalDraftHandler.generate
);

jadwalDraftRoute.get(
  '/jadwal/draft',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('query', getDraftsQuerySchema, zodError),
  JadwalDraftHandler.getDrafts
);

jadwalDraftRoute.get(
  '/jadwal/draft/:batch_id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalDraftHandler.getDraftsByBatch
);

jadwalDraftRoute.put(
  '/jadwal/draft/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  zValidator('json', updateDraftSchema, zodError),
  JadwalDraftHandler.updateDraft
);

jadwalDraftRoute.post(
  '/jadwal/draft/:batch_id/approve',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalDraftHandler.approveBatch
);

jadwalDraftRoute.post(
  '/jadwal/draft/:batch_id/reject',
  AuthMiddleware.JWTBearerTokenExtraction,
  AuthMiddleware.requireRole('koordinator'),
  JadwalDraftHandler.rejectBatch
);

export default jadwalDraftRoute;
