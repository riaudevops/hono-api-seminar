import prisma from '../../infrastructures/db.infrastructure';

export default class TahunAjaranRepository {
  /**
   * Ambil daftar kode tahun ajaran unik dari tabel `pendaftaran` dan `jadwal`.
   * `pendaftaran.tahun_ajaran` dan `jadwal.kode_tahun_ajaran` keduanya bertipe
   * VarChar(5) dengan format `YYYY1` (Ganjil) / `YYYY2` (Genap).
   *
   * Hasil di-merge, di-dedup, dan diurutkan desc (terbaru di depan).
   */
  public static async getDistinctKodes(): Promise<string[]> {
    const [pendaftaranRows, jadwalRows] = await Promise.all([
      prisma.pendaftaran.findMany({
        select: { tahun_ajaran: true },
        distinct: ['tahun_ajaran'],
      }),
      prisma.jadwal.findMany({
        select: { kode_tahun_ajaran: true },
        distinct: ['kode_tahun_ajaran'],
      }),
    ]);

    const set = new Set<string>();
    for (const row of pendaftaranRows) {
      if (row.tahun_ajaran) set.add(row.tahun_ajaran);
    }
    for (const row of jadwalRows) {
      if (row.kode_tahun_ajaran) set.add(row.kode_tahun_ajaran);
    }

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }
}
