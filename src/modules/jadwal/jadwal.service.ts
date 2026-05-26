import Fuse from 'fuse.js';
import {
  LogActionType,
  LogEntityType,
  PenilaiRole,
  StatusJadwal,
} from '@prisma/client';
import JadwalRepository, { type JadwalFilter } from './jadwal.repository';
import { APIError } from '../../utils/api-error.util';
import type { DosenAssignment, LogJadwalContext } from './jadwal.type';
import JadwalHelper from '../../helpers/jadwal.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import { MahasiswaModuleRepository as MahasiswaRepository } from '../mahasiswa';
import { DosenModuleRepository as DosenRepository } from '../dosen';
import PenilaianRepository from '../../repositories/penilaian.repository';
import RuanganRepository from '../ruangan/ruangan.repository';
import PendaftaranRepository from '../pendaftaran/pendaftaran.repository';
import prisma from '../../infrastructures/db.infrastructure';
import redisService from '../../infrastructures/redis.infrastructure';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { hashCacheKey } from '../../utils/cache-key.util';

type JenisSeminarConfig = {
  id: string;
  kode: string;
  nama: string;
  is_aktif: boolean;
  wajib_pembimbing: number;
  wajib_penguji: number;
  ada_ketua_sidang: boolean;
};

type JadwalMutationInput = {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  kode_jenis?: string;
  id_jenis_seminar?: string;
  nim?: string;
  kode_ruangan?: string;
  penilai?: DosenAssignment[];
};

type GetAllJadwalParams = {
  jenis?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  start_date?: string;
  end_date?: string;
  kode_ruangan?: string;
  nim?: string;
  nip_dosen?: string;
  tahun_ajaran?: string;
  page?: number;
  limit?: number;
};

type GetJadwalDosenSayaParams = {
  search?: string;
  jenis?: string;
  tahun_ajaran?: string;
};

const BIMBINGAN_ROLES: PenilaiRole[] = [
  PenilaiRole.KP_PEMBIMBING,
  PenilaiRole.TA_PEMBIMBING_1,
  PenilaiRole.TA_PEMBIMBING_2,
];

const MENGUJI_ROLES: PenilaiRole[] = [
  PenilaiRole.KP_PENGUJI,
  PenilaiRole.TA_PENGUJI_1,
  PenilaiRole.TA_PENGUJI_2,
  PenilaiRole.TA_KETUA_SIDANG,
];

const KODE_TO_FRONTEND: Record<string, string> = {
  SEMKP: 'KP',
  SEMPRO: 'PROPOSAL',
  SEMHAS_LAPORAN: 'HASIL',
  SEMHAS_PAPERBASED: 'HASIL',
  SIDANG_LAPORAN: 'SIDANG_AKHIR',
  SIDANG_PAPERBASED: 'SIDANG_AKHIR',
};

export default class JadwalService {
  public static async getJadwalMahasiswaSaya(email: string) {
    return redisService.remember(`jadwal:mahasiswa:${email}`, 300, async () => {
      const jadwal = await JadwalRepository.findByMahasiswaEmail(email);

      return {
        response: true,
        message: jadwal.length
          ? 'Data jadwal mahasiswa berhasil diambil'
          : 'Data jadwal mahasiswa masih kosong',
        data: JadwalService.formatJadwalListRingkas(jadwal),
      };
    });
  }

  public static async getJadwalMahasiswaSayaById(email: string, id: string) {
    const jadwal = await JadwalRepository.findById(id);

    if (!jadwal) {
      throw new APIError(`Jadwal dengan ID ${id} tidak ditemukan`, 404);
    }

    if (jadwal.mahasiswa?.email !== email) {
      throw new APIError('Anda tidak memiliki akses ke jadwal ini', 403);
    }

    return {
      response: true,
      message: 'Detail jadwal mahasiswa berhasil diambil',
      data: JadwalService.formatJadwalDetailTimezone(jadwal),
    };
  }

  public static async getJadwalDosenSaya(
    email: string,
    params: GetJadwalDosenSayaParams = {}
  ) {
    return redisService.remember(
      `jadwal:dosen:${email}:${hashCacheKey(params)}`,
      300,
      async () => {
        const jadwal = await JadwalRepository.findByDosenEmail(email);
        let data = JadwalService.formatJadwalListTimezone(jadwal);

        if (params.jenis) {
          data = data.filter(
            (item: any) => item.jenis_seminar?.kode === params.jenis
          );
        }

        if (params.tahun_ajaran) {
          data = data.filter(
            (item: any) => item.kode_tahun_ajaran === params.tahun_ajaran
          );
        }

        if (params.search) {
          const fuse = new Fuse(data, {
            threshold: 0.3,
            ignoreLocation: true,
            keys: ['nim', 'mahasiswa.nim', 'mahasiswa.nama', 'mahasiswa.email'],
          });
          data = fuse.search(params.search).map((result) => result.item);
        }

        return {
          response: true,
          message: data.length
            ? 'Data jadwal dosen berhasil diambil'
            : 'Data jadwal dosen masih kosong',
          data,
        };
      }
    );
  }

  public static async getStatistikDosenSaya(email: string) {
    return redisService.remember(
      `jadwal:dosen-statistik:${email}`,
      300,
      async () => {
        const dosen = await DosenRepository.findByEmail(email);
        if (!dosen) {
          throw new APIError(
            'Data dosen tidak ditemukan untuk email ini.',
            404
          );
        }

        const penilaianList = await PenilaianRepository.findByDosenNip(
          dosen.nip
        );
        const now = JadwalHelper.getCurrentJakartaTime();
        const mahasiswaBimbingan = new Set<string>();
        const mahasiswaUji = new Set<string>();
        let mahasiswaTerdekat: any = null;

        for (const p of penilaianList) {
          const role = p.role as PenilaiRole;
          const j: any = p.jadwal;
          const nim = j.mahasiswa?.nim ?? j.nim;

          if (BIMBINGAN_ROLES.includes(role)) {
            mahasiswaBimbingan.add(nim);
          }

          if (MENGUJI_ROLES.includes(role)) {
            mahasiswaUji.add(nim);
          }

          const waktuMulai = JadwalHelper.convertToJakartaTimezone(
            j.waktu_mulai
          );
          const waktuSelesai = JadwalHelper.convertToJakartaTimezone(
            j.waktu_selesai
          );

          if (waktuMulai > now) {
            if (
              !mahasiswaTerdekat ||
              waktuMulai < mahasiswaTerdekat.waktu_mulai_raw
            ) {
              const kode = j.jenis_seminar?.kode || '';
              mahasiswaTerdekat = {
                nim,
                nama: j.mahasiswa?.nama ?? null,
                jenis_seminar: KODE_TO_FRONTEND[kode] || kode,
                tanggal: waktuMulai.toISOString().slice(0, 10),
                jam_mulai: waktuMulai.toISOString().slice(11, 16),
                jam_selesai: waktuSelesai.toISOString().slice(11, 16),
                ruangan: j.ruangan?.nama ?? null,
                role,
                waktu_mulai_raw: waktuMulai,
              };
            }
          }
        }

        if (mahasiswaTerdekat) {
          delete mahasiswaTerdekat.waktu_mulai_raw;
        }

        return {
          response: true,
          message: 'Berhasil mengambil statistik jadwal dosen',
          data: {
            total_seminar: penilaianList.length,
            total_mahasiswa_bimbingan: mahasiswaBimbingan.size,
            total_mahasiswa_uji: mahasiswaUji.size,
            mahasiswa_terdekat: mahasiswaTerdekat,
          },
        };
      }
    );
  }

  public static async getAllTahunAjaran() {
    const data = await JadwalRepository.getDistinctTahunAjaran();

    return {
      response: true,
      message: 'Daftar tahun ajaran jadwal berhasil diambil.',
      data: data.map((kode) => ({
        kode,
        nama: TahunAjaranHelper.parseStringNameByCode(kode),
      })),
    };
  }

  public static async getAll(params: GetAllJadwalParams = {}) {
    return redisService.remember(
      `jadwal:list:${hashCacheKey(params)}`,
      120,
      async () => {
        const page = Number(params.page ?? 1);
        const limit = Number(params.limit ?? 20);
        const offset = (page - 1) * limit;
        const tanggalMulai = params.tanggal_mulai
          ? new Date(params.tanggal_mulai)
          : params.start_date
            ? JadwalHelper.createDateFromJakartaDateTime(
                params.start_date,
                '00:00'
              )
            : undefined;
        const tanggalSelesai = params.tanggal_selesai
          ? new Date(params.tanggal_selesai)
          : params.end_date
            ? JadwalHelper.createDateFromJakartaDateTime(
                params.end_date,
                '23:59'
              )
            : undefined;
        const filters: JadwalFilter = {
          kode_ruangan: params.kode_ruangan,
          nim: params.nim,
          nip_dosen: params.nip_dosen,
          kode_tahun_ajaran: params.tahun_ajaran,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
        };

        if (params.jenis) {
          const jenis = await JadwalService.getJenisByKode(params.jenis);
          filters.id_jenis_seminar = jenis.id;
        }

        const [jadwal, total] = await Promise.all([
          JadwalRepository.findAll(filters, limit, offset),
          JadwalRepository.count(filters),
        ]);

        const dataWithTimezone = jadwal.map((j: any) => {
          return {
            ...JadwalService.formatJadwalTimezone(j),
            semester: JadwalService.calculateSemesterFromNimAndTahunAjaran(
              j.mahasiswa?.nim ?? j.nim,
              j.kode_tahun_ajaran
            ),
          };
        });

        return {
          response: true,
          message: dataWithTimezone.length
            ? 'Data semua jadwal berhasil diambil'
            : 'Data jadwal masih kosong',
          data: dataWithTimezone,
          meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
          },
        };
      }
    );
  }

  public static async get(id: string) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Data jadwal berhasil diambil',
      data: JadwalService.formatJadwalTimezone(jadwal),
    };
  }

  public static async post(
    data: Required<
      Pick<
        JadwalMutationInput,
        | 'tanggal'
        | 'waktu_mulai'
        | 'waktu_selesai'
        | 'nim'
        | 'kode_ruangan'
        | 'penilai'
      >
    > &
      JadwalMutationInput,
    context: LogJadwalContext
  ) {
    await JadwalService.validateMahasiswa(data.nim);
    await JadwalService.validateRuangan(data.kode_ruangan);

    const jenis = await JadwalService.validateJenisSeminar(data);
    JadwalService.validateUniquePenilaiAssignments(data.penilai);
    await JadwalService.validatePenilai(data.penilai, jenis);

    const waktuMulaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_mulai)
    );
    const waktuSelesaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_selesai)
    );
    const tanggalServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.tanggal)
    );

    await JadwalService.validateScheduleConflicts({
      nim: data.nim,
      kodeRuangan: data.kode_ruangan,
      waktuMulai: waktuMulaiServer,
      waktuSelesai: waktuSelesaiServer,
      penilai: data.penilai,
    });

    const id = await JadwalHelper.generateId(jenis.kode);
    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    const existing = await JadwalRepository.existsByMahasiswaAndJenis(
      data.nim,
      jenis.id,
      kode_tahun_ajaran
    );
    if (existing) {
      throw new APIError(
        `Mahasiswa ${data.nim} sudah memiliki jadwal untuk jenis ${jenis.kode}`,
        400
      );
    }

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      await JadwalRepository.create(
        {
          id,
          tanggal: tanggalServer,
          waktu_mulai: waktuMulaiServer,
          waktu_selesai: waktuSelesaiServer,
          id_jenis_seminar: jenis.id,
          nim: data.nim,
          kode_ruangan: data.kode_ruangan,
          kode_tahun_ajaran,
        },
        tx
      );

      await JadwalService.createPenilaianTx(tx, id, data.penilai);
      await PendaftaranRepository.updateStatusJadwalByJadwalData(
        data.nim,
        jenis.id,
        kode_tahun_ajaran,
        StatusJadwal.SUDAH_JADWAL,
        tx
      );
      const completeJadwal = await JadwalRepository.findById(id, tx);
      const formatted = JadwalService.formatJadwalTimezone(completeJadwal);

      await tx.log.create({
        data: {
          action: LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          new_values: JSON.parse(JSON.stringify(formatted)),
        },
      });

      return formatted;
    });

    await CacheInvalidation.invalidateJadwal();
    await CacheInvalidation.invalidatePendaftaran();

    return {
      response: true,
      message: 'Jadwal berhasil ditambahkan',
      data: jadwalWithTimezone,
    };
  }

  public static async put(
    id: string,
    data: JadwalMutationInput,
    context: LogJadwalContext
  ) {
    const existingJadwal = await JadwalRepository.findById(id);
    if (!existingJadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    if (data.nim) await JadwalService.validateMahasiswa(data.nim);
    if (data.kode_ruangan)
      await JadwalService.validateRuangan(data.kode_ruangan);

    const jenis =
      data.kode_jenis || data.id_jenis_seminar
        ? await JadwalService.validateJenisSeminar(data)
        : (existingJadwal.jenis_seminar as JenisSeminarConfig);

    const finalPenilai =
      data.penilai ??
      existingJadwal.penilaian.map((item: any) => ({
        nip: item.nip,
        role: item.role,
      }));
    JadwalService.validateUniquePenilaiAssignments(finalPenilai);
    await JadwalService.validatePenilai(finalPenilai, jenis);

    const waktuMulaiServer = data.waktu_mulai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_mulai))
      : existingJadwal.waktu_mulai;
    const waktuSelesaiServer = data.waktu_selesai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_selesai))
      : existingJadwal.waktu_selesai;
    const tanggalServer = data.tanggal
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.tanggal))
      : existingJadwal.tanggal;
    const finalNim = data.nim ?? existingJadwal.nim;
    const finalKodeRuangan = data.kode_ruangan ?? existingJadwal.kode_ruangan;

    await JadwalService.validateScheduleConflicts({
      nim: finalNim,
      kodeRuangan: finalKodeRuangan,
      waktuMulai: waktuMulaiServer,
      waktuSelesai: waktuSelesaiServer,
      penilai: finalPenilai,
      excludeId: id,
    });

    const duplicate = await JadwalRepository.existsByMahasiswaAndJenis(
      finalNim,
      jenis.id,
      existingJadwal.kode_tahun_ajaran,
      id
    );
    if (duplicate) {
      throw new APIError(
        `Mahasiswa ${finalNim} sudah memiliki jadwal untuk jenis ${jenis.kode}`,
        400
      );
    }

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      await JadwalRepository.update(
        id,
        {
          tanggal: tanggalServer,
          waktu_mulai: waktuMulaiServer,
          waktu_selesai: waktuSelesaiServer,
          id_jenis_seminar: jenis.id,
          nim: finalNim,
          kode_ruangan: finalKodeRuangan,
        },
        tx
      );

      if (data.penilai) {
        await tx.penilaian.deleteMany({ where: { id_jadwal: id } });
        await JadwalService.createPenilaianTx(tx, id, data.penilai);
      }

      const completeJadwal = await JadwalRepository.findById(id, tx);
      const formatted = JadwalService.formatJadwalTimezone(completeJadwal);

      await tx.log.create({
        data: {
          action: LogActionType.UPDATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          old_values: JSON.parse(JSON.stringify(existingJadwal)),
          new_values: JSON.parse(JSON.stringify(formatted)),
        },
      });

      return formatted;
    });

    await CacheInvalidation.invalidateJadwal();
    await CacheInvalidation.invalidatePendaftaran();

    return {
      response: true,
      message: 'Jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
    };
  }

  public static async delete(id: string, context: LogJadwalContext) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    const hasDetailPenilaian = jadwal.penilaian.some(
      (item: any) => item.detail_penilaian && item.detail_penilaian.length > 0
    );
    if (hasDetailPenilaian) {
      throw new APIError(
        'Jadwal tidak dapat dihapus karena sudah memiliki data penilaian',
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.penilaian.deleteMany({ where: { id_jadwal: id } });
      await JadwalRepository.destroy(id, tx);
      await PendaftaranRepository.updateStatusJadwalByJadwalData(
        jadwal.nim,
        jadwal.id_jenis_seminar,
        jadwal.kode_tahun_ajaran,
        StatusJadwal.BELUM_JADWAL,
        tx
      );
      await tx.log.create({
        data: {
          action: LogActionType.DELETE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          old_values: JSON.parse(JSON.stringify(jadwal)),
        },
      });
    });

    await CacheInvalidation.invalidateJadwal();
    await CacheInvalidation.invalidatePendaftaran();

    return {
      response: true,
      message: 'Jadwal berhasil dihapus',
    };
  }

  private static async validateJenisSeminar(
    data: Pick<JadwalMutationInput, 'kode_jenis' | 'id_jenis_seminar'>
  ): Promise<JenisSeminarConfig> {
    const jenis = data.kode_jenis
      ? await JadwalService.getJenisByKode(data.kode_jenis)
      : await JadwalService.getJenisById(data.id_jenis_seminar as string);

    if (!jenis.is_aktif) {
      throw new APIError(`Jenis seminar ${jenis.kode} sedang tidak aktif`, 400);
    }

    return jenis;
  }

  private static async getJenisByKode(
    kode: string
  ): Promise<JenisSeminarConfig> {
    const jenis = await prisma.jenis_seminar.findUnique({ where: { kode } });
    if (!jenis) {
      throw new APIError(
        `Jenis seminar dengan kode "${kode}" tidak ditemukan`,
        404
      );
    }
    return jenis;
  }

  private static async getJenisById(id: string): Promise<JenisSeminarConfig> {
    const jenis = await prisma.jenis_seminar.findUnique({ where: { id } });
    if (!jenis) {
      throw new APIError(
        `Jenis seminar dengan id "${id}" tidak ditemukan`,
        404
      );
    }
    return jenis;
  }

  private static validateUniquePenilaiAssignments(penilai: DosenAssignment[]) {
    const duplicatedNip = penilai.find(
      (item, index) =>
        penilai.findIndex((other) => other.nip === item.nip) !== index
    );
    if (duplicatedNip) {
      throw new APIError(
        `Dosen penilai ${duplicatedNip.nip} tidak boleh duplikat`,
        400
      );
    }

    const duplicatedRole = penilai.find(
      (item, index) =>
        penilai.findIndex((other) => other.role === item.role) !== index
    );
    if (duplicatedRole) {
      throw new APIError(
        `Role penilai ${duplicatedRole.role} tidak boleh duplikat`,
        400
      );
    }
  }

  private static async validateScheduleConflicts(params: {
    nim: string;
    kodeRuangan: string;
    waktuMulai: Date;
    waktuSelesai: Date;
    penilai: DosenAssignment[];
    excludeId?: string;
  }) {
    await RuanganHelper.cekKonflik(
      params.kodeRuangan,
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );

    const mahasiswaConflict = await JadwalRepository.existsByMahasiswaAndTime(
      params.nim,
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );
    if (mahasiswaConflict) {
      throw new APIError(
        'Mahasiswa sudah memiliki jadwal pada waktu tersebut',
        409
      );
    }

    await DosenHelper.cekKonflik(
      params.penilai.map((item) => item.nip),
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );
  }

  private static async createPenilaianTx(
    tx: any,
    id_jadwal: string,
    penilai: DosenAssignment[]
  ) {
    await tx.penilaian.createMany({
      data: penilai.map((item) => ({
        id_jadwal,
        nip: item.nip,
        role: item.role,
      })),
    });
  }

  public static async validateMahasiswa(nim: string) {
    const mahasiswa = await MahasiswaRepository.findByNIM(nim);
    if (!mahasiswa) {
      throw new APIError(`Mahasiswa dengan NIM ${nim} tidak ditemukan`, 404);
    }
    if (!mahasiswa.aktif) {
      throw new APIError(`Mahasiswa dengan NIM ${nim} tidak aktif`, 400);
    }
    return mahasiswa;
  }

  public static async validateDosen(nip: string, role: PenilaiRole) {
    const dosen = await DosenRepository.findByNip(nip);
    if (!dosen) {
      throw new APIError(
        `Dosen ${role} dengan NIP ${nip} tidak ditemukan`,
        404
      );
    }

    if (!dosen.email) {
      throw new APIError(`Dosen ${dosen.nama} belum memiliki email`, 400);
    }

    return dosen;
  }

  private static async validatePenilai(
    penilai: DosenAssignment[],
    jenis: JenisSeminarConfig
  ) {
    JadwalService.validatePenilaiComposition(penilai, jenis);
    await Promise.all(
      penilai.map((item) => JadwalService.validateDosen(item.nip, item.role))
    );
  }

  private static validatePenilaiComposition(
    penilai: DosenAssignment[],
    jenis: JenisSeminarConfig
  ) {
    const nips = penilai.map((item) => item.nip);
    if (new Set(nips).size !== nips.length) {
      throw new APIError('Dosen penilai tidak boleh duplikat', 400);
    }

    const pembimbingRoles: Set<PenilaiRole> = new Set([
      PenilaiRole.KP_PEMBIMBING,
      PenilaiRole.TA_PEMBIMBING_1,
      PenilaiRole.TA_PEMBIMBING_2,
    ]);
    const pengujiRoles: Set<PenilaiRole> = new Set([
      PenilaiRole.KP_PENGUJI,
      PenilaiRole.TA_PENGUJI_1,
      PenilaiRole.TA_PENGUJI_2,
    ]);
    const allowedRoles: Set<PenilaiRole> = new Set([
      ...pembimbingRoles,
      ...pengujiRoles,
      PenilaiRole.TA_KETUA_SIDANG,
    ]);

    const invalidRole = penilai.find((item) => !allowedRoles.has(item.role));
    if (invalidRole) {
      throw new APIError(
        `Role ${invalidRole.role} tidak valid untuk jadwal seminar`,
        400
      );
    }

    const pembimbingCount = penilai.filter((item) =>
      pembimbingRoles.has(item.role)
    ).length;
    const pengujiCount = penilai.filter((item) =>
      pengujiRoles.has(item.role)
    ).length;
    const ketuaCount = penilai.filter(
      (item) => item.role === PenilaiRole.TA_KETUA_SIDANG
    ).length;

    if (pembimbingCount !== jenis.wajib_pembimbing) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} membutuhkan ${jenis.wajib_pembimbing} pembimbing`,
        400
      );
    }

    if (pengujiCount !== jenis.wajib_penguji) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} membutuhkan ${jenis.wajib_penguji} penguji`,
        400
      );
    }

    if (jenis.ada_ketua_sidang && ketuaCount !== 1) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} membutuhkan 1 ketua sidang`,
        400
      );
    }

    if (!jenis.ada_ketua_sidang && ketuaCount > 0) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} tidak membutuhkan ketua sidang`,
        400
      );
    }
  }

  public static async validateRuangan(kode_ruangan: string) {
    const ruangan = await RuanganRepository.findByKode(kode_ruangan);
    if (!ruangan) {
      throw new APIError(
        `Ruangan dengan kode ${kode_ruangan} tidak ditemukan`,
        404
      );
    }
    if (!ruangan.status) {
      throw new APIError(`Ruangan ${ruangan.nama} sedang tidak tersedia`, 400);
    }
    return ruangan;
  }

  private static formatJadwalListTimezone(jadwal: any[]) {
    return jadwal.map((item) => JadwalService.formatJadwalTimezone(item));
  }

  private static formatJadwalListRingkas(jadwal: any[]) {
    return jadwal.map((item) => {
      const formatted = JadwalService.formatJadwalTimezone(item);
      const { penilai, ...ringkas } = formatted;
      return {
        ...ringkas,
        tahun_ajaran_nama: item?.kode_tahun_ajaran
          ? TahunAjaranHelper.parseStringNameByCode(item.kode_tahun_ajaran)
          : null,
        penilaian: Array.isArray(item?.penilaian)
          ? item.penilaian.map((penilaian: any) => {
              const { detail_penilaian, ...penilaianRingkas } = penilaian;
              return penilaianRingkas;
            })
          : [],
      };
    });
  }

  private static calculateSemesterFromNimAndTahunAjaran(
    nim?: string,
    tahunAjaran?: string
  ) {
    if (!nim || nim.length < 3 || !tahunAjaran || tahunAjaran.length < 5) {
      return null;
    }

    const angkatan = Number(`20${nim.slice(1, 3)}`);
    const tahunMulaiAjaran = Number(tahunAjaran.slice(0, 4));
    const semesterTahunAjaran = Number(tahunAjaran.slice(4));
    if (
      Number.isNaN(angkatan) ||
      Number.isNaN(tahunMulaiAjaran) ||
      ![1, 2].includes(semesterTahunAjaran)
    ) {
      return null;
    }

    return Math.max(1, (tahunMulaiAjaran - angkatan) * 2 + semesterTahunAjaran);
  }

  private static formatJadwalTimezone(jadwal: any) {
    return {
      ...jadwal,
      penilai: JadwalService.formatPenilai(jadwal?.penilaian, false),
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_selesai)
        : null,
    };
  }

  private static formatJadwalDetailTimezone(jadwal: any) {
    return {
      ...jadwal,
      tahun_ajaran_nama: jadwal?.kode_tahun_ajaran
        ? TahunAjaranHelper.parseStringNameByCode(jadwal.kode_tahun_ajaran)
        : null,
      penilaian: Array.isArray(jadwal?.penilaian) ? jadwal.penilaian : [],
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_selesai)
        : null,
    };
  }

  private static formatPenilai(
    penilaian: any,
    includeDetailPenilaian: boolean
  ) {
    if (!Array.isArray(penilaian)) {
      return [];
    }

    return penilaian.map((item: any) => ({
      id: item.id,
      nip: item.nip,
      role: item.role,
      dosen: item.dosen
        ? {
            nip: item.dosen.nip,
            nama: item.dosen.nama,
            email: item.dosen.email,
            no_hp: item.dosen.no_hp,
          }
        : null,
      ...(includeDetailPenilaian
        ? { detail_penilaian: item.detail_penilaian ?? [] }
        : {}),
    }));
  }
}
