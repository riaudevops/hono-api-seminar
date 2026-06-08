import type { Context } from 'hono';
import JadwalDraftService from './jadwal-draft.service';
import { APIError } from '../../utils/api-error.util';
import { LogActorType, type StatusJadwalDraft } from '@prisma/client';
import WorkerJobService from '../worker-job/worker-job.service';
import { streamWorkerJob } from '../worker-job/worker-job.sse';
import { WorkerJobType } from '../worker-job/worker-job.type';

function extractContext(c: Context) {
  const userPayload = c.get('user');
  if (!userPayload || typeof userPayload !== 'object') {
    throw new APIError(
      'Informasi otentikasi tidak ditemukan atau tidak valid.',
      401
    );
  }

  return {
    actor_id:
      (userPayload as any).id || (userPayload as any).email || 'unknown',
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
    const job = await WorkerJobService.enqueue(
      WorkerJobType.JADWAL_DRAFT_GENERATE,
      { data, context },
      { maxAttempts: 1 }
    );

    return c.json(
      {
        response: true,
        message: 'Generate jadwal draft dikirim ke worker.',
        data: {
          job_id: job.id,
          status: job.status,
          status_url: `/api/worker/jobs/${job.id}`,
        },
      },
      202
    );
  }

  public static async generateStream(c: Context) {
    const data = await c.req.json();
    const context = extractContext(c);
    const job = await WorkerJobService.enqueue(
      WorkerJobType.JADWAL_DRAFT_GENERATE,
      { data, context },
      { maxAttempts: 1 }
    );

    return streamWorkerJob(c, {
      jobId: job.id,
      connectedMessage: 'Stream generate jadwal terhubung ke worker',
      heartbeatMessage: '🪄 Para penyihir masih meracik jadwalmu...',
    });
  }

  public static async getGenerateJob(c: Context) {
    const { job_id } = c.req.param();
    return c.json(await WorkerJobService.get(job_id));
  }

  public static async getDrafts(c: Context) {
    const batch_id = c.req.query('batch_id');
    const statusRaw = c.req.query('status');
    const status = statusRaw as StatusJadwalDraft | undefined;
    return c.json(await JadwalDraftService.getDrafts({ batch_id, status }));
  }

  public static async getDraftsByBatch(c: Context) {
    const { batch_id } = c.req.param();
    return c.json(await JadwalDraftService.getDraftsByBatch(batch_id));
  }

  public static async updateDraft(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const context = extractContext(c);
    return c.json(await JadwalDraftService.updateDraft(id, body, context));
  }

  public static async approveBatch(c: Context) {
    const { batch_id } = c.req.param();
    const context = extractContext(c);
    return c.json(await JadwalDraftService.approveBatch(batch_id, context));
  }

  public static async rejectBatch(c: Context) {
    const { batch_id } = c.req.param();
    const context = extractContext(c);
    return c.json(await JadwalDraftService.rejectBatch(batch_id, context));
  }
}
