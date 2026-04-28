import { Context } from 'hono';
import DosenSeminarService from '../services/dosen-seminar.service';
import DosenRepository from '../repositories/dosen.repository';
import { APIError } from '../utils/api-error.util';

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
  /** #1 GET /api/dosen/seminar/jadwal */
  public static async getJadwalSeminar(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getJadwalSeminar(nip));
  }

  /** #2 GET /api/dosen/seminar/stats */
  public static async getStats(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getStats(nip));
  }

  /** #3 GET /api/dosen/seminar/komponen-penilaian */
  public static async getKomponenPenilaian(c: Context) {
    return c.json(await DosenSeminarService.getKomponenPenilaian());
  }

  /** #4 GET /api/dosen/seminar/penilaian?jadwal_id= */
  public static async getPenilaianByJadwal(c: Context) {
    const jadwal_id = c.req.query('jadwal_id');
    if (!jadwal_id) {
      throw new APIError('Parameter jadwal_id wajib diisi', 400);
    }
    return c.json(await DosenSeminarService.getPenilaianByJadwal(jadwal_id));
  }

  /** #5 POST /api/dosen/seminar/penilaian */
  public static async submitNilai(c: Context) {
    const nip = await extractNip(c);
    const body = await c.req.json();
    return c.json(await DosenSeminarService.submitNilai(nip, body));
  }

  /** #6 GET /api/dosen/seminar/log-penilaian */
  public static async getLogPenilaian(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getLogPenilaian(nip));
  }

  /** #7 GET /api/dosen/constraints */
  public static async getConstraints(c: Context) {
    const nip = await extractNip(c);
    return c.json(await DosenSeminarService.getConstraints(nip));
  }

  /** #8 POST /api/dosen/constraints */
  public static async createConstraint(c: Context) {
    const nip = await extractNip(c);
    const data = await c.req.json();
    return c.json(await DosenSeminarService.createConstraint(nip, data), 201);
  }
}
