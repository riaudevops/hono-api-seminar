import Fuse from 'fuse.js';
import { APIError } from '../../utils/api-error.util';
import DokumenTemplateRepository from './dokumen-template.repository';
import {
  CreateDokumenTemplateType,
  DokumenTemplateWithJenisSeminar,
  GetAllDokumenTemplateResponse,
  UpdateDokumenTemplateType,
} from './dokumen-template.type';

export interface GetAllParams {
  jenis_seminar?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export default class DokumenTemplateService {
  public static async getAll(params: GetAllParams = {}): Promise<GetAllDokumenTemplateResponse> {
    const {
      jenis_seminar,
      q,
      page = 1,
      limit = 10,
    } = params;

    let templates = await DokumenTemplateRepository.findAllWithJenisSeminar();

    if (jenis_seminar) {
      templates = templates.filter((t) =>
        t.jenis_seminars.some((js) => js.id === jenis_seminar)
      );
    }

    if (q && q.trim()) {
      const fuse = new Fuse(templates, {
        keys: [
          { name: 'nama', weight: 0.5 },
          { name: 'kode', weight: 0.3 },
          { name: 'deskripsi', weight: 0.2 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 2,
        includeScore: true,
        ignoreLocation: true,
        findAllMatches: true,
      });

      const results = fuse.search(q.trim());
      templates = results.map((r) => r.item);
    }

    const total = templates.length;
    const skip = (page - 1) * limit;
    const data = templates.slice(skip, skip + limit);

    return {
      response: true,
      message: 'Data template dokumen berhasil diambil.',
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getById(id: string) {
    const data = await DokumenTemplateRepository.findByIdWithRequirements(id);
    if (!data) {
      throw new APIError('Template dokumen tidak ditemukan.', 404);
    }
    return {
      response: true,
      message: 'Detail template dokumen berhasil diambil.',
      data,
    };
  }

  public static async create(payload: CreateDokumenTemplateType) {
    const existing = await DokumenTemplateRepository.findByKode(payload.kode);
    if (existing) {
      throw new APIError(
        `Template dokumen dengan kode "${payload.kode}" sudah ada.`,
        409
      );
    }

    const data = await DokumenTemplateRepository.create(payload);
    return {
      response: true,
      message: 'Template dokumen berhasil ditambahkan.',
      data,
    };
  }

  public static async update(id: string, payload: UpdateDokumenTemplateType) {
    const existing = await DokumenTemplateRepository.findById(id);
    if (!existing) {
      throw new APIError('Template dokumen tidak ditemukan.', 404);
    }

    if (payload.kode && payload.kode !== existing.kode) {
      const duplicate = await DokumenTemplateRepository.findByKode(payload.kode);
      if (duplicate) {
        throw new APIError(
          `Template dokumen dengan kode "${payload.kode}" sudah ada.`,
          409
        );
      }
    }

    const data = await DokumenTemplateRepository.update(id, payload);
    return {
      response: true,
      message: 'Template dokumen berhasil diperbarui.',
      data,
    };
  }

  public static async delete(id: string) {
    const existing = await DokumenTemplateRepository.findById(id);
    if (!existing) {
      throw new APIError('Template dokumen tidak ditemukan.', 404);
    }

    const usage = await DokumenTemplateRepository.countRequirement(id);
    if (usage > 0) {
      throw new APIError(
        `Tidak dapat menghapus: template dokumen ini digunakan oleh ${usage} jenis seminar. Hapus relasi terlebih dahulu.`,
        409
      );
    }

    await DokumenTemplateRepository.destroy(id);
    return {
      response: true,
      message: 'Template dokumen berhasil dihapus.',
    };
  }
}
