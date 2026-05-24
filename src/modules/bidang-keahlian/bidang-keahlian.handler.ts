import type { Context } from 'hono';
import BidangKeahlianService from './bidang-keahlian.service';
import type {
  CreateBidangKeahlianType,
  UpdateBidangKeahlianType,
} from './bidang-keahlian.type';

export default class BidangKeahlianHandler {
  public static async getAll(c: Context) {
    return c.json(await BidangKeahlianService.getAll());
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await BidangKeahlianService.get(id));
  }

  public static async create(c: Context) {
    const body: CreateBidangKeahlianType = await c.req.json();
    return c.json(await BidangKeahlianService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body: UpdateBidangKeahlianType = await c.req.json();
    return c.json(await BidangKeahlianService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await BidangKeahlianService.delete(id));
  }
}
