import type { Context } from 'hono';
import UploadService from './upload.service';
import { APIError } from '../../utils/api-error.util';

export default class UploadHandler {
  public static async deleteDriveFile(c: Context) {
    const fileId = c.req.param('fileId');
    if (!fileId) {
      throw new APIError('ID file Google Drive wajib diisi.', 400);
    }

    return c.json(await UploadService.deleteDriveFile(fileId));
  }

  public static async uploadDriveFile(c: Context) {
    const { email, nim } = c.get('user') as { email?: string; nim?: string };
    const contentType = c.req.header('content-type') ?? '';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      throw new APIError(
        'Request upload wajib menggunakan multipart/form-data.',
        400
      );
    }

    let body: Awaited<ReturnType<typeof c.req.parseBody>>;
    try {
      body = await c.req.parseBody();
    } catch {
      throw new APIError(
        'Body multipart/form-data tidak valid. Jika upload dari browser, jangan set header Content-Type secara manual.',
        400
      );
    }

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
