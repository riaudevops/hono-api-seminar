import { Context } from 'hono';
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
      role: user?.role,
      nip: user?.nip,
    };
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
}
