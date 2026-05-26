import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import ConstraintDosenService from './constraint-dosen.service';
import { APIError } from '../../utils/api-error.util';

function extractEmail(c: Context): string {
  const userPayload = c.get('user');
  if (
    !userPayload ||
    typeof userPayload !== 'object' ||
    !('email' in userPayload)
  ) {
    throw new APIError(
      'Informasi otentikasi tidak ditemukan atau tidak valid.',
      401
    );
  }
  const email = userPayload.email as string;
  if (!email) throw new APIError('Email tidak ditemukan', 401);
  return email;
}

async function streamConstraintChat(
  c: Context,
  runner: (
    emit: (event: string, payload: Record<string, unknown>) => Promise<void>,
    signal: AbortSignal
  ) => Promise<unknown>,
  connectedMessage: string,
  heartbeatMessage: string
) {
  const abortController = new AbortController();

  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    let isClosed = false;

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

    await sendEvent('connected', {
      message: connectedMessage,
      timestamp: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      void sendEvent('heartbeat', {
        message: heartbeatMessage,
        timestamp: new Date().toISOString(),
      });
    }, 5000);

    stream.onAbort(() => {
      isClosed = true;
      abortController.abort();
      clearInterval(heartbeat);
    });

    try {
      await runner(sendEvent, abortController.signal);
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        await sendEvent('error', {
          response: false,
          message: err.message || 'Gagal memproses constraint dari chat',
          statusCode: err.statusCode || 500,
        });
      }
    } finally {
      isClosed = true;
      clearInterval(heartbeat);
    }
  });
}

export default class ConstraintDosenHandler {
  public static async getAll(c: Context) {
    const email = extractEmail(c);
    return c.json(await ConstraintDosenService.getAll(email));
  }

  public static async get(c: Context) {
    const email = extractEmail(c);
    const { id } = c.req.param();
    return c.json(await ConstraintDosenService.get(email, id));
  }

  public static async create(c: Context) {
    const email = extractEmail(c);
    const data = await c.req.json();
    return c.json(await ConstraintDosenService.create(email, data), 201);
  }

  public static async update(c: Context) {
    const email = extractEmail(c);
    const { id } = c.req.param();
    const data = await c.req.json();
    return c.json(await ConstraintDosenService.update(email, id, data));
  }

  public static async delete(c: Context) {
    const email = extractEmail(c);
    const { id } = c.req.param();
    return c.json(await ConstraintDosenService.delete(email, id));
  }

  public static async chat(c: Context) {
    const email = extractEmail(c);
    const { message } = await c.req.json();

    return streamConstraintChat(
      c,
      (emit, signal) =>
        ConstraintDosenService.chat(email, message, emit, signal),
      'Stream chat constraint terhubung',
      'Chat constraint masih diproses'
    );
  }

  public static async chatUpdate(c: Context) {
    const email = extractEmail(c);
    const { id } = c.req.param();
    const { message } = await c.req.json();

    return streamConstraintChat(
      c,
      (emit, signal) =>
        ConstraintDosenService.chatUpdate(email, id, message, emit, signal),
      'Stream update constraint terhubung',
      'Update constraint masih diproses'
    );
  }
}
