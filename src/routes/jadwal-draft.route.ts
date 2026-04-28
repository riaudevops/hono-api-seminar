import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import JadwalDraftHandler from '../handlers/jadwal-draft.handler';
import {
  generateJadwalSchema,
  getDraftsQuerySchema,
  updateDraftSchema,
} from '../validators/jadwal-draft.validator';

const jadwalDraftRoute = new Hono({ router: new RegExpRouter() });

jadwalDraftRoute.get(
  '/jadwal-draft',
  zValidator('query', getDraftsQuerySchema, zodError),
  JadwalDraftHandler.getDrafts
);

jadwalDraftRoute.post(
  '/jadwal-draft/generate',
  zValidator('json', generateJadwalSchema, zodError),
  JadwalDraftHandler.generate
);

jadwalDraftRoute.get(
  '/jadwal-draft/batch/:batch_id',
  JadwalDraftHandler.getDraftsByBatch
);

jadwalDraftRoute.put(
  '/jadwal-draft/item/:id',
  zValidator('json', updateDraftSchema, zodError),
  JadwalDraftHandler.updateDraft
);

jadwalDraftRoute.post(
  '/jadwal-draft/batch/:batch_id/approve',
  JadwalDraftHandler.approveBatch
);

jadwalDraftRoute.post(
  '/jadwal-draft/batch/:batch_id/reject',
  JadwalDraftHandler.rejectBatch
);

export default jadwalDraftRoute;
