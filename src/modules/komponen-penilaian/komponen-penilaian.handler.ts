import type { Context } from 'hono';
import KomponenPenilaianService from './komponen-penilaian.service';
import type { PenilaiRole } from '@prisma/client';

export default class KomponenPenilaianHandler {
  public static async getAll(c: Context) {
    const query = (c.req as any).valid('query') as {
      role?: PenilaiRole;
      is_aktif?: boolean;
    };
    return c.json(await KomponenPenilaianService.getAll(query));
  }

  public static async getByRole(c: Context) {
    const role = c.req.param('role') as PenilaiRole;
    const query = ((c.req as any).valid?.('query') ?? {}) as {
      is_aktif?: boolean;
    };
    return c.json(await KomponenPenilaianService.getByRole(role, query));
  }

  public static async create(c: Context) {
    const data = await c.req.json();
    return c.json(await KomponenPenilaianService.create(data), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const data = await c.req.json();
    return c.json(await KomponenPenilaianService.update(id, data));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await KomponenPenilaianService.delete(id));
  }

  public static async toggleStatus(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json();
    return c.json(
      await KomponenPenilaianService.toggleStatus(id, body.is_aktif)
    );
  }
}
