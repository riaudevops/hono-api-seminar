import type { Context } from 'hono';
import PenilaianService from './penilaian.service';
import { APIError } from '../../utils/api-error.util';
import { LogActorType, LogEntityType } from '@prisma/client';
import { LogService } from '../log';

export default class PenilaianHandler {
  public static async getJadwalToAssess(c: Context) {
    const userPayload = c.get('user');
    if (
      !userPayload ||
      typeof userPayload !== 'object' ||
      !('nip' in userPayload)
    ) {
      throw new APIError(
        'Informasi NIP dosen tidak ditemukan. Anda bukan Dosen.',
        403
      );
    }
    const nip = userPayload.nip as string;
    return c.json(await PenilaianService.getJadwalToAssess(nip));
  }

  public static async getNilaiByJadwal(c: Context) {
    const { id_jadwal } = c.req.param();
    return c.json(await PenilaianService.getNilaiByJadwal(id_jadwal));
  }

  public static async getLogsByJadwal(c: Context) {
    const { id_jadwal } = c.req.param();
    return c.json(
      await LogService.getAll({
        entity_type: LogEntityType.PENILAIAN,
        entity_id: id_jadwal,
      })
    );
  }

  public static async submitPenilaian(c: Context) {
    const { id } = c.req.param(); // id_penilaian
    const data = await c.req.json();

    const userPayload = c.get('user');
    if (
      !userPayload ||
      typeof userPayload !== 'object' ||
      !('nip' in userPayload)
    ) {
      throw new APIError('Informasi otentikasi Dosen tidak valid.', 403);
    }
    const nip = userPayload.nip as string;

    const context = {
      actor_id: nip,
      actor_type: LogActorType.DOSEN,
    };

    return c.json(
      await PenilaianService.submitPenilaian(id, nip, data.details, context)
    );
  }
}
