import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import { DosenModuleRepository as DosenRepository } from '../dosen';
import BidangKeahlianRepository from '../bidang-keahlian/bidang-keahlian.repository';
import { LogService } from '../log';
import KeahlianDosenRepository from './keahlian-dosen.repository';
import { APIError } from '../../utils/api-error.util';
import type {
  CreateKeahlianDosenType,
  KeahlianDosenFilterType,
  UpdateKeahlianDosenType,
} from './keahlian-dosen.type';

export default class KeahlianDosenService {
  public static async getAll(filters?: KeahlianDosenFilterType) {
    const hasFilters = Boolean(
      filters?.nip || filters?.id_bidang_keahlian || filters?.bidang
    );

    const keahlianDosen = hasFilters
      ? await KeahlianDosenRepository.findByFilters(filters || {})
      : await KeahlianDosenRepository.findAll();

    return {
      response: true,
      message: hasFilters
        ? 'Data keahlian dosen berhasil difilter'
        : 'Data semua keahlian dosen berhasil diambil',
      data: keahlianDosen,
    };
  }

  public static async get(id: string) {
    const keahlianDosen = await KeahlianDosenRepository.findById(id);
    if (!keahlianDosen) {
      throw new APIError('Data keahlian dosen tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Data keahlian dosen berhasil diambil',
      data: keahlianDosen,
    };
  }

  public static async create(data: CreateKeahlianDosenType) {
    const dosen = await DosenRepository.findByNip(data.nip);
    if (!dosen) {
      throw new APIError(`Dosen dengan NIP ${data.nip} tidak ditemukan`, 404);
    }

    const bidangKeahlian = await BidangKeahlianRepository.findById(
      data.id_bidang_keahlian
    );
    if (!bidangKeahlian) {
      throw new APIError(
        `Bidang keahlian dengan ID ${data.id_bidang_keahlian} tidak ditemukan`,
        404
      );
    }

    const existing = await KeahlianDosenRepository.findByPair(
      data.nip,
      data.id_bidang_keahlian
    );
    if (existing) {
      throw new APIError('Relasi keahlian dosen tersebut sudah terdaftar', 409);
    }

    const keahlianDosen = await KeahlianDosenRepository.create(data);
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KEAHLIAN_DOSEN,
      entity_id: keahlianDosen.id,
      new_values: keahlianDosen,
    });

    return {
      response: true,
      message: 'Keahlian dosen berhasil ditambahkan',
      data: keahlianDosen,
    };
  }

  public static async update(id: string, data: UpdateKeahlianDosenType) {
    const existingData = await KeahlianDosenRepository.findById(id);
    if (!existingData) {
      throw new APIError('Data keahlian dosen tidak ditemukan', 404);
    }

    if (data.nip) {
      const dosen = await DosenRepository.findByNip(data.nip);
      if (!dosen) {
        throw new APIError(`Dosen dengan NIP ${data.nip} tidak ditemukan`, 404);
      }
    }

    if (data.id_bidang_keahlian) {
      const bidangKeahlian = await BidangKeahlianRepository.findById(
        data.id_bidang_keahlian
      );
      if (!bidangKeahlian) {
        throw new APIError(
          `Bidang keahlian dengan ID ${data.id_bidang_keahlian} tidak ditemukan`,
          404
        );
      }
    }

    const nextNip = data.nip ?? existingData.nip;
    const nextBidang =
      data.id_bidang_keahlian ?? existingData.id_bidang_keahlian;

    const duplicate = await KeahlianDosenRepository.findByPair(
      nextNip,
      nextBidang
    );
    if (duplicate && duplicate.id !== id) {
      throw new APIError('Relasi keahlian dosen tersebut sudah terdaftar', 409);
    }

    const keahlianDosen = await KeahlianDosenRepository.update(id, data);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KEAHLIAN_DOSEN,
      entity_id: id,
      old_values: existingData,
      new_values: keahlianDosen,
    });

    return {
      response: true,
      message: 'Keahlian dosen berhasil diperbarui',
      data: keahlianDosen,
    };
  }

  public static async delete(id: string) {
    const existingData = (await KeahlianDosenService.get(id)).data;
    await KeahlianDosenRepository.destroy(id);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KEAHLIAN_DOSEN,
      entity_id: id,
      old_values: existingData,
    });

    return {
      response: true,
      message: 'Keahlian dosen berhasil dihapus',
    };
  }
}
