import type { Context } from 'hono';
import UploadService from './upload.service';
import { APIError } from '../../utils/api-error.util';
import DokumenTemplateRepository from '../dokumen-template/dokumen-template.repository';

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

    const idDokumenTemplate =
      typeof body.id_dokumen_template === 'string'
        ? body.id_dokumen_template
        : undefined;

    // Ambil max_size_mb dari DB (dokumen_template) jika id_dokumen_template tersedia.
    // Ini memastikan batas ukuran file di-enforce oleh server, bukan nilai dari client.
    let maxSizeMb: number | undefined;
    if (idDokumenTemplate) {
      const template =
        await DokumenTemplateRepository.findById(idDokumenTemplate);
      if (!template) {
        throw new APIError('Dokumen template tidak ditemukan.', 404);
      }
      maxSizeMb = template.max_size_mb ?? undefined;
    }

    return c.json(
      await UploadService.uploadRegistrationFile({
        file,
        idDokumenTemplate,
        kodeDokumen:
          typeof body.kode_dokumen === 'string' ? body.kode_dokumen : undefined,
        jenisSeminar:
          typeof body.jenis_seminar === 'string'
            ? body.jenis_seminar
            : undefined,
        maxSizeMb,
        nim: nim ?? email,
      }),
      201
    );
  }
}
