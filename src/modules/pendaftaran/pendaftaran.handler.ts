import { Context } from 'hono';
import { StatusBerkas } from '@prisma/client';
import PendaftaranService from './pendaftaran.service';
import {
  CreatePendaftaranByMahasiswaType,
  UpdateDosenByKoordinatorType,
  UpdatePendaftaranByMahasiswaType,
  UpdateStatusBerkasType,
} from './pendaftaran.type';

export default class PendaftaranHandler {
  // Koordinator
  public static async getAllTahunAjaran(c: Context) {
    return c.json(await PendaftaranService.getAllTahunAjaran());
  }

  public static async getAll(c: Context) {
    const query = c.req.query();
    return c.json(
      await PendaftaranService.getAll({
        periode: query.periode as 'last_7_hari' | 'last_30_hari' | 'semua' | undefined,
        jenis_seminar: query.jenis_seminar,
        status_berkas: query.status_berkas as StatusBerkas | undefined,
        tahun_ajaran: query.tahun_ajaran,
        nim: query.nim,
        q: query.q,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      })
    );
  }

  public static async getDashboard(c: Context) {
    const query = c.req.query();
    return c.json(await PendaftaranService.getDashboard({
      tahun_ajaran: query.tahun_ajaran,
    }));
  }

  public static async getById(c: Context) {
    const { id } = c.req.param();
    return c.json(await PendaftaranService.getById(id));
  }

  public static async validateBerkas(c: Context) {
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdateStatusBerkasType;
    return c.json(await PendaftaranService.validateBerkas(id, body));
  }

  public static async updateDosenByKoordinator(c: Context) {
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdateDosenByKoordinatorType;
    return c.json(await PendaftaranService.updateDosenByKoordinator(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await PendaftaranService.delete(id));
  }

  // Mahasiswa
  public static async getMyAll(c: Context) {
    const { email } = c.get('user') as { email: string };
    return c.json(await PendaftaranService.getMyAll(email));
  }

  public static async getMyById(c: Context) {
    const { email } = c.get('user') as { email: string };
    const { id } = c.req.param();
    return c.json(await PendaftaranService.getMyById(email, id));
  }

  public static async createByMahasiswa(c: Context) {
    const { email } = c.get('user') as { email: string };
    const body = (await c.req.json()) as CreatePendaftaranByMahasiswaType;
    return c.json(await PendaftaranService.createByMahasiswa(email, body), 201);
  }

  public static async updateByMahasiswa(c: Context) {
    const { email } = c.get('user') as { email: string };
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdatePendaftaranByMahasiswaType;
    return c.json(
      await PendaftaranService.updateByMahasiswa(email, id, body)
    );
  }
}
