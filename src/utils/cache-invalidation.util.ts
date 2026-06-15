import redisService from '../infrastructures/redis.infrastructure';

export class CacheInvalidation {
  public static async invalidateDosen() {
    await redisService.delByPattern('dosen:*');
  }

  public static async invalidateRuangan() {
    await Promise.all([
      redisService.delByPattern('ruangan:*'),
      redisService.del('ai:jadwal-context:ruangan'),
    ]);
  }

  public static async invalidateJadwal() {
    await Promise.all([
      redisService.delByPattern('jadwal:*'),
      redisService.delByPattern('ai:jadwal-context:blocking:*'),
    ]);
  }

  public static async invalidateConstraint() {
    await Promise.all([
      redisService.delByPattern('constraint:*'),
      redisService.delByPattern('ai:constraints:*'),
    ]);
  }

  public static async invalidatePendaftaran() {
    await Promise.all([
      redisService.delByPattern('pendaftaran:*'),
      redisService.delByPattern('mahasiswa:*'),
      redisService.delByPattern('jadwal:*'),
    ]);
  }

  public static async invalidateMahasiswa() {
    await redisService.delByPattern('mahasiswa:*');
  }

  public static async invalidateJenisSeminar() {
    await redisService.delByPattern('jenis-seminar:*');
  }

  public static async invalidateBobotPenilai() {
    await redisService.delByPattern('bobot-penilai:*');
  }

  public static async invalidateKomponenPenilaian() {
    await redisService.delByPattern('komponen-penilaian:*');
  }
}

export default CacheInvalidation;
