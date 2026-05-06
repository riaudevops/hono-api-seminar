import { Context } from 'hono';
import { APIError } from '../utils/api-error.util';
import MahasiswaService from '../services/mahasiswa.service';
import { spssInfrastructure } from '../infrastructures/spss.infrastructure';

export default class MahasiswaHandler {
  public static async getMe(c: Context) {
    const { email } = c.get('user');
    if (!email) throw new APIError('Email tidak ditemukan.', 404);
    return c.json(await MahasiswaService.getMe(email));
  }

  public static async getAll(c: Context) {
    const { page = 1, limit = 10 } = c.req.query();
    const sortBy = c.req.query('sortBy') as 'asc' | 'desc' | undefined;
    return c.json(
      await MahasiswaService.getAll(Number(page), Number(limit), sortBy)
    );
  }

  public static async get(c: Context) {
    const { nim } = c.req.param();
    return c.json(await MahasiswaService.get(nim));
  }

  public static async search(c: Context) {
    const query = c.req.query('q');
    const angkatan = c.req.query('angkatan');
    const sortBy = c.req.query('sortBy') as 'asc' | 'desc' | undefined;
    const { page = 1, limit = 10 } = c.req.query();

    return c.json(
      await MahasiswaService.search(
        query?.trim(),
        angkatan ? parseInt(angkatan) : undefined,
        sortBy,
        Number(page),
        Number(limit)
      )
    );
  }

  public static async getAngkatanList(c: Context) {
    return c.json(await MahasiswaService.getAngkatanList());
  }

  public static async getPendaftaranSaya(c: Context) {
    const { email } = c.get('user');
    if (!email) throw new APIError('Email tidak ditemukan.', 404);
    return c.json(await MahasiswaService.getPendaftaranSaya(email));
  }

  public static async refreshSpreadsheet(c: Context) {
    spssInfrastructure.clearCache();
    const freshData = await spssInfrastructure.getDataMahasiswa();
    return c.json({
      response: true,
      message: `Cache spreadsheet berhasil di-refresh. ${freshData.length} data mahasiswa dimuat.`,
      data: { totalRows: freshData.length },
    });
  }
}
