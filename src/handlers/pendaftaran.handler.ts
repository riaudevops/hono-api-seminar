import { Context } from 'hono';
import PendaftaranService from '../services/pendaftaran.service';

export default class PendaftaranHandler {
  public static async getDashboard(c: Context) {
    return c.json(await PendaftaranService.getDashboard());
  }

  public static async getAll(c: Context) {
    const dateFilter = c.req.query('date') as '7' | '30' | 'all' | undefined;
    const jenisSeminar = c.req.query('jenis_seminar');
    const search = c.req.query('q');
    const { page = 1, limit = 10 } = c.req.query();
    return c.json(
      await PendaftaranService.getAll(
        dateFilter || 'all',
        jenisSeminar || undefined,
        search || undefined,
        Number(page),
        Number(limit)
      )
    );
  }

  public static async getById(c: Context) {
    const { id } = c.req.param();
    return c.json(await PendaftaranService.getById(id));
  }

  public static async createByMahasiswa(c: Context) {
    const { email } = c.get('user');
    const data = c.req.valid('json');
    return c.json(await PendaftaranService.createByEmail(email, data), 201);
  }

  public static async updateByMahasiswa(c: Context) {
    const { id } = c.req.param();
    const { email } = c.get('user');
    const data = c.req.valid('json');
    return c.json(await PendaftaranService.updateByEmail(email, id, data));
  }

  public static async validateBerkas(c: Context) {
    const { id } = c.req.param();
    const data = c.req.valid('json');
    return c.json(await PendaftaranService.validateBerkas(id, data));
  }
}
