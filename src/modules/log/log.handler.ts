import type { Context } from 'hono';
import type {
  LogActionType,
  LogActorType,
  LogEntityType,
} from '@prisma/client';
import LogService from './log.service';
import type { GetLogParams } from './log.type';

export default class LogHandler {
  private static buildParams(query: Record<string, string>): GetLogParams {
    return {
      entity_type: query.entity_type as LogEntityType | undefined,
      entity_id: query.entity_id,
      actor_id: query.actor_id,
      actor_type: query.actor_type as LogActorType | undefined,
      action: query.action as LogActionType | undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      page: query.page ? Number(query.page) : undefined,
      q: query.q,
      start_date: query.start_date,
      end_date: query.end_date,
    };
  }

  public static async getAll(c: Context) {
    return c.json(
      await LogService.getAll(LogHandler.buildParams(c.req.query()))
    );
  }

  public static async getLogSaya(c: Context) {
    const user = c.get('user') as
      | {
          id?: string;
          email?: string;
          role?: string;
          nip?: string;
          nim?: string;
        }
      | undefined;
    const context = LogService.getActorContext(user);

    return c.json(
      await LogService.getAll({
        ...LogHandler.buildParams(c.req.query()),
        actor_id: context.actor_id,
        actor_type: context.actor_type,
      })
    );
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
