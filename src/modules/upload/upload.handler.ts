import type { Context } from 'hono';
import UploadService from './upload.service';
import { APIError } from '../../utils/api-error.util';

export default class UploadHandler {
  public static async uploadDriveFile(c: Context) {
    const { email, nim } = c.get('user') as { email?: string; nim?: string };
    const body = await c.req.parseBody();
    const file = body.file;

    if (!(file instanceof File)) {
      throw new APIError('Field file wajib berisi file upload.', 400);
    }

    const maxSizeMbRaw = body.max_size_mb;
    const maxSizeMb =
      typeof maxSizeMbRaw === 'string' && maxSizeMbRaw.trim()
        ? Number(maxSizeMbRaw)
        : undefined;

    return c.json(
      await UploadService.uploadRegistrationFile({
        file,
        idDokumenTemplate:
          typeof body.id_dokumen_template === 'string'
            ? body.id_dokumen_template
            : undefined,
        kodeDokumen:
          typeof body.kode_dokumen === 'string' ? body.kode_dokumen : undefined,
        jenisSeminar:
          typeof body.jenis_seminar === 'string'
            ? body.jenis_seminar
            : undefined,
        maxSizeMb: Number.isFinite(maxSizeMb) ? maxSizeMb : undefined,
        nim: nim ?? email,
      }),
      201
    );
  }
}
