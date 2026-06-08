import crypto from 'crypto';
import { config } from '../../core/config';
import redisService from '../../infrastructures/redis.infrastructure';
import { APIError } from '../../utils/api-error.util';
import { createLogger } from '../../utils/logger.util';
import {
  WORKER_JOB_ACTIVE_KEY,
  WORKER_JOB_DEFAULT_TTL_SECONDS,
  WORKER_JOB_KEY_PREFIX,
  WORKER_JOB_MAX_PROGRESS_EVENTS,
  WORKER_JOB_QUEUE_KEY,
  type EnqueueWorkerJobOptions,
  type WorkerJob,
  type WorkerJobPayload,
  type WorkerJobPayloadMap,
  type WorkerJobProgress,
  type WorkerJobPublic,
  WorkerJobStatus,
  type WorkerJobType,
} from './worker-job.type';

const logger = createLogger('WorkerJobService');

type RawRedisClient = NonNullable<
  Awaited<ReturnType<typeof redisService.getRawClient>>
>;

function nowIso() {
  return new Date().toISOString();
}

function buildJobId(type: WorkerJobType) {
  const compactType = type.replace(/[^a-z0-9]+/gi, '-');
  return `${compactType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function serializeJob(job: WorkerJobBaseForStorage) {
  return JSON.stringify(job);
}

type WorkerJobBaseForStorage = Omit<WorkerJob, 'payload'> & {
  payload: WorkerJobPayload;
};

function parseJob(raw: string | null): WorkerJob | null {
  if (!raw) return null;
  return JSON.parse(raw) as WorkerJob;
}

export default class WorkerJobService {
  private static jobKey(id: string) {
    return redisService.namespacedKey(`${WORKER_JOB_KEY_PREFIX}${id}`);
  }

  private static queueKey() {
    return redisService.namespacedKey(WORKER_JOB_QUEUE_KEY);
  }

  private static activeKey() {
    return redisService.namespacedKey(WORKER_JOB_ACTIVE_KEY);
  }

  private static ttlSeconds() {
    return config.redis.workerJobTtlSeconds ?? WORKER_JOB_DEFAULT_TTL_SECONDS;
  }

  private static async getClient(): Promise<RawRedisClient> {
    const client = await redisService.getRawClient();
    if (!client) {
      throw new APIError(
        'Redis tidak tersedia. Worker queue membutuhkan Redis.',
        503
      );
    }
    return client;
  }

  public static async enqueue<TType extends WorkerJobType>(
    type: TType,
    payload: WorkerJobPayloadMap[TType],
    options: EnqueueWorkerJobOptions = {}
  ): Promise<WorkerJobPublic> {
    const client = await WorkerJobService.getClient();
    const timestamp = nowIso();
    const job: WorkerJob<TType> = {
      id: buildJobId(type),
      type,
      payload,
      status: WorkerJobStatus.QUEUED,
      attempts: 0,
      max_attempts: options.maxAttempts ?? 3,
      created_at: timestamp,
      updated_at: timestamp,
      progress: [],
    };

    const ttlSeconds = options.ttlSeconds ?? WorkerJobService.ttlSeconds();
    await client
      .multi()
      .set(WorkerJobService.jobKey(job.id), serializeJob(job), 'EX', ttlSeconds)
      .lpush(WorkerJobService.queueKey(), job.id)
      .exec();

    logger.info('Worker job enqueued', { jobId: job.id, type });
    return WorkerJobService.toPublicJob(job);
  }

  public static async get(id: string, includePayload = false) {
    const client = await WorkerJobService.getClient();
    const job = parseJob(await client.get(WorkerJobService.jobKey(id)));
    if (!job) throw new APIError('Job worker tidak ditemukan.', 404);
    return WorkerJobService.toPublicJob(job, includePayload);
  }

  public static async getInternal(id: string): Promise<WorkerJob | null> {
    const client = await WorkerJobService.getClient();
    return parseJob(await client.get(WorkerJobService.jobKey(id)));
  }

  public static async waitForNextJob(
    timeoutSeconds = 5
  ): Promise<WorkerJob | null> {
    const client = await WorkerJobService.getClient();
    const result = await client.brpop(
      WorkerJobService.queueKey(),
      timeoutSeconds
    );
    const jobId = result?.[1];
    if (!jobId) return null;

    const job = await WorkerJobService.getInternal(jobId);
    if (!job) {
      logger.warn('Worker popped missing job', { jobId });
      return null;
    }

    await client.sadd(WorkerJobService.activeKey(), jobId);
    return job;
  }

  public static async markRunning(id: string): Promise<WorkerJob> {
    return WorkerJobService.mutateJob(id, (job) => {
      const timestamp = nowIso();
      job.status = WorkerJobStatus.RUNNING;
      job.attempts += 1;
      job.started_at = job.started_at ?? timestamp;
      job.updated_at = timestamp;
      delete job.error;
      return job;
    });
  }

  public static async appendProgress(
    id: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<WorkerJob> {
    return WorkerJobService.mutateJob(id, (job) => {
      const progressEvent: WorkerJobProgress = {
        sequence: (job.progress?.at(-1)?.sequence ?? 0) + 1,
        event,
        payload,
        timestamp: nowIso(),
      };
      job.progress = [...(job.progress ?? []), progressEvent].slice(
        -WORKER_JOB_MAX_PROGRESS_EVENTS
      );
      job.updated_at = progressEvent.timestamp;
      return job;
    });
  }

  public static async markCompleted(
    id: string,
    result: unknown
  ): Promise<WorkerJob> {
    const client = await WorkerJobService.getClient();
    const job = await WorkerJobService.mutateJob(id, (current) => {
      const timestamp = nowIso();
      current.status = WorkerJobStatus.COMPLETED;
      current.result = result;
      current.completed_at = timestamp;
      current.updated_at = timestamp;
      delete current.error;
      return current;
    });
    await client.srem(WorkerJobService.activeKey(), id);
    return job;
  }

  public static async markFailed(
    id: string,
    error: unknown,
    requeue = false
  ): Promise<WorkerJob> {
    const client = await WorkerJobService.getClient();
    const job = await WorkerJobService.mutateJob(id, (current) => {
      const timestamp = nowIso();
      current.status = requeue
        ? WorkerJobStatus.QUEUED
        : WorkerJobStatus.FAILED;
      current.failed_at = requeue ? undefined : timestamp;
      current.updated_at = timestamp;
      current.error = WorkerJobService.serializeError(error);
      return current;
    });

    if (requeue) {
      await client
        .multi()
        .srem(WorkerJobService.activeKey(), id)
        .lpush(WorkerJobService.queueKey(), id)
        .exec();
    } else {
      await client.srem(WorkerJobService.activeKey(), id);
    }

    return job;
  }

  public static shouldRetry(job: WorkerJob) {
    return job.attempts < job.max_attempts;
  }

  private static async mutateJob(
    id: string,
    mutator: (job: WorkerJob) => WorkerJob
  ): Promise<WorkerJob> {
    const client = await WorkerJobService.getClient();
    const key = WorkerJobService.jobKey(id);
    const job = parseJob(await client.get(key));
    if (!job) throw new APIError('Job worker tidak ditemukan.', 404);

    const updated = mutator(job);
    await client.set(
      key,
      serializeJob(updated),
      'EX',
      WorkerJobService.ttlSeconds()
    );
    return updated;
  }

  private static serializeError(error: unknown) {
    if (error instanceof Error) {
      const details = (error as { details?: unknown }).details;
      return {
        message: error.message,
        statusCode: (error as any).statusCode,
        ...(details !== undefined ? { details } : {}),
        stack: error.stack,
      };
    }
    return { message: String(error) };
  }

  private static toPublicJob(
    job: WorkerJob,
    includePayload = false
  ): WorkerJobPublic {
    const { payload, ...publicJob } = job;
    return includePayload ? { ...publicJob, payload } : publicJob;
  }
}
