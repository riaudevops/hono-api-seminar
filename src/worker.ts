import type { PenilaiRole } from '@prisma/client';
import { bootstrap, shutdown } from './core';
import { createLogger } from './utils/logger.util';
import ConstraintDosenService from './modules/constraint-dosen/constraint-dosen.service';
import JadwalDraftService from './modules/jadwal-draft/jadwal-draft.service';
import JadwalService from './modules/jadwal/jadwal.service';
import { LogService } from './modules/log';
import PendaftaranEmailService from './modules/pendaftaran/pendaftaran-email.service';
import WorkerJobService from './modules/worker-job/worker-job.service';
import {
  type WorkerConstraintDosenChatPayload,
  type WorkerConstraintDosenChatUpdatePayload,
  type WorkerJadwalDraftGeneratePayload,
  type WorkerJadwalEmailPayload,
  type WorkerJob,
  WorkerJobType,
  type WorkerLogCreatePayload,
  type WorkerPendaftaranEmailPayload,
} from './modules/worker-job/worker-job.type';

const logger = createLogger('Worker');
let shuttingDown = false;

function normalizeJadwalDraftPayload(
  payload: WorkerJadwalDraftGeneratePayload
) {
  return {
    data: {
      ...payload.data,
      tanggal_mulai: new Date(payload.data.tanggal_mulai),
      list_mahasiswa: payload.data.list_mahasiswa.map((mahasiswa) => ({
        ...mahasiswa,
        list_dosen: mahasiswa.list_dosen.map((dosen) => ({
          nip: dosen.nip,
          role: dosen.role as PenilaiRole,
        })),
      })),
    },
    context: payload.context,
  };
}

async function processJob(job: WorkerJob) {
  await WorkerJobService.markRunning(job.id);
  logger.info('Processing worker job', {
    jobId: job.id,
    type: job.type,
    attempt: job.attempts + 1,
  });

  switch (job.type) {
    case WorkerJobType.LOG_CREATE: {
      const payload = job.payload as WorkerLogCreatePayload;
      const result = await LogService.createEntityLogSync(payload);
      await WorkerJobService.markCompleted(job.id, {
        response: true,
        message: 'Log berhasil ditulis worker.',
        data: result,
      });
      return;
    }

    case WorkerJobType.PENDAFTARAN_EMAIL_SEND: {
      const payload = job.payload as WorkerPendaftaranEmailPayload;
      const result = await PendaftaranEmailService.sendById(
        payload.pendaftaranId,
        payload.event,
        payload.revisiData
      );
      await WorkerJobService.markCompleted(job.id, result);
      return;
    }

    case WorkerJobType.JADWAL_EMAIL_SEND: {
      const payload = job.payload as WorkerJadwalEmailPayload;
      const result = await JadwalService.sendGoogleCalendarInvitationById(
        payload.jadwalId,
        payload.action
      );
      await WorkerJobService.markCompleted(job.id, result);
      return;
    }

    case WorkerJobType.JADWAL_DRAFT_GENERATE: {
      const payload = job.payload as WorkerJadwalDraftGeneratePayload;
      const { data, context } = normalizeJadwalDraftPayload(payload);
      const result = await JadwalDraftService.generate(
        data,
        context,
        async (event, payload) => {
          await WorkerJobService.appendProgress(job.id, event, payload);
        }
      );
      await WorkerJobService.markCompleted(job.id, result);
      return;
    }

    case WorkerJobType.CONSTRAINT_DOSEN_CHAT: {
      const payload = job.payload as WorkerConstraintDosenChatPayload;
      const result = await ConstraintDosenService.chat(
        payload.email,
        payload.message,
        async (event, payload) => {
          await WorkerJobService.appendProgress(job.id, event, payload);
        }
      );
      await WorkerJobService.markCompleted(job.id, result);
      return;
    }

    case WorkerJobType.CONSTRAINT_DOSEN_CHAT_UPDATE: {
      const payload = job.payload as WorkerConstraintDosenChatUpdatePayload;
      const result = await ConstraintDosenService.chatUpdate(
        payload.email,
        payload.id,
        payload.message,
        async (event, payload) => {
          await WorkerJobService.appendProgress(job.id, event, payload);
        }
      );
      await WorkerJobService.markCompleted(job.id, result);
      return;
    }

    default:
      throw new Error(
        `Tipe job worker tidak dikenal: ${(job as WorkerJob).type}`
      );
  }
}

async function startWorker() {
  await bootstrap();
  logger.info('Worker started');

  while (!shuttingDown) {
    try {
      const job = await WorkerJobService.waitForNextJob(5);
      if (!job) continue;

      try {
        await processJob(job);
      } catch (error) {
        const latest = await WorkerJobService.getInternal(job.id);
        const shouldRetry = latest
          ? WorkerJobService.shouldRetry(latest)
          : false;
        await WorkerJobService.markFailed(job.id, error, shouldRetry);
        const errMessage =
          error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : undefined;
        const errStatusCode = (error as { statusCode?: number })?.statusCode;
        const errDetails = (error as { details?: unknown })?.details;
        logger.error('Worker job failed', {
          jobId: job.id,
          type: job.type,
          retry: shouldRetry,
          attempts: latest?.attempts,
          maxAttempts: latest?.max_attempts,
          statusCode: errStatusCode,
          error: errMessage,
          ...(errDetails !== undefined ? { details: errDetails } : {}),
          stack: errStack,
        });
      }
    } catch (error) {
      if (!shuttingDown) {
        logger.error('Worker loop error', {
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }
}

async function stopWorker(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down worker...`);
  await shutdown();
  process.exit(0);
}

process.on('SIGINT', () => void stopWorker('SIGINT'));
process.on('SIGTERM', () => void stopWorker('SIGTERM'));

await startWorker();
