import { Context } from 'hono';
import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import LogService from './log.service';
import { GetLogParams } from './log.type';

export default class LogHandler {
  public static async getAll(c: Context) {
    const query = c.req.query();
    const params: GetLogParams = {
      entity_type: query.entity_type as LogEntityType | undefined,
      entity_id: query.entity_id,
      actor_id: query.actor_id,
      actor_type: query.actor_type as LogActorType | undefined,
      action: query.action as LogActionType | undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      start_date: query.start_date,
      end_date: query.end_date,
    };

    return c.json(await LogService.getAll(params));
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
