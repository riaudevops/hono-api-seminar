import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import { LogService } from '../log';
import { APIError } from '../../utils/api-error.util';
import redisService from '../../infrastructures/redis.infrastructure';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { normalizeCachePart } from '../../utils/cache-key.util';
import JenisSeminarRepository from './jenis-seminar.repository';
import type {
  CreateJenisSeminarType,
  UpdateJenisSeminarType,
} from './jenis-seminar.type';

export default class JenisSeminarService {
  public static async getAll(onlyAktif: boolean = false) {
    const cacheKey = `jenis-seminar:list:${onlyAktif ? 'aktif' : 'all'}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const data = await JenisSeminarRepository.findAll(onlyAktif);
      return {
        response: true,
        message: 'Data jenis seminar berhasil diambil.',
        data,
      };
    });
  }

  public static async getByKode(kode: string) {
    const cacheKey = `jenis-seminar:kode:${normalizeCachePart(kode)}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const data =
        await JenisSeminarRepository.findByKodeWithRequirements(kode);
      if (!data) {
        throw new APIError('Jenis seminar tidak ditemukan.', 404);
      }
      return {
        response: true,
        message: 'Detail jenis seminar berhasil diambil.',
        data,
      };
    });
  }

  public static async create(payload: CreateJenisSeminarType) {
    const existing = await JenisSeminarRepository.findByKode(payload.kode);
    if (existing) {
      throw new APIError(
        `Jenis seminar dengan kode "${payload.kode}" sudah ada.`,
        409
      );
    }

    const data = await JenisSeminarRepository.create(payload);
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.JENIS_SEMINAR,
      entity_id: data.id,
      new_values: data,
    });
    await CacheInvalidation.invalidateJenisSeminar();
    return {
      response: true,
      message: 'Jenis seminar berhasil ditambahkan.',
      data,
    };
  }

  public static async update(id: string, payload: UpdateJenisSeminarType) {
    const existing = await JenisSeminarRepository.findById(id);
    if (!existing) {
      throw new APIError('Jenis seminar tidak ditemukan.', 404);
    }

    if (payload.kode && payload.kode !== existing.kode) {
      const duplicate = await JenisSeminarRepository.findByKode(payload.kode);
      if (duplicate) {
        throw new APIError(
          `Jenis seminar dengan kode "${payload.kode}" sudah ada.`,
          409
        );
      }
    }

    const data = await JenisSeminarRepository.update(id, payload);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.JENIS_SEMINAR,
      entity_id: data.id,
      old_values: existing,
      new_values: data,
    });
    await CacheInvalidation.invalidateJenisSeminar();
    return {
      response: true,
      message: 'Jenis seminar berhasil diperbarui.',
      data,
    };
  }

  public static async delete(id: string) {
    const existing = await JenisSeminarRepository.findById(id);
    if (!existing) {
      throw new APIError('Jenis seminar tidak ditemukan.', 404);
    }

    const usage = await JenisSeminarRepository.countPendaftaran(id);
    if (usage > 0) {
      throw new APIError(
        `Tidak dapat menghapus: jenis seminar ini sudah digunakan oleh ${usage} pendaftaran. Nonaktifkan saja dengan mengubah is_aktif = false.`,
        409
      );
    }

    await JenisSeminarRepository.destroy(id);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.JENIS_SEMINAR,
      entity_id: existing.id,
      old_values: existing,
    });
    await CacheInvalidation.invalidateJenisSeminar();
    return {
      response: true,
      message: 'Jenis seminar berhasil dihapus.',
    };
  }
}
