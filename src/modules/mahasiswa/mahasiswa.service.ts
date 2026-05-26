import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import { LogService } from '../log';
import redisService from '../../infrastructures/redis.infrastructure';
import { APIError } from '../../utils/api-error.util';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { hashCacheKey } from '../../utils/cache-key.util';
import MahasiswaRepository from './mahasiswa.repository';
import type {
  GetAllMahasiswaQuery,
  UpdateDataSayaType,
} from './mahasiswa.type';

export default class MahasiswaService {
  public static async getAll(query: GetAllMahasiswaQuery) {
    const cacheKey = `mahasiswa:list:${hashCacheKey(query)}`;
    return redisService.remember(cacheKey, 300, async () => {
      const { mahasiswa, total } = await MahasiswaRepository.findAll(query);
      return {
        response: true,
        message: 'Data semua mahasiswa berhasil diambil.',
        data: {
          mahasiswa,
          pagination: {
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit),
          },
          filters: {
            search: query.search,
            nim: query.nim,
            nama: query.nama,
            email: query.email,
            no_hp: query.no_hp,
            aktif: query.aktif,
            angkatan: query.angkatan,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          },
        },
      };
    });
  }

  public static async getStatistics() {
    return redisService.remember('mahasiswa:stats', 900, async () => {
      const data = await MahasiswaRepository.getStatistics();
      return {
        response: true,
        message: 'Statistik mahasiswa berhasil diambil.',
        data,
      };
    });
  }

  public static async getDetailByNim(nim: string) {
    return redisService.remember(`mahasiswa:detail:${nim}`, 300, async () => {
      const data = await MahasiswaRepository.findFullByNim(nim);
      if (!data) {
        throw new APIError('Data mahasiswa tidak ditemukan.', 404);
      }
      return {
        response: true,
        message: 'Detail lengkap mahasiswa berhasil diambil.',
        data,
      };
    });
  }

  public static async getDataSaya(email: string) {
    const mahasiswa = await MahasiswaRepository.findByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }
    return {
      response: true,
      message: 'Data mahasiswa berhasil diambil.',
      data: mahasiswa,
    };
  }

  public static async updateDataSaya(
    email: string,
    payload: UpdateDataSayaType
  ) {
    const mahasiswa = await MahasiswaRepository.findByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    if (payload.no_hp && payload.no_hp !== mahasiswa.no_hp) {
      const duplicate = await MahasiswaRepository.findByNoHp(payload.no_hp);
      if (duplicate && duplicate.nim !== mahasiswa.nim) {
        throw new APIError(
          `Nomor HP "${payload.no_hp}" sudah digunakan oleh mahasiswa lain.`,
          409
        );
      }
    }

    const data = await MahasiswaRepository.updateByNim(mahasiswa.nim, payload);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.MAHASISWA,
      actor_id: mahasiswa.nim,
      entity_type: LogEntityType.MAHASISWA,
      entity_id: mahasiswa.nim,
      old_values: mahasiswa,
      new_values: data,
    });
    await CacheInvalidation.invalidateMahasiswa();
    return {
      response: true,
      message: 'Data mahasiswa berhasil diperbarui.',
      data,
    };
  }
}
