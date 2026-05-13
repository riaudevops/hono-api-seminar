import { Context } from 'hono';
import DokumenTemplateService from './dokumen-template.service';
import {
  CreateDokumenTemplateType,
  UpdateDokumenTemplateType,
} from './dokumen-template.type';

export default class DokumenTemplateHandler {
  public static async getAll(c: Context) {
    const query = c.req.query();
    return c.json(
      await DokumenTemplateService.getAll({
        jenis_seminar: query.jenis_seminar,
        q: query.q,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      })
    );
  }

  public static async getById(c: Context) {
    const { id } = c.req.param();
    return c.json(await DokumenTemplateService.getById(id));
  }

  public static async create(c: Context) {
    const body = (await c.req.json()) as CreateDokumenTemplateType;
    return c.json(await DokumenTemplateService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdateDokumenTemplateType;
    return c.json(await DokumenTemplateService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await DokumenTemplateService.delete(id));
  }
}
