import type { Context } from 'hono';
import DosenService from './dosen.service';
import { APIError } from '../../utils/api-error.util';

export default class DosenHandler {
  public static async getAll(c: Context) {
    return c.json(await DosenService.getAll());
  }
  public static async search(c: Context) {
    const { q } = c.req.query();
    if (!q) throw new APIError('Query pencarian tidak boleh kosong', 400);
    return c.json(await DosenService.search(q));
  }
}
