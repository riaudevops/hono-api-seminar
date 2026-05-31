import type { Context } from 'hono';
import { LogEntityType } from '@prisma/client';
import JadwalService from './jadwal.service';
import { APIError } from '../../utils/api-error.util';
import { LogService } from '../log';

export default class JadwalHandler {
  private static getUserPayload(c: Context) {
    const userPayload = c.get('user');
    if (!userPayload || typeof userPayload !== 'object') {
      throw new APIError(
        'Informasi otentikasi tidak ditemukan atau tidak valid.',
        401
      );
    }

    return userPayload as {
      id?: string;
      email?: string;
      role?: string;
      nip?: string;
      nim?: string;
    };
  }

  private static getEmail(c: Context) {
    const userPayload = JadwalHandler.getUserPayload(c);
    if (!userPayload.email) throw new APIError('Email tidak ditemukan', 404);
    return userPayload.email;
  }

  public static async getJadwalDosenSaya(c: Context) {
    const email = JadwalHandler.getEmail(c);
    return c.json(await JadwalService.getJadwalDosenSaya(email, c.req.query()));
  }

  public static async getStatistikDosenSaya(c: Context) {
    const email = JadwalHandler.getEmail(c);
    return c.json(await JadwalService.getStatistikDosenSaya(email));
  }

  public static async getJadwalMahasiswaSaya(c: Context) {
    const email = JadwalHandler.getEmail(c);
    return c.json(await JadwalService.getJadwalMahasiswaSaya(email));
  }

  public static async getJadwalMahasiswaSayaById(c: Context) {
    const email = JadwalHandler.getEmail(c);
    const { id } = c.req.param();
    return c.json(await JadwalService.getJadwalMahasiswaSayaById(email, id));
  }

  public static async getAll(c: Context) {
    return c.json(await JadwalService.getAll(c.req.query() as any));
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await JadwalService.get(id));
  }

  public static async getLogs(c: Context) {
    const { id } = c.req.param();
    const query = c.req.query() as any;
    return c.json(
      await LogService.getAll({
        entity_type: LogEntityType.JADWAL,
        entity_id: id,
        ...query,
      })
    );
  }

  public static async post(c: Context) {
    const data = await c.req.json();
    const context = LogService.getActorContext(JadwalHandler.getUserPayload(c));
    return c.json(await JadwalService.post(data, context), 201);
  }

  public static async put(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const context = LogService.getActorContext(JadwalHandler.getUserPayload(c));
    return c.json(await JadwalService.put(id, body, context));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    const context = LogService.getActorContext(JadwalHandler.getUserPayload(c));
    return c.json(await JadwalService.delete(id, context));
  }
}
