import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import AuthMiddleware from '../middlewares/auth.middleware';
import JadwalDraftHandler from '../handlers/jadwal-draft.handler';
import {
  generateJadwalSchema,
  getDraftsQuerySchema,
  updateDraftSchema,
} from '../validators/jadwal-draft.validator';

const jadwalDraftRoute = new Hono({ router: new RegExpRouter() });

jadwalDraftRoute.get(
  '/jadwal-draft',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getDraftsQuerySchema, zodError),
  JadwalDraftHandler.getDrafts
);

jadwalDraftRoute.post(
  '/jadwal-draft/generate',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', generateJadwalSchema, zodError),
  JadwalDraftHandler.generate
);

jadwalDraftRoute.get(
  '/jadwal-draft/batch/:batch_id',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.getDraftsByBatch
);

jadwalDraftRoute.put(
  '/jadwal-draft/item/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', updateDraftSchema, zodError),
  JadwalDraftHandler.updateDraft
);

jadwalDraftRoute.post(
  '/jadwal-draft/batch/:batch_id/approve',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.approveBatch
);

jadwalDraftRoute.post(
  '/jadwal-draft/batch/:batch_id/reject',
  AuthMiddleware.JWTBearerTokenExtraction,
  JadwalDraftHandler.rejectBatch
);

export default jadwalDraftRoute;
