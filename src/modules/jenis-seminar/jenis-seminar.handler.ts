import type { Context } from 'hono';
import { APIError } from '../../utils/api-error.util';
import JenisSeminarService from './jenis-seminar.service';
import type { UpsertJenisSeminarType } from './jenis-seminar.type';

export default class JenisSeminarHandler {
  public static async getAll(c: Context) {
    const onlyAktif = c.req.query('aktif') === 'true';
    return c.json(await JenisSeminarService.getAll(onlyAktif));
  }

  public static async getJenisSeminarSaya(c: Context) {
    const user = c.get('user') as { email?: string } | undefined;
    const email = user?.email;
    if (!email) {
      throw new APIError('Email tidak ditemukan pada token.', 401);
    }
    return c.json(await JenisSeminarService.getJenisSeminarSaya(email));
  }

  public static async getByKode(c: Context) {
    const { kode } = c.req.param();
    return c.json(await JenisSeminarService.getByKode(kode));
  }

  public static async upsert(c: Context) {
    const body = (await c.req.json()) as UpsertJenisSeminarType;
    const result = await JenisSeminarService.upsert(body);
    return c.json(result, result.data.was_created ? 201 : 200);
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await JenisSeminarService.delete(id));
  }
}
