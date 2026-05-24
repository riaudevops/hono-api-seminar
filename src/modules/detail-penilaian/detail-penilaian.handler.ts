import { Context } from 'hono';
import { LogActorType } from '@prisma/client';
import { LogService } from '../log';
import DetailPenilaianService from './detail-penilaian.service';
import { UpsertDetailPenilaianInput } from './detail-penilaian.type';

export default class DetailPenilaianHandler {
  private static getActorContext(c: Context) {
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

    return {
      ...context,
      actor_type: user?.nip ? LogActorType.DOSEN : context.actor_type,
      role: user?.role,
      nip: user?.nip,
    };
  }

  public static async getDetailPenilaianSaya(c: Context) {
    const context = DetailPenilaianHandler.getActorContext(c);

    return c.json(await DetailPenilaianService.getDetailPenilaianSaya(context));
  }

  public static async getByPenilaianId(c: Context) {
    const { id_penilaian } = c.req.param();
    const context = DetailPenilaianHandler.getActorContext(c);

    return c.json(
      await DetailPenilaianService.getByPenilaianId(id_penilaian, context)
    );
  }

  public static async upsertByPenilaianId(c: Context) {
    const { id_penilaian } = c.req.param();
    const data = (c.req as any).valid('json') as UpsertDetailPenilaianInput;
    const context = DetailPenilaianHandler.getActorContext(c);

    return c.json(
      await DetailPenilaianService.upsertByPenilaianId(
        id_penilaian,
        data,
        context
      )
    );
  }

  public static async getRekapByJadwal(c: Context) {
    const { id_jadwal } = c.req.param();
    return c.json(await DetailPenilaianService.getRekapByJadwal(id_jadwal));
  }

  public static async getPenilaianSaya(c: Context) {
    const context = DetailPenilaianHandler.getActorContext(c);
    return c.json(await DetailPenilaianService.getPenilaianSaya(context));
  }

  public static async postPenilaianSaya(c: Context) {
    const data = (c.req as any).valid('json') as UpsertDetailPenilaianInput;
    const context = DetailPenilaianHandler.getActorContext(c);
    const id_penilaian = c.req.query('id_penilaian');

    if (!id_penilaian) {
      return c.json({ response: false, message: 'Query param id_penilaian wajib diisi' }, 400);
    }

    return c.json(
      await DetailPenilaianService.upsertByPenilaianId(id_penilaian, data, context)
    );
  }

  public static async putPenilaianSaya(c: Context) {
    const { id } = c.req.param();
    const data = (c.req as any).valid('json') as UpsertDetailPenilaianInput;
    const context = DetailPenilaianHandler.getActorContext(c);

    return c.json(
      await DetailPenilaianService.upsertByPenilaianId(id, data, context)
    );
  }
}
