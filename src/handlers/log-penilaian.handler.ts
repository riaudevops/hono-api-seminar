import { Context } from 'hono';
import LogPenilaianService from '../services/log-penilaian.service';
import { LogActionType, LogActorType } from '@prisma/client';

export default class LogPenilaianHandler {
  public static async getAll(c: Context) {
    const filters = {
      id_jadwal: c.req.query('id_jadwal'),
      id_komponen_penilaian: c.req.query('id_komponen_penilaian'),
      actor_id: c.req.query('actor_id'),
      actor_type: c.req.query('actor_type') as LogActorType | undefined,
      action: c.req.query('action') as LogActionType | undefined,
    };

    return c.json(await LogPenilaianService.getAll(filters));
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogPenilaianService.get(id));
  }

  public static async create(c: Context) {
    const body = await c.req.json();
    return c.json(await LogPenilaianService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    return c.json(await LogPenilaianService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogPenilaianService.delete(id));
  }
}
