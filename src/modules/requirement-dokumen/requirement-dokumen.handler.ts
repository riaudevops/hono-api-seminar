import { Context } from 'hono';
import RequirementDokumenService from './requirement-dokumen.service';
import {
  CreateRequirementDokumenType,
  UpdateRequirementDokumenType,
} from './requirement-dokumen.type';

export default class RequirementDokumenHandler {
  public static async getAll(c: Context) {
    const query = c.req.query();
    const isWajib =
      query.is_wajib === undefined ? undefined : query.is_wajib === 'true';
    return c.json(
      await RequirementDokumenService.getAll({
        jenis_seminar: query.jenis_seminar,
        dokumen_template: query.dokumen_template,
        is_wajib: isWajib,
        q: query.q,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      })
    );
  }

  public static async getById(c: Context) {
    const { id } = c.req.param();
    return c.json(await RequirementDokumenService.getById(id));
  }

  public static async create(c: Context) {
    const body = (await c.req.json()) as CreateRequirementDokumenType;
    return c.json(await RequirementDokumenService.create(body), 201);
  }

  public static async update(c: Context) {
    const { id } = c.req.param();
    const body = (await c.req.json()) as UpdateRequirementDokumenType;
    return c.json(await RequirementDokumenService.update(id, body));
  }

  public static async delete(c: Context) {
    const { id } = c.req.param();
    return c.json(await RequirementDokumenService.delete(id));
  }
}
