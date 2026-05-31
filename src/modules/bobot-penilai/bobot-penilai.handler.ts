import type { Context } from 'hono';
import { APIError } from '../../utils/api-error.util';
import { LogService } from '../log';
import BobotPenilaiService from './bobot-penilai.service';
import type {
  UpdateSingleBobotInput,
  UpsertBobotPenilaiInput,
} from './bobot-penilai.type';

export default class BobotPenilaiHandler {
  public static async getAll(c: Context) {
    return c.json(await BobotPenilaiService.getAll());
  }

  public static async getByJenisSeminar(c: Context) {
    const id_jenis_seminar = c.req.param('id_jenis_seminar');
    if (!id_jenis_seminar) {
      throw new APIError('Parameter id_jenis_seminar wajib diisi.', 400);
    }
    return c.json(
      await BobotPenilaiService.getByJenisSeminar(id_jenis_seminar)
    );
  }

  public static async getByKodeJenisSeminar(c: Context) {
    const kode = c.req.param('kode');
    if (!kode) {
      throw new APIError('Parameter kode wajib diisi.', 400);
    }
    return c.json(await BobotPenilaiService.getByKodeJenisSeminar(kode));
  }

  public static async upsertBatch(c: Context) {
    const body = (c.req as any).valid('json') as UpsertBobotPenilaiInput;
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(await BobotPenilaiService.upsertBatch(body, actor));
  }

  public static async updateSingle(c: Context) {
    const id = c.req.param('id');
    if (!id) throw new APIError('Parameter id wajib diisi.', 400);
    const body = (c.req as any).valid('json') as UpdateSingleBobotInput;
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(
      await BobotPenilaiService.updateSingle(id, body, actor)
    );
  }

  public static async deleteOne(c: Context) {
    const id = c.req.param('id');
    if (!id) throw new APIError('Parameter id wajib diisi.', 400);
    const actor = LogService.getActorContext(
      c.get('user') as Parameters<typeof LogService.getActorContext>[0]
    );
    return c.json(await BobotPenilaiService.deleteOne(id, actor));
  }
}
