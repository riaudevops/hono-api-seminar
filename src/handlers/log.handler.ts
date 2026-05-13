import { Context } from 'hono';
import LogService from '../services/log.service';
import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';

export default class LogHandler {
  public static async getAll(c: Context) {
    const filters = {
      entity_type: c.req.query('entity_type') as LogEntityType | undefined,
      entity_id: c.req.query('entity_id'),
      actor_id: c.req.query('actor_id'),
      actor_type: c.req.query('actor_type') as LogActorType | undefined,
      action: c.req.query('action') as LogActionType | undefined,
    };
    const limit = c.req.query('limit')
      ? Number(c.req.query('limit'))
      : undefined;

    return c.json(await LogService.getAll(filters, limit));
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogService.get(id));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogService.delete(id));
  }
}
