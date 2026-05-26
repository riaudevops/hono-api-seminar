import type { Context } from 'hono';
import { APIError } from '../../utils/api-error.util';
import { LogService } from '../log';
import BobotPenilaianRoleService from './bobot-penilaian-role.service';
import type {
  UpdateSingleBobotInput,
  UpsertBobotPenilaianRoleInput,
} from './bobot-penilaian-role.type';

export default class BobotPenilaianRoleHandler {
  public static async getAll(c: Context) {
    return c.json(await BobotPenilaianRoleService.getAll());
  }

  public static async getByJenisSeminar(c: Context) {
    const id_jenis_seminar = c.req.param('id_jenis_seminar');
    if (!id_jenis_seminar) {
      throw new APIError('Parameter id_jenis_seminar wajib diisi.', 400);
    }
    return c.json(
      await BobotPenilaianRoleService.getByJenisSeminar(id_jenis_seminar)
    );
  }

  public static async upsertBatch(c: Context) {
    const body = (c.req as any).valid('json') as UpsertBobotPenilaianRoleInput;
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(await BobotPenilaianRoleService.upsertBatch(body, actor));
  }

  public static async updateSingle(c: Context) {
    const id = c.req.param('id');
    if (!id) throw new APIError('Parameter id wajib diisi.', 400);
    const body = (c.req as any).valid('json') as UpdateSingleBobotInput;
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(
      await BobotPenilaianRoleService.updateSingle(id, body, actor)
    );
  }

  public static async deleteOne(c: Context) {
    const id = c.req.param('id');
    if (!id) throw new APIError('Parameter id wajib diisi.', 400);
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(await BobotPenilaianRoleService.deleteOne(id, actor));
  }
}
