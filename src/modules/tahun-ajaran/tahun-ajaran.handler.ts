import type { Context } from 'hono';
import TahunAjaranService from './tahun-ajaran.service';

export default class TahunAjaranHandler {
  public static async getAll(c: Context) {
    return c.json(await TahunAjaranService.getAll());
  }
}
