import { Context } from 'hono';
import RuanganService from '../services/ruangan.service';
import { CreateRuanganType, UpdateRuanganType } from '../types/ruangan.type';

export default class RuanganHandler {
  public static async getAll(c: Context) {
    return c.json(await RuanganService.getAll());
  }

  public static async get(c: Context) {
    const { kode } = c.req.param();
    return c.json(await RuanganService.get(kode));
  }

  public static async post(c: Context) {
    const body: CreateRuanganType = await c.req.json();
    return c.json(await RuanganService.post(body), 201);
  }

  public static async put(c: Context) {
    const { kode } = c.req.param();
    const body: UpdateRuanganType = await c.req.json();
    return c.json(await RuanganService.put(kode, body));
  }

  public static async delete(c: Context) {
    const { kode } = c.req.param();
    return c.json(await RuanganService.delete(kode));
  }
}
