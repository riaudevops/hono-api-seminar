import type { LogActorType } from '@prisma/client';
import type { CreateLogType } from '../log/log.type';

export const WORKER_JOB_QUEUE_KEY = 'worker:jobs:queue';
export const WORKER_JOB_ACTIVE_KEY = 'worker:jobs:active';
export const WORKER_JOB_KEY_PREFIX = 'worker:jobs:item:';

export const WORKER_JOB_DEFAULT_TTL_SECONDS = 60 * 60 * 24;
export const WORKER_JOB_MAX_PROGRESS_EVENTS = 200;

export enum WorkerJobType {
  LOG_CREATE = 'log.create',
  PENDAFTARAN_EMAIL_SEND = 'pendaftaran.email.send',
  JADWAL_EMAIL_SEND = 'jadwal.email.send',
  JADWAL_DRAFT_GENERATE = 'jadwal-draft.generate',
  CONSTRAINT_DOSEN_CHAT = 'constraint-dosen.chat',
  CONSTRAINT_DOSEN_CHAT_UPDATE = 'constraint-dosen.chat-update',
}

export enum WorkerJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type WorkerJobProgress = {
  sequence: number;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type WorkerLogCreatePayload = CreateLogType;

export type WorkerPendaftaranEmailEvent =
  | 'created'
  | 'updated'
  | 'status_validated';

export type WorkerPendaftaranEmailPayload = {
  pendaftaranId: string;
  event: WorkerPendaftaranEmailEvent;
  revisiData?: {
    dokumen_revisi: { nama_dokumen: string; catatan: string }[];
    catatan_umum?: string;
  };
};

export type WorkerJadwalEmailAction = 'created' | 'updated';

export type WorkerJadwalEmailPayload = {
  jadwalId: string;
  action: WorkerJadwalEmailAction;
};

export type WorkerJadwalDraftGeneratePayload = {
  data: {
    tanggal_mulai: string | Date;
    list_mahasiswa: Array<{
      nim: string;
      kode_jenis: string;
      list_dosen: Array<{ nip: string; role: string }>;
    }>;
    tanggal_dikecualikan?: string[];
    catatan_tambahan?: string;
  };
  context: {
    actor_id: string;
    actor_type: LogActorType;
  };
};

export type WorkerConstraintDosenChatPayload = {
  email: string;
  message: string;
};

export type WorkerConstraintDosenChatUpdatePayload = {
  email: string;
  id: string;
  message: string;
};

export type WorkerJobPayloadMap = {
  [WorkerJobType.LOG_CREATE]: WorkerLogCreatePayload;
  [WorkerJobType.PENDAFTARAN_EMAIL_SEND]: WorkerPendaftaranEmailPayload;
  [WorkerJobType.JADWAL_EMAIL_SEND]: WorkerJadwalEmailPayload;
  [WorkerJobType.JADWAL_DRAFT_GENERATE]: WorkerJadwalDraftGeneratePayload;
  [WorkerJobType.CONSTRAINT_DOSEN_CHAT]: WorkerConstraintDosenChatPayload;
  [WorkerJobType.CONSTRAINT_DOSEN_CHAT_UPDATE]: WorkerConstraintDosenChatUpdatePayload;
};

export type WorkerJobPayload = WorkerJobPayloadMap[WorkerJobType];

export type WorkerJobBase<
  TType extends WorkerJobType = WorkerJobType,
  TPayload = WorkerJobPayload,
> = {
  id: string;
  type: TType;
  payload: TPayload;
  status: WorkerJobStatus;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  progress: WorkerJobProgress[];
  result?: unknown;
  error?: {
    message: string;
    statusCode?: number;
    details?: unknown;
    stack?: string;
  };
};

export type WorkerJob<TType extends WorkerJobType = WorkerJobType> =
  WorkerJobBase<TType, WorkerJobPayloadMap[TType]>;

export type WorkerJobPublic = Omit<WorkerJob, 'payload'> & {
  payload?: WorkerJobPayload;
};

export type EnqueueWorkerJobOptions = {
  maxAttempts?: number;
  ttlSeconds?: number;
};
