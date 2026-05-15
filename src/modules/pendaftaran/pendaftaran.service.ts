import Fuse from 'fuse.js';
import { LogActionType, LogActorType, LogEntityType, StatusBerkas } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import { LogService } from '../log';
import { APIError } from '../../utils/api-error.util';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import JenisSeminarHelper from '../../helpers/jenis-seminar.helper';
import PendaftaranRepository from './pendaftaran.repository';
import {
  CreatePendaftaranByMahasiswaType,
  GetAllPendaftaranResponse,
  PendaftaranDashboardResponse,
  TahunAjaranListResponse,
  UpdatePendaftaranByMahasiswaType,
  UpdateStatusBerkasType,
} from './pendaftaran.type';

export interface GetAllParams {
  periode?: 'last_7_hari' | 'last_30_hari' | 'semua';
  jenis_seminar?: string;
  status_berkas?: StatusBerkas;
  tahun_ajaran?: string;
  nim?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export default class PendaftaranService {
  // ===========================================================================
  // Koordinator: list semua pendaftaran
  // ===========================================================================
  public static async getAll(
    params: GetAllParams = {}
  ): Promise<GetAllPendaftaranResponse> {
    const {
      periode = 'semua',
      jenis_seminar,
      status_berkas,
      tahun_ajaran,
      nim,
      q,
      page = 1,
      limit = 10,
    } = params;

    let pendaftaran = await PendaftaranRepository.findAllWithRelations();

    if (periode !== 'semua') {
      const days = periode === 'last_7_hari' ? 7 : 30;
      const from = new Date();
      from.setDate(from.getDate() - days);
      pendaftaran = pendaftaran.filter((p) => p.created_at >= from);
    }

    if (jenis_seminar) {
      pendaftaran = pendaftaran.filter(
        (p) => p.id_jenis_seminar === jenis_seminar
      );
    }

    if (status_berkas) {
      pendaftaran = pendaftaran.filter((p) => p.status_berkas === status_berkas);
    }

    if (tahun_ajaran) {
      pendaftaran = pendaftaran.filter((p) => p.tahun_ajaran === tahun_ajaran);
    }

    if (nim) {
      pendaftaran = pendaftaran.filter((p) => p.nim === nim);
    }

    if (q && q.trim()) {
      const fuse = new Fuse(pendaftaran, {
        keys: [
          { name: 'mahasiswa.nama', weight: 0.4 },
          { name: 'nim', weight: 0.3 },
          { name: 'id_pengajuan_fst', weight: 0.15 },
          { name: 'jenis_seminar.nama', weight: 0.1 },
          { name: 'jenis_seminar.kode', weight: 0.05 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 2,
        includeScore: true,
        ignoreLocation: true,
        findAllMatches: true,
      });
      pendaftaran = fuse.search(q.trim()).map((r) => r.item);
    }

    const total = pendaftaran.length;
    const skip = (page - 1) * limit;
    const data = pendaftaran
      .slice(skip, skip + limit)
      .map(({ data_pendaftaran, ...item }) => item);

    return {
      response: true,
      message: 'Data pendaftaran berhasil diambil.',
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // Koordinator: dashboard statistik
  // ===========================================================================
  public static async getDashboard(params: { tahun_ajaran?: string } = {}): Promise<PendaftaranDashboardResponse> {
    const { tahun_ajaran } = params;
    const where = tahun_ajaran ? { tahun_ajaran } : undefined;

    const [total, statusCounts, avgProcessingTime] = await Promise.all([
      prisma.pendaftaran.count({ where }),
      PendaftaranRepository.getStatsByStatus(where),
      PendaftaranRepository.getAvgProcessingTime(where),
    ]);

    const pending = statusCounts.PENDING ?? 0;
    const approved = statusCounts.APPROVED ?? 0;
    const rejected = statusCounts.REJECTED ?? 0;
    const revision = statusCounts.REVISI ?? 0;
    const completed = approved + rejected;
    const processingRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgProcessingTimeText =
      avgProcessingTime !== null ? `${Math.round(avgProcessingTime / 3600000)} jam` : '0 jam';

    return {
      response: true,
      message: 'Statistik pendaftaran berhasil diambil.',
      data: {
        total,
        pending,
        approved,
        rejected,
        revision,
        processingRate,
        avgProcessingTime: avgProcessingTimeText,
      },
    };
  }

  public static async getAllTahunAjaran(): Promise<TahunAjaranListResponse> {
    const data = await PendaftaranRepository.getDistinctTahunAjaran();

    return {
      response: true,
      message: 'Daftar tahun ajaran berhasil diambil.',
      data: data.map((kode) => ({
        kode,
        nama: TahunAjaranHelper.parseStringNameByCode(kode),
      })),
    };
  }

  // ===========================================================================
  // Koordinator: detail pendaftaran
  // ===========================================================================
  public static async getById(id: string) {
    const data = await PendaftaranRepository.findByIdWithRelations(id);
    if (!data) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }
    return {
      response: true,
      message: 'Detail pendaftaran berhasil diambil.',
      data,
    };
  }

  // ===========================================================================
  // Koordinator: validasi status berkas
  // ===========================================================================
  public static async validateBerkas(id: string, payload: UpdateStatusBerkasType) {
    const existing = await PendaftaranRepository.findById(id);
    if (!existing) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    const data = await PendaftaranRepository.updateStatusBerkas(id, payload);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.PENDAFTARAN,
      entity_id: data.id,
      old_values: existing,
      new_values: data,
    });
    return {
      response: true,
      message: `Status berkas berhasil diubah ke "${payload.status_berkas}".`,
      data,
    };
  }

  // ===========================================================================
  // Koordinator: hapus pendaftaran
  // ===========================================================================
  public static async delete(id: string) {
    const existing = await PendaftaranRepository.findById(id);
    if (!existing) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    await PendaftaranRepository.destroy(id);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.PENDAFTARAN,
      entity_id: existing.id,
      old_values: existing,
    });
    return {
      response: true,
      message: 'Pendaftaran berhasil dihapus.',
    };
  }

  // ===========================================================================
  // Mahasiswa: list pendaftaran milik sendiri
  // ===========================================================================
  public static async getMyAll(email: string) {
    const mahasiswa = await PendaftaranRepository.findMahasiswaByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const data = await PendaftaranRepository.findAllByNimWithRelations(
      mahasiswa.nim
    );
    const list = data.map(({ data_pendaftaran, ...pendaftaran }) => pendaftaran);

    return {
      response: true,
      message: 'Data pendaftaran milik Anda berhasil diambil.',
      data: list,
    };
  }

  // ===========================================================================
  // Mahasiswa: detail pendaftaran milik sendiri
  // ===========================================================================
  public static async getMyById(email: string, id: string) {
    const mahasiswa = await PendaftaranRepository.findMahasiswaByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const data = await PendaftaranRepository.findByIdWithRelations(id);
    if (!data) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    if (data.nim !== mahasiswa.nim) {
      throw new APIError(
        'Anda tidak memiliki akses ke pendaftaran ini.',
        403
      );
    }

    return {
      response: true,
      message: 'Detail pendaftaran berhasil diambil.',
      data,
    };
  }

  // ===========================================================================
  // Mahasiswa: submit pendaftaran (NIM dari JWT email)
  // ===========================================================================
  public static async createByMahasiswa(
    email: string,
    payload: CreatePendaftaranByMahasiswaType
  ) {
    const mahasiswa = await PendaftaranRepository.findMahasiswaByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const duplicate = await PendaftaranRepository.findByIdPengajuanFst(
      payload.id_pengajuan_fst
    );
    if (duplicate) {
      throw new APIError(
        `Pendaftaran dengan ID Pengajuan "${payload.id_pengajuan_fst}" sudah ada.`,
        409
      );
    }

    const tahun_ajaran = TahunAjaranHelper.findSekarang();

    const alreadyRegistered =
      await PendaftaranRepository.findByNimJenisSeminarTahunAjaran(
        mahasiswa.nim,
        payload.id_jenis_seminar,
        tahun_ajaran
      );
    if (alreadyRegistered) {
      throw new APIError(
        `Anda sudah mendaftar seminar ini di tahun ajaran ${TahunAjaranHelper.parseStringNameByCode(tahun_ajaran)}.`,
        409
      );
    }

    await this.ensureForeignKeysExist(payload);
    const id = await this.generateId(payload.id_jenis_seminar, tahun_ajaran);

    const data = await PendaftaranRepository.createWithDataDokumen({
      ...payload,
      id,
      nim: mahasiswa.nim,
      tahun_ajaran,
    });
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.MAHASISWA,
      actor_id: mahasiswa.nim,
      entity_type: LogEntityType.PENDAFTARAN,
      entity_id: data.id,
      new_values: data,
    });

    return {
      response: true,
      message: 'Pendaftaran berhasil ditambahkan.',
      data,
    };
  }

  // ===========================================================================
  // Mahasiswa: revisi pendaftaran sendiri (selama belum APPROVED)
  // ===========================================================================
  public static async updateByMahasiswa(
    email: string,
    id: string,
    payload: UpdatePendaftaranByMahasiswaType
  ) {
    const mahasiswa = await PendaftaranRepository.findMahasiswaByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    const existing = await PendaftaranRepository.findById(id);
    if (!existing) {
      throw new APIError('Pendaftaran tidak ditemukan.', 404);
    }

    if (existing.nim !== mahasiswa.nim) {
      throw new APIError(
        'Anda tidak memiliki akses untuk mengubah pendaftaran ini.',
        403
      );
    }

    if (existing.status_berkas === 'APPROVED') {
      throw new APIError(
        'Pendaftaran tidak dapat diubah karena berkas sudah disetujui.',
        409
      );
    }

    if (
      payload.id_pengajuan_fst &&
      payload.id_pengajuan_fst !== existing.id_pengajuan_fst
    ) {
      const duplicate = await PendaftaranRepository.findByIdPengajuanFst(
        payload.id_pengajuan_fst
      );
      if (duplicate && duplicate.id !== id) {
        throw new APIError(
          `Pendaftaran dengan ID Pengajuan "${payload.id_pengajuan_fst}" sudah ada.`,
          409
        );
      }
    }

    if (
      payload.id_jenis_seminar &&
      payload.id_jenis_seminar !== existing.id_jenis_seminar
    ) {
      const exists = await PendaftaranRepository.jenisSeminarExists(
        payload.id_jenis_seminar
      );
      if (!exists) throw new APIError('Seminar tidak ditemukan.', 404);

      const alreadyRegistered =
        await PendaftaranRepository.findByNimJenisSeminarTahunAjaran(
          mahasiswa.nim,
          payload.id_jenis_seminar,
          existing.tahun_ajaran
        );
      if (alreadyRegistered && alreadyRegistered.id !== id) {
        throw new APIError(
          `Anda sudah mendaftar seminar ini di tahun ajaran ${TahunAjaranHelper.parseStringNameByCode(existing.tahun_ajaran)}.`,
          409
        );
      }
    }

    await this.ensureDosenListExists([
      payload.nip_pembimbing_1,
      payload.nip_pembimbing_2,
      payload.nip_penguji_1,
      payload.nip_penguji_2,
      payload.nip_ketua_sidang,
    ]);

    const data = await PendaftaranRepository.update(id, payload);

    if (payload.dokumen) {
      await PendaftaranRepository.updateStatusBerkas(id, {
        status_berkas: 'UPLOAD_ULANG',
      });
    }

    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.MAHASISWA,
      actor_id: mahasiswa.nim,
      entity_type: LogEntityType.PENDAFTARAN,
      entity_id: data.id,
      old_values: existing,
      new_values: data,
    });
    return {
      response: true,
      message: 'Pendaftaran berhasil diperbarui.',
      data,
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================
  private static async ensureForeignKeysExist(
    payload: CreatePendaftaranByMahasiswaType
  ) {
    const jenisSeminarOk = await PendaftaranRepository.jenisSeminarExists(
      payload.id_jenis_seminar
    );
    if (!jenisSeminarOk) throw new APIError('Jenis seminar tidak ditemukan.', 404);

    await this.ensureDosenListExists([
      payload.nip_pembimbing_1,
      payload.nip_pembimbing_2,
      payload.nip_penguji_1,
      payload.nip_penguji_2,
      payload.nip_ketua_sidang,
    ]);
  }

  private static async ensureDosenListExists(
    nips: (string | null | undefined)[]
  ) {
    const filtered = nips.filter((nip): nip is string => !!nip);
    for (const nip of filtered) {
      const exists = await PendaftaranRepository.dosenExists(nip);
      if (!exists) {
        throw new APIError(`Dosen dengan NIP "${nip}" tidak ditemukan.`, 404);
      }
    }
  }

  private static async generateId(idJenisSeminar: string, tahunAjaran: string): Promise<string> {
    const kodeJenisSeminar = await JenisSeminarHelper.resolveKodeById(idJenisSeminar);
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 5);
    return `${kodeJenisSeminar}${tahunAjaran}${suffix}`;
  }
}
