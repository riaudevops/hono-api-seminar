import BidangKeahlianRepository from '../repositories/bidang-keahlian.repository';
import KeahlianDosenRepository from '../repositories/keahlian-dosen.repository';
import { APIError } from '../utils/api-error.util';
import {
  CreateBidangKeahlianType,
  UpdateBidangKeahlianType,
} from '../types/bidang-keahlian.type';

export default class BidangKeahlianService {
  public static async getAll() {
    const bidangKeahlian = await BidangKeahlianRepository.findAll();
    return {
      response: true,
      message: 'Data semua bidang keahlian berhasil diambil',
      data: bidangKeahlian,
    };
  }

  public static async get(id: string) {
    const bidangKeahlian = await BidangKeahlianRepository.findById(id);
    if (!bidangKeahlian) {
      throw new APIError('Bidang keahlian tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Data bidang keahlian berhasil diambil',
      data: bidangKeahlian,
    };
  }

  public static async create(data: CreateBidangKeahlianType) {
    const existing = await BidangKeahlianRepository.findByNama(data.nama);
    if (existing) {
      throw new APIError(
        `Bidang keahlian dengan nama ${data.nama} sudah ada`,
        409
      );
    }

    const bidangKeahlian = await BidangKeahlianRepository.create(data);

    return {
      response: true,
      message: 'Bidang keahlian berhasil ditambahkan',
      data: bidangKeahlian,
    };
  }

  public static async update(id: string, data: UpdateBidangKeahlianType) {
    await this.get(id);

    if (data.nama) {
      const existing = await BidangKeahlianRepository.findByNama(data.nama);
      if (existing && existing.id !== id) {
        throw new APIError(
          `Bidang keahlian dengan nama ${data.nama} sudah ada`,
          409
        );
      }
    }

    const bidangKeahlian = await BidangKeahlianRepository.update(id, data);

    return {
      response: true,
      message: 'Bidang keahlian berhasil diperbarui',
      data: bidangKeahlian,
    };
  }

  public static async delete(id: string) {
    await this.get(id);

    const used = await KeahlianDosenRepository.existsByBidangKeahlianId(id);

    if (used) {
      throw new APIError(
        'Bidang keahlian tidak dapat dihapus karena masih digunakan oleh data keahlian dosen',
        400
      );
    }

    await BidangKeahlianRepository.destroy(id);

    return {
      response: true,
      message: 'Bidang keahlian berhasil dihapus',
    };
  }
}
