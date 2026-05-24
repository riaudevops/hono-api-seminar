import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import RuanganRepository from './ruangan.repository';
import redisService from '../../infrastructures/redis.infrastructure';
import { APIError } from '../../utils/api-error.util';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { LogService } from '../log';
import type { CreateRuanganType, UpdateRuanganType } from './ruangan.type';

export default class RuanganService {
  public static async getAll() {
    return redisService.remember('ruangan:all', 3_600, async () => {
      const ruangan = await RuanganRepository.findAll();
      return {
        response: true,
        message: 'Data semua ruangan berhasil diambil',
        data: ruangan,
      };
    });
  }

  public static async get(kode: string) {
    const ruangan = await RuanganRepository.findByKode(kode);
    if (!ruangan) {
      throw new APIError(`Ruangan dengan nama ${kode} tidak ditemukan`, 404);
    }
    return {
      response: true,
      message: 'Data ruangan berhasil diambil',
      data: ruangan,
    };
  }

  public static async post(data: CreateRuanganType) {
    const existingRuangan = await RuanganRepository.findByKode(data.kode);
    if (existingRuangan) {
      throw new APIError(`Ruangan dengan nama ${data.nama} sudah ada`, 409);
    }

    const ruangan = await RuanganRepository.create(data);
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.RUANGAN,
      entity_id: ruangan.kode,
      new_values: ruangan,
    });
    await CacheInvalidation.invalidateRuangan();

    return {
      response: true,
      message: 'Ruangan berhasil ditambahkan',
      data: ruangan,
    };
  }

  public static async put(kode: string, data: UpdateRuanganType) {
    const existing = (await RuanganService.get(kode)).data;
    const ruangan = await RuanganRepository.update(kode, data);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.RUANGAN,
      entity_id: kode,
      old_values: existing,
      new_values: ruangan,
    });
    await CacheInvalidation.invalidateRuangan();

    return {
      response: true,
      message: 'Ruangan berhasil diperbarui',
      data: ruangan,
    };
  }

  public static async delete(kode: string) {
    const existing = (await RuanganService.get(kode)).data;
    await RuanganRepository.destroy(kode);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.RUANGAN,
      entity_id: kode,
      old_values: existing,
    });
    await CacheInvalidation.invalidateRuangan();

    return {
      response: true,
      message: 'Ruangan berhasil dihapus',
    };
  }
}
