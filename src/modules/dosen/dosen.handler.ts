import type { Context } from 'hono';
import DosenService from './dosen.service';

export default class DosenHandler {
  public static async getAll(c: Context) {
    const { q } = c.req.query();
    if (q) return c.json(await DosenService.search(q));

    return c.json(await DosenService.getAll());
  }
}
