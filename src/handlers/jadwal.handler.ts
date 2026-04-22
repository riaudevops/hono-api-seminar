import { Context } from 'hono';
import JadwalService from '../services/jadwal.service';
import { APIError } from '../utils/api-error.util';
import { JenisJadwal, LogActorType } from '@prisma/client';
import LogJadwalService from '../services/log-jadwal.service';

export default class JadwalHandler {
  public static async getMe(c: Context) {
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
    if (!email) throw new APIError('Email tidak ditemukan', 404);
    return c.json(await JadwalService.getMe(email));
  }

  public static async getAll(c: Context) {
    const { jenis } = c.req.query();
    return c.json(await JadwalService.getAll(jenis as JenisJadwal));
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await JadwalService.get(id));
  }

  public static async getLogs(c: Context) {
    const { id } = c.req.param();
    return c.json(await LogJadwalService.getAll({ jadwal_id: id }));
  }

  public static async post(c: Context) {
    const data = await c.req.json();
    const userPayload = c.get('user');
    if (!userPayload || typeof userPayload !== 'object') {
      throw new APIError(
        'Informasi otentikasi tidak ditemukan atau tidak valid.',
        401
      );
    }

    const context = {
      actor_id: userPayload.id || userPayload.email || 'unknown',
      actor_type:
        userPayload.role === 'admin'
          ? LogActorType.KOORDINATOR
          : userPayload.role === 'dosen'
            ? LogActorType.DOSEN
            : LogActorType.MAHASISWA,
    };

    return c.json(await JadwalService.post(data, context), 201);
  }

  public static async put(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const userPayload = c.get('user');
    if (!userPayload || typeof userPayload !== 'object') {
      throw new APIError(
        'Informasi otentikasi tidak ditemukan atau tidak valid.',
        401
      );
    }

    const context = {
      actor_id: userPayload.id || userPayload.email || 'unknown',
      actor_type:
        userPayload.role === 'admin'
          ? LogActorType.KOORDINATOR
          : userPayload.role === 'dosen'
            ? LogActorType.DOSEN
            : LogActorType.MAHASISWA,
    };

    return c.json(await JadwalService.put(id, body, context));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    const userPayload = c.get('user');
    if (!userPayload || typeof userPayload !== 'object') {
      throw new APIError(
        'Informasi otentikasi tidak ditemukan atau tidak valid.',
        401
      );
    }

    const context = {
      actor_id: userPayload.id || userPayload.email || 'unknown',
      actor_type:
        userPayload.role === 'admin'
          ? LogActorType.KOORDINATOR
          : userPayload.role === 'dosen'
            ? LogActorType.DOSEN
            : LogActorType.MAHASISWA,
    };

    return c.json(await JadwalService.delete(id, context));
  }
}
