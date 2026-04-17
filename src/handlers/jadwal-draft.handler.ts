import { Context } from 'hono';
import JadwalDraftService from '../services/jadwal-draft.service';
import { APIError } from '../utils/api-error.util';
import { LogActorType, StatusJadwalDraft } from '@prisma/client';

function extractContext(c: Context) {
  const userPayload = c.get('user');
  if (!userPayload || typeof userPayload !== 'object') {
    throw new APIError(
      'Informasi otentikasi tidak ditemukan atau tidak valid.',
      401
    );
  }

  return {
    actor_id: (userPayload as any).id || (userPayload as any).email || 'unknown',
    actor_type:
      (userPayload as any).role === 'admin'
        ? LogActorType.KOORDINATOR
        : (userPayload as any).role === 'dosen'
          ? LogActorType.DOSEN
          : LogActorType.MAHASISWA,
  };
}

export default class JadwalDraftHandler {
  public static async generate(c: Context) {
    const data = await c.req.json();
    const context = extractContext(c);
    return c.json(await JadwalDraftService.generate(data, context), 201);
  }

  public static async getDrafts(c: Context) {
    const { batch_id, status } = c.req.query();
    return c.json(
      await JadwalDraftService.getDrafts({
        batch_id,
        status: status as StatusJadwalDraft | undefined,
      })
    );
  }

  public static async getDraftsByBatch(c: Context) {
    const { batch_id } = c.req.param();
    return c.json(await JadwalDraftService.getDraftsByBatch(batch_id));
  }

  public static async updateDraft(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    return c.json(await JadwalDraftService.updateDraft(id, body));
  }

  public static async approveBatch(c: Context) {
    const { batch_id } = c.req.param();
    const context = extractContext(c);
    return c.json(await JadwalDraftService.approveBatch(batch_id, context));
  }

  public static async rejectBatch(c: Context) {
    const { batch_id } = c.req.param();
    return c.json(await JadwalDraftService.rejectBatch(batch_id));
  }
}
