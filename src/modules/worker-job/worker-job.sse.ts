import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createLogger } from '../../utils/logger.util';
import WorkerJobService from './worker-job.service';
import { WorkerJobStatus } from './worker-job.type';

const logger = createLogger('WorkerJobSSE');

type StreamWorkerJobOptions = {
  jobId: string;
  connectedMessage: string;
  heartbeatMessage: string;
  pollIntervalMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function streamWorkerJob(c: Context, options: StreamWorkerJobOptions) {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;

  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    let isClosed = false;
    let lastProgressSequence = 0;
    let lastStatus: WorkerJobStatus | undefined;

    const sendEvent = async (
      event: string,
      payload: Record<string, unknown>
    ) => {
      if (isClosed) return;
      await stream.writeSSE({
        event,
        data: JSON.stringify(payload),
      });
    };

    const heartbeat = setInterval(() => {
      void sendEvent('heartbeat', {
        job_id: options.jobId,
        message: options.heartbeatMessage,
        timestamp: new Date().toISOString(),
      });
    }, 5_000);

    stream.onAbort(() => {
      isClosed = true;
      clearInterval(heartbeat);
      logger.info('Worker job SSE aborted', { jobId: options.jobId });
    });

    try {
      await sendEvent('connected', {
        job_id: options.jobId,
        message: options.connectedMessage,
        timestamp: new Date().toISOString(),
      });

      while (!isClosed) {
        const job = await WorkerJobService.get(options.jobId);

        if (job.status !== lastStatus) {
          lastStatus = job.status;
          await sendEvent('job:status', {
            job_id: options.jobId,
            status: job.status,
            attempts: job.attempts,
            max_attempts: job.max_attempts,
            message: `Status job: ${job.status}`,
          });
        }

        const progress = job.progress ?? [];
        for (const progressEvent of progress) {
          if (progressEvent.sequence <= lastProgressSequence) continue;
          await sendEvent(progressEvent.event, {
            job_id: options.jobId,
            ...progressEvent.payload,
            timestamp: progressEvent.timestamp,
          });
          lastProgressSequence = progressEvent.sequence;
        }

        if (job.status === WorkerJobStatus.COMPLETED) {
          await sendEvent('job:completed', {
            job_id: options.jobId,
            response: true,
            result: job.result,
            completed_at: job.completed_at,
          });
          break;
        }

        if (job.status === WorkerJobStatus.FAILED) {
          await sendEvent('job:failed', {
            job_id: options.jobId,
            response: false,
            error: job.error,
            failed_at: job.failed_at,
          });
          break;
        }

        await sleep(pollIntervalMs);
      }
    } catch (err: any) {
      if (!isClosed) {
        await sendEvent('error', {
          job_id: options.jobId,
          response: false,
          message: err.message || 'Gagal memantau status job worker',
          statusCode: err.statusCode || 500,
        });
      }
    } finally {
      isClosed = true;
      clearInterval(heartbeat);
      logger.info('Worker job SSE finished', { jobId: options.jobId });
    }
  });
}
