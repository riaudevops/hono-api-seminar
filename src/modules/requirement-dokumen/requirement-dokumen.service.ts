import Fuse from 'fuse.js';
import { APIError } from '../../utils/api-error.util';
import RequirementDokumenRepository from './requirement-dokumen.repository';
import {
  CreateRequirementDokumenType,
  GetAllRequirementDokumenResponse,
  UpdateRequirementDokumenType,
} from './requirement-dokumen.type';

export interface GetAllParams {
  jenis_seminar?: string;
  dokumen_template?: string;
  is_wajib?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}

export default class RequirementDokumenService {
  public static async getAll(
    params: GetAllParams = {}
  ): Promise<GetAllRequirementDokumenResponse> {
    const {
      jenis_seminar,
      dokumen_template,
      is_wajib,
      q,
      page = 1,
      limit = 10,
    } = params;

    let requirements = await RequirementDokumenRepository.findAllWithRelations();

    if (jenis_seminar) {
      requirements = requirements.filter(
        (r) => r.id_jenis_seminar === jenis_seminar
      );
    }

    if (dokumen_template) {
      requirements = requirements.filter(
        (r) => r.id_dokumen_template === dokumen_template
      );
    }

    if (is_wajib !== undefined) {
      requirements = requirements.filter((r) => r.is_wajib === is_wajib);
    }

    if (q && q.trim()) {
      const fuse = new Fuse(requirements, {
        keys: [
          { name: 'jenis_seminar.nama', weight: 0.3 },
          { name: 'jenis_seminar.kode', weight: 0.2 },
          { name: 'dokumen_template.nama', weight: 0.3 },
          { name: 'dokumen_template.kode', weight: 0.1 },
          { name: 'keterangan_tambahan', weight: 0.1 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 2,
        includeScore: true,
        ignoreLocation: true,
        findAllMatches: true,
      });
      requirements = fuse.search(q.trim()).map((r) => r.item);
    }

    const total = requirements.length;
    const skip = (page - 1) * limit;
    const data = requirements.slice(skip, skip + limit);

    return {
      response: true,
      message: 'Data requirement dokumen berhasil diambil.',
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
    const data = await RequirementDokumenRepository.findByIdWithRelations(id);
    if (!data) {
      throw new APIError('Requirement dokumen tidak ditemukan.', 404);
    }
    return {
      response: true,
      message: 'Detail requirement dokumen berhasil diambil.',
      data,
    };
  }

  public static async create(payload: CreateRequirementDokumenType) {
    await this.ensureForeignKeysExist(
      payload.id_jenis_seminar,
      payload.id_dokumen_template
    );

    const duplicate = await RequirementDokumenRepository.findByPair(
      payload.id_jenis_seminar,
      payload.id_dokumen_template
    );
    if (duplicate) {
      throw new APIError(
        'Requirement dokumen untuk pasangan jenis seminar dan dokumen template ini sudah ada.',
        409
      );
    }

    const data = await RequirementDokumenRepository.create(payload);
    return {
      response: true,
      message: 'Requirement dokumen berhasil ditambahkan.',
      data,
    };
  }

  public static async update(
    id: string,
    payload: UpdateRequirementDokumenType
  ) {
    const existing = await RequirementDokumenRepository.findById(id);
    if (!existing) {
      throw new APIError('Requirement dokumen tidak ditemukan.', 404);
    }

    const nextJenisSeminar =
      payload.id_jenis_seminar ?? existing.id_jenis_seminar;
    const nextDokumenTemplate =
      payload.id_dokumen_template ?? existing.id_dokumen_template;

    if (
      payload.id_jenis_seminar &&
      payload.id_jenis_seminar !== existing.id_jenis_seminar
    ) {
      const exists = await RequirementDokumenRepository.jenisSeminarExists(
        payload.id_jenis_seminar
      );
      if (!exists) throw new APIError('Jenis seminar tidak ditemukan.', 404);
    }

    if (
      payload.id_dokumen_template &&
      payload.id_dokumen_template !== existing.id_dokumen_template
    ) {
      const exists = await RequirementDokumenRepository.dokumenTemplateExists(
        payload.id_dokumen_template
      );
      if (!exists) throw new APIError('Dokumen template tidak ditemukan.', 404);
    }

    const pairChanged =
      nextJenisSeminar !== existing.id_jenis_seminar ||
      nextDokumenTemplate !== existing.id_dokumen_template;

    if (pairChanged) {
      const duplicate = await RequirementDokumenRepository.findByPair(
        nextJenisSeminar,
        nextDokumenTemplate
      );
      if (duplicate && duplicate.id !== id) {
        throw new APIError(
          'Requirement dokumen untuk pasangan jenis seminar dan dokumen template ini sudah ada.',
          409
        );
      }
    }

    const data = await RequirementDokumenRepository.update(id, payload);
    return {
      response: true,
      message: 'Requirement dokumen berhasil diperbarui.',
      data,
    };
  }

  public static async delete(id: string) {
    const existing = await RequirementDokumenRepository.findById(id);
    if (!existing) {
      throw new APIError('Requirement dokumen tidak ditemukan.', 404);
    }

    await RequirementDokumenRepository.destroy(id);
    return {
      response: true,
      message: 'Requirement dokumen berhasil dihapus.',
    };
  }

  private static async ensureForeignKeysExist(
    id_jenis_seminar: string,
    id_dokumen_template: string
  ) {
    const [jenisSeminarExists, dokumenTemplateExists] = await Promise.all([
      RequirementDokumenRepository.jenisSeminarExists(id_jenis_seminar),
      RequirementDokumenRepository.dokumenTemplateExists(id_dokumen_template),
    ]);
    if (!jenisSeminarExists) {
      throw new APIError('Jenis seminar tidak ditemukan.', 404);
    }
    if (!dokumenTemplateExists) {
      throw new APIError('Dokumen template tidak ditemukan.', 404);
    }
  }
}
