import { Context } from 'hono';
import KeahlianDosenService from '../services/keahlian-dosen.service';
import {
  CreateKeahlianDosenType,
  UpdateKeahlianDosenType,
} from '../types/keahlian-dosen.type';

export default class KeahlianDosenHandler {
  public static async getAll(c: Context) {
    const nip = c.req.query('nip');
    const id_bidang_keahlian = c.req.query('id_bidang_keahlian');
    const bidang = c.req.query('bidang');

    return c.json(
      await KeahlianDosenService.getAll({
        nip,
        id_bidang_keahlian,
        bidang,
      })
    );
  }

  public static async get(c: Context) {
    const { id } = c.req.param();
    return c.json(await KeahlianDosenService.get(id));
  }

  public static async create(c: Context) {
    const body: CreateKeahlianDosenType = await c.req.json();
    return c.json(await KeahlianDosenService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body: UpdateKeahlianDosenType = await c.req.json();
    return c.json(await KeahlianDosenService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await KeahlianDosenService.delete(id));
  }
}
