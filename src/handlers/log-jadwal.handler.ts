import { Context } from 'hono';
import LogJadwalService from '../services/log-jadwal.service';
import { LogActionType, LogActorType } from '@prisma/client';

export default class LogJadwalHandler {
  public static async getAll(c: Context) {
    const filters = {
      jadwal_id: c.req.query('jadwal_id'),
      actor_id: c.req.query('actor_id'),
      actor_type: c.req.query('actor_type') as LogActorType | undefined,
      action: c.req.query('action') as LogActionType | undefined,
    };

    return c.json(await LogJadwalService.getAll(filters));
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogJadwalService.get(id));
  }

  public static async create(c: Context) {
    const body = await c.req.json();
    return c.json(await LogJadwalService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    return c.json(await LogJadwalService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogJadwalService.delete(id));
  }
}
