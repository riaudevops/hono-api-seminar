import { Context } from 'hono';
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
    return c.json(await ConstraintDosenService.chat(email, message), 201);
  }
}
