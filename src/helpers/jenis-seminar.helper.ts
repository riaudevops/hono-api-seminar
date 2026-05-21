import prisma from '../infrastructures/db.infrastructure';
import { APIError } from '../utils/api-error.util';
import type { JenisJadwalKode } from '../modules/jadwal';

/**
 * Resolver & cache untuk jenis_seminar. Menggantikan enum JenisJadwal
 * — kode yang dulu "SEMKP", "SEMPRO", dst sekarang dilookup ke tabel
 * jenis_seminar untuk mendapat id FK.
 */
export default class JenisSeminarHelper {
  private static kodeCache: Map<string, { id: string; kode: string; nama: string }> = new Map();
  private static idCache: Map<string, { id: string; kode: string; nama: string }> = new Map();

  private static async load() {
    if (this.kodeCache.size > 0) return;
    const rows = await prisma.jenis_seminar.findMany({
      select: { id: true, kode: true, nama: true },
    });
    for (const r of rows) {
      this.kodeCache.set(r.kode, r);
      this.idCache.set(r.id, r);
    }
  }

  public static resetCache() {
    this.kodeCache.clear();
    this.idCache.clear();
  }

  public static async getByKode(kode: string) {
    await this.load();
    const hit = this.kodeCache.get(kode);
    if (hit) return hit;

    const row = await prisma.jenis_seminar.findUnique({
      where: { kode },
      select: { id: true, kode: true, nama: true },
    });
    if (row) {
      this.kodeCache.set(row.kode, row);
      this.idCache.set(row.id, row);
    }
    return row;
  }

  public static async getById(id: string) {
    await this.load();
    const hit = this.idCache.get(id);
    if (hit) return hit;

    const row = await prisma.jenis_seminar.findUnique({
      where: { id },
      select: { id: true, kode: true, nama: true },
    });
    if (row) {
      this.kodeCache.set(row.kode, row);
      this.idCache.set(row.id, row);
    }
    return row;
  }

  public static async resolveIdByKode(kode: string): Promise<string> {
    const row = await this.getByKode(kode);
    if (!row) {
      throw new APIError(`Jenis seminar dengan kode "${kode}" tidak ditemukan`, 404);
    }
    return row.id;
  }

  public static async resolveKodeById(id: string): Promise<JenisJadwalKode> {
    const row = await this.getById(id);
    if (!row) {
      throw new APIError(`Jenis seminar dengan id "${id}" tidak ditemukan`, 404);
    }
    return row.kode as JenisJadwalKode;
  }

  public static async mapIdToKode(ids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const missing: string[] = [];

    await this.load();
    for (const id of ids) {
      const hit = this.idCache.get(id);
      if (hit) result.set(id, hit.kode);
      else missing.push(id);
    }

    if (missing.length > 0) {
      const rows = await prisma.jenis_seminar.findMany({
        where: { id: { in: missing } },
        select: { id: true, kode: true, nama: true },
      });
      for (const r of rows) {
        this.kodeCache.set(r.kode, r);
        this.idCache.set(r.id, r);
        result.set(r.id, r.kode);
      }
    }
    return result;
  }
}
