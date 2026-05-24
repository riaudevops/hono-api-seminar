import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import BidangKeahlianRepository from './bidang-keahlian.repository';
import KeahlianDosenRepository from '../keahlian-dosen/keahlian-dosen.repository';
import { LogService } from '../log';
import { APIError } from '../../utils/api-error.util';
import type {
  CreateBidangKeahlianType,
  UpdateBidangKeahlianType,
} from './bidang-keahlian.type';

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
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.BIDANG_KEAHLIAN,
      entity_id: bidangKeahlian.id,
      new_values: bidangKeahlian,
    });

    return {
      response: true,
      message: 'Bidang keahlian berhasil ditambahkan',
      data: bidangKeahlian,
    };
  }

  public static async update(id: string, data: UpdateBidangKeahlianType) {
    const existingData = (await BidangKeahlianService.get(id)).data;

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
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.BIDANG_KEAHLIAN,
      entity_id: id,
      old_values: existingData,
      new_values: bidangKeahlian,
    });

    return {
      response: true,
      message: 'Bidang keahlian berhasil diperbarui',
      data: bidangKeahlian,
    };
  }

  public static async delete(id: string) {
    const existingData = (await BidangKeahlianService.get(id)).data;

    const used = await KeahlianDosenRepository.existsByBidangKeahlianId(id);

    if (used) {
      throw new APIError(
        'Bidang keahlian tidak dapat dihapus karena masih digunakan oleh data keahlian dosen',
        400
      );
    }

    await BidangKeahlianRepository.destroy(id);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.BIDANG_KEAHLIAN,
      entity_id: id,
      old_values: existingData,
    });

    return {
      response: true,
      message: 'Bidang keahlian berhasil dihapus',
    };
  }
}
