import type { Context } from 'hono';
import { APIError } from '../../utils/api-error.util';
import MahasiswaService from './mahasiswa.service';
import type {
  GetAllMahasiswaQuery,
  UpdateDataSayaType,
} from './mahasiswa.type';

export default class MahasiswaHandler {
  public static async getAll(c: Context) {
    const query = (c.req as any).valid('query') as GetAllMahasiswaQuery;
    return c.json(await MahasiswaService.getAll(query));
  }

  public static async getStatistics(c: Context) {
    return c.json(await MahasiswaService.getStatistics());
  }

  public static async getDetail(c: Context) {
    const nim = c.req.param('nim');
    if (!nim) throw new APIError('Parameter nim wajib diisi.', 400);
    return c.json(await MahasiswaService.getDetailByNim(nim));
  }

  public static async getDataSaya(c: Context) {
    const { email } = c.get('user') as { email?: string };
    if (!email) throw new APIError('Email tidak ditemukan di token.', 401);
    return c.json(await MahasiswaService.getDataSaya(email));
  }

  public static async updateDataSaya(c: Context) {
    const { email } = c.get('user') as { email?: string };
    if (!email) throw new APIError('Email tidak ditemukan di token.', 401);
    const body = (await c.req.json()) as UpdateDataSayaType;
    return c.json(await MahasiswaService.updateDataSaya(email, body));
  }
}
