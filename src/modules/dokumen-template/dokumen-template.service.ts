import { APIError } from '../../utils/api-error.util';
import DokumenTemplateRepository from './dokumen-template.repository';
import {
  CreateDokumenTemplateType,
  UpdateDokumenTemplateType,
} from './dokumen-template.type';

export default class DokumenTemplateService {
  public static async getAll() {
    const data = await DokumenTemplateRepository.findAll();
    return {
      response: true,
      message: 'Data template dokumen berhasil diambil.',
      data,
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
