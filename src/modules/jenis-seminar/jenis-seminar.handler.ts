import { Context } from 'hono';
import JenisSeminarService from './jenis-seminar.service';
import {
  CreateJenisSeminarType,
  UpdateJenisSeminarType,
} from './jenis-seminar.type';

export default class JenisSeminarHandler {
  public static async getAll(c: Context) {
    const onlyAktif = c.req.query('aktif') === 'true';
    return c.json(await JenisSeminarService.getAll(onlyAktif));
  }

  public static async getByKode(c: Context) {
    const { kode } = c.req.param();
    return c.json(await JenisSeminarService.getByKode(kode));
  }

  public static async create(c: Context) {
    const body = (await c.req.json()) as CreateJenisSeminarType;
    return c.json(await JenisSeminarService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdateJenisSeminarType;
    return c.json(await JenisSeminarService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await JenisSeminarService.delete(id));
  }
}
