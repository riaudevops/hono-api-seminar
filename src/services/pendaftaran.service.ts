import Fuse from 'fuse.js';
import prisma from '../infrastructures/db.infrastructure';
import { APIError } from '../utils/api-error.util';
import PendaftaranRepository from '../repositories/pendaftaran.repository';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';

type DateFilter = '7' | '30' | 'all';

export default class PendaftaranService {
  /**
   * GET /pendaftaran — Ringkasan pendaftaran (id, timestamp, nim, nama, jenis, status)
   */
  public static async getAll(
    dateFilter: DateFilter = 'all',
    jenisSeminar?: string,
    search?: string,
    page: number = 1,
    limit: number = 10
  ) {
    let data = await PendaftaranRepository.findAll();

    if (data.length === 0) {
      throw new APIError('Belum ada data pendaftaran.', 404);
    }

    let mapped = data.map((p) => this.toSummary(p));

    // Filter
    mapped = this.filterByDate(mapped, dateFilter);
    if (jenisSeminar) {
      mapped = this.filterByJenisSeminar(mapped, jenisSeminar);
    }

    // Fuzzy search by nama/nim
    if (search && search.trim() !== '') {
      const fuse = new Fuse(mapped, {
        keys: [
          { name: 'nama', weight: 0.7 },
          { name: 'nim', weight: 0.3 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 2,
        ignoreLocation: true,
        findAllMatches: true,
      });
      mapped = fuse.search(search).map((r) => r.item);

      if (mapped.length === 0) {
        throw new APIError(
          `Tidak ditemukan pendaftaran dengan nama atau NIM yang mirip dengan "${search}"`,
          404
        );
      }
    }

    const total = mapped.length;
    const paginatedData = mapped.slice(
      (page - 1) * limit,
      page * limit
    );

    return {
      response: true,
      message: 'Data pendaftaran berhasil diambil.',
      data: paginatedData,
      filters: {
        dateRange: dateFilter,
        jenisSeminar: jenisSeminar || null,
        search: search || null,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /pendaftaran/:id — Detail lengkap pendaftaran by ID
   */
  public static async getById(id: string) {
    const p = await PendaftaranRepository.findById(id);
    if (!p) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    const dosenMap = await this.buildDosenMap();

    return {
      response: true,
      message: 'Detail pendaftaran berhasil diambil.',
      data: this.toDetail(p, dosenMap),
    };
  }

  /**
   * POST /pendaftaran-saya — Mahasiswa mendaftar (butuh email JWT)
   */
  public static async createByEmail(email: string, data: any) {
    const mhs = await prisma.mahasiswa.findUnique({ where: { email } });
    if (!mhs) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const existing = await PendaftaranRepository.findByIdPengajuanFst(
      data.id_pengajuan_fst
    );
    if (existing) {
      throw new APIError(
        `Pendaftaran dengan ID Pengajuan "${data.id_pengajuan_fst}" sudah ada.`,
        409
      );
    }

    const pendaftaran = await PendaftaranRepository.create({
      id: this.generateId(data.jenis_seminar),
      nim: mhs.nim,
      nama: mhs.nama,
      semester: this.computeSemester(mhs.nim),
      ...data,
    });

    return {
      response: true,
      message: 'Pendaftaran berhasil ditambahkan.',
      data: pendaftaran,
    };
  }

  /**
   * PUT /pendaftaran-saya/:id — Mahasiswa update pendaftarannya sendiri
   */
  public static async updateByEmail(email: string, id: string, data: any) {
    const mhs = await prisma.mahasiswa.findUnique({ where: { email } });
    if (!mhs) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const existing = await PendaftaranRepository.findById(id);
    if (!existing) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    if (existing.nim !== mhs.nim) {
      throw new APIError('Anda tidak memiliki akses untuk mengubah pendaftaran ini.', 403);
    }

    if (existing.status_berkas === 'APPROVED') {
      throw new APIError(
        'Pendaftaran tidak dapat diubah karena berkas sudah disetujui.',
        409
      );
    }

    const updated = await PendaftaranRepository.update(id, data);

    return {
      response: true,
      message: 'Pendaftaran berhasil diperbarui.',
      data: updated,
    };
  }

  /**
   * PUT /koordinator/pendaftaran/:id/validasi — Koordinator validasi status berkas
   */
  public static async validateBerkas(id: string, data: any) {
    const existing = await PendaftaranRepository.findById(id);
    if (!existing) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    const updated = await PendaftaranRepository.update(id, {
      status_berkas: data.status_berkas,
    });

    return {
      response: true,
      message: `Status berkas berhasil diubah ke "${data.status_berkas}".`,
      data: updated,
    };
  }

  /**
   * GET /pendaftaran/dashboard — Statistik pendaftaran
   */
  public static async getDashboard() {
    const data = await PendaftaranRepository.findAll();

    if (data.length === 0) {
      throw new APIError('Belum ada data pendaftaran.', 404);
    }

    const total = data.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let revision = 0;

    const processedTimestamps: number[] = [];

    for (const p of data) {
      const s = p.status_berkas;

      if (s === 'PENDING') {
        pending++;
      } else if (s === 'APPROVED') {
        approved++;
        processedTimestamps.push(new Date(p.created_at).getTime());
      } else if (s === 'REJECTED') {
        rejected++;
        processedTimestamps.push(new Date(p.created_at).getTime());
      } else if (s === 'IN_REVIEW') {
        revision++;
        processedTimestamps.push(new Date(p.created_at).getTime());
      } else {
        pending++;
      }
    }

    const processed = approved + rejected + revision;
    const processingRate =
      total > 0 ? Math.round((processed / total) * 100) : 0;

    const now = Date.now();
    let avgProcessingTime = '-';
    if (processedTimestamps.length > 0) {
      const avgMs =
        processedTimestamps.reduce((sum, ts) => sum + (now - ts), 0) /
        processedTimestamps.length;
      avgProcessingTime = this.formatDuration(avgMs);
    }

    return {
      response: true,
      message: 'Dashboard pendaftaran berhasil diambil.',
      data: {
        total,
        pending,
        approved,
        rejected,
        revision,
        processingRate,
        avgProcessingTime,
      },
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private static async buildDosenMap() {
    const allDosen = await prisma.dosen.findMany({
      select: { nip: true, nama: true },
    });
    return new Map(allDosen.map((d) => [d.nip, d.nama]));
  }

  private static resolveDosen(
    nip: string | null | undefined,
    dosenMap: Map<string, string>
  ) {
    if (!nip) return null;
    const nama = dosenMap.get(nip);
    return nama ? { nip, nama } : { nip, nama: null };
  }

  private static filterByDate(data: any[], dateFilter: DateFilter): any[] {
    if (dateFilter === 'all') return data;

    const days = parseInt(dateFilter);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return data.filter((p) => new Date(p.timestamp) >= cutoffDate);
  }

  private static filterByJenisSeminar(
    data: any[],
    jenisSeminar: string
  ): any[] {
    const lower = jenisSeminar.toLowerCase();
    const filtered = data.filter((p) =>
      p.jenis_seminar.toLowerCase().includes(lower)
    );
    if (filtered.length === 0) {
      throw new APIError(
        `Tidak ada data pendaftaran dengan jenis seminar "${jenisSeminar}".`,
        404
      );
    }
    return filtered;
  }

  private static toSummary(p: any) {
    return {
      id: p.id,
      timestamp: p.created_at,
      nim: p.nim,
      nama: p.nama,
      jenis_seminar: p.jenis_seminar,
      status_berkas: p.status_berkas,
    };
  }

  private static toDetail(
    p: any,
    dosenMap: Map<string, string>
  ) {
    return {
      id: p.id,
      timestamp: p.created_at,
      nim: p.nim,
      nama: p.nama,
      semester: p.semester,
      id_pengajuan_fst: p.id_pengajuan_fst,
      no_wa: p.no_wa,
      jenis_seminar: p.jenis_seminar,
      judul: p.judul,
      pembimbing_1: this.resolveDosen(p.nip_pembimbing_1, dosenMap),
      pembimbing_2: this.resolveDosen(p.nip_pembimbing_2, dosenMap),
      penguji_1: this.resolveDosen(p.nip_penguji_1, dosenMap),
      penguji_2: this.resolveDosen(p.nip_penguji_2, dosenMap),
      mata_kuliah_pilihan: p.mata_kuliah_pilihan,
      berkas_syarat_url: p.berkas_syarat_url,
      undangan_sebelumnya_url: p.undangan_sebelumnya_url,
      status_berkas: p.status_berkas,
      status_proses: p.status_proses,
    };
  }

  private static formatDuration(ms: number): string {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours.toFixed(1)} jam`;
    const days = hours / 24;
    if (days < 30) return `${days.toFixed(1)} hari`;
    return `${(days / 30).toFixed(1)} bulan`;
  }

  private static generateId(jenisSeminar: string): string {
    const tahunAjaran = TahunAjaranHelper.findSekarang();
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    return `${jenisSeminar}-${tahunAjaran}-${suffix}`;
  }

  private static computeSemester(nim: string): number {
    const angkatan = parseInt(`20${nim.slice(1, 3)}`);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    // September–December = tahun ajaran baru (start of academic year), Januari–Agustus = lanjutan
    const academicYear = currentMonth >= 8 ? currentYear : currentYear - 1;
    return (academicYear - angkatan) * 2 + (currentMonth >= 8 ? 1 : 2);
  }
}
