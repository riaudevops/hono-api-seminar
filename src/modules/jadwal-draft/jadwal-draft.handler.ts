import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import JadwalDraftService from './jadwal-draft.service';
import { APIError } from '../../utils/api-error.util';
import { createLogger } from '../../utils/logger.util';
import { LogActorType, StatusJadwalDraft } from '@prisma/client';

const logger = createLogger('JadwalDraftHandler');

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

  public static async generateStream(c: Context) {
    const data = await c.req.json();
    const context = extractContext(c);
    const abortController = new AbortController();

    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isClosed = false;

      const sendEvent = async (event: string, payload: Record<string, unknown>) => {
        if (isClosed) return;
        await stream.writeSSE({
          event,
          data: JSON.stringify(payload),
        });
      };

      logger.info('SSE stream connected');
      await sendEvent('connected', {
        message: 'Stream generate jadwal terhubung',
        timestamp: new Date().toISOString(),
      });

      const heartbeat = setInterval(() => {
        void sendEvent('heartbeat', {
          message: 'Generate jadwal masih diproses',
          timestamp: new Date().toISOString(),
        });
      }, 5000);

      stream.onAbort(() => {
        isClosed = true;
        abortController.abort();
        clearInterval(heartbeat);
        logger.info('SSE stream aborted');
      });

      try {
        await JadwalDraftService.generate(
          data,
          context,
          sendEvent,
          abortController.signal
        );
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          await sendEvent('error', {
            response: false,
            message: err.message || 'Gagal generate jadwal draft',
            statusCode: err.statusCode || 500,
          });
        }
      } finally {
        isClosed = true;
        clearInterval(heartbeat);
        logger.info('SSE stream finished', {
          aborted: abortController.signal.aborted,
        });
      }
    });
  }

  public static async getDrafts(c: Context) {
    const batch_id = c.req.query('batch_id');
    const statusRaw = c.req.query('status');
    const status = statusRaw as StatusJadwalDraft | undefined;
    return c.json(
      await JadwalDraftService.getDrafts({ batch_id, status })
    );
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
