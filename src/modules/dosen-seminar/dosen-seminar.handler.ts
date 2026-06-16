import type { Context } from 'hono';
import DosenSeminarService from './dosen-seminar.service';
import { DosenModuleRepository as DosenRepository } from '../dosen';
import { APIError } from '../../utils/api-error.util';

async function extractNip(c: Context): Promise<string> {
  const userPayload = c.get('user');
  if (
    !userPayload ||
    typeof userPayload !== 'object' ||
    !('email' in userPayload)
  ) {
    throw new APIError(
      'Informasi otentikasi tidak ditemukan atau tidak valid.',
      401
    );
  }
  const email = userPayload.email as string;
  if (!email) throw new APIError('Email tidak ditemukan', 401);

  const dosen = await DosenRepository.findByEmail(email);
  if (!dosen) {
    throw new APIError('Data dosen tidak ditemukan untuk email ini.', 404);
  }
  return dosen.nip;
}

export default class DosenSeminarHandler {
  public static async getJadwalSeminar(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getJadwalSeminar(nip));
  }

  public static async getStats(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getStats(nip));
  }

  public static async getKomponenPenilaian(c: Context) {
    return c.json(
      await DosenSeminarService.getKomponenPenilaian({
        id_jenis_seminar: c.req.query('id_jenis_seminar'),
      })
    );
  }

  public static async getKomponenPenilaianSaya(c: Context) {
    const nip = await extractNip(c);
    const query = c.req.query() as {
      id_jenis_seminar?: string;
      jadwal_id?: string;
    };
    return c.json(
      await DosenSeminarService.getKomponenPenilaianSaya(nip, {
        id_jenis_seminar: query.id_jenis_seminar ?? '',
        jadwal_id: query.jadwal_id ?? '',
      })
    );
  }

  public static async getPenilaianByJadwal(c: Context) {
    const jadwal_id = c.req.query('jadwal_id');
    if (!jadwal_id) {
      throw new APIError('Parameter jadwal_id wajib diisi', 400);
    }
    return c.json(await DosenSeminarService.getPenilaianByJadwal(jadwal_id));
  }

  public static async submitNilai(c: Context) {
    const nip = await extractNip(c);
    const body = await c.req.json();
    return c.json(await DosenSeminarService.submitNilai(nip, body));
  }

  public static async getLogPenilaian(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getLogPenilaian(nip));
  }

  public static async getConstraints(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getConstraints(nip));
  }

  public static async createConstraint(c: Context) {
    const nip = await extractNip(c);
    const data = await c.req.json();
    return c.json(await DosenSeminarService.createConstraint(nip, data), 201);
  }
}
