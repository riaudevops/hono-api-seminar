import redisService from '../../infrastructures/redis.infrastructure';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import TahunAjaranRepository from './tahun-ajaran.repository';
import type { TahunAjaranListResponse } from './tahun-ajaran.type';

export default class TahunAjaranService {
  // Cache key terpisah dari `pendaftaran:tahun-ajaran` karena sumber datanya
  // gabungan (pendaftaran + jadwal). TTL 15 menit, mengikuti precedent
  // PendaftaranService.getAllTahunAjaran.
  private static readonly CACHE_KEY = 'tahun-ajaran:all';
  private static readonly CACHE_TTL = 900;

  public static async getAll(): Promise<TahunAjaranListResponse> {
    return redisService.remember(
      TahunAjaranService.CACHE_KEY,
      TahunAjaranService.CACHE_TTL,
      async () => {
        const kodes = await TahunAjaranRepository.getDistinctKodes();

        return {
          response: true,
          message: 'Daftar tahun ajaran berhasil diambil.',
          data: kodes.map((kode) => ({
            kode,
            nama: TahunAjaranHelper.parseStringNameByCode(kode),
          })),
        };
      }
    );
  }
}
