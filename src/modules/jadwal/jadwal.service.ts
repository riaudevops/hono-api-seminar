import Fuse from 'fuse.js';
import {
  LogActionType,
  LogActorType,
  LogEntityType,
  PenilaiRole,
  StatusJadwal,
  type StatusBerkas,
  type StatusKelulusan,
} from '@prisma/client';
import JadwalRepository, { type JadwalFilter } from './jadwal.repository';
import JadwalEmailService from './jadwal-email.service';
import { APIError } from '../../utils/api-error.util';
import type { DosenAssignment, LogJadwalContext } from './jadwal.type';
import JadwalHelper from '../../helpers/jadwal.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import { MahasiswaModuleRepository as MahasiswaRepository } from '../mahasiswa';
import { DosenModuleRepository as DosenRepository } from '../dosen';
import PenilaianRepository from '../penilaian/penilaian.repository';
import RuanganRepository from '../ruangan/ruangan.repository';
import PendaftaranRepository from '../pendaftaran/pendaftaran.repository';
import prisma from '../../infrastructures/db.infrastructure';
import redisService from '../../infrastructures/redis.infrastructure';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { LogService } from '../log';
import { hashCacheKey } from '../../utils/cache-key.util';
import googleCalendarService from '../../infrastructures/google-calendar.infrastructure';
import WorkerJobService from '../worker-job/worker-job.service';
import {
  WorkerJobType,
  type WorkerJadwalEmailAction,
} from '../worker-job/worker-job.type';
import { createLogger } from '../../utils/logger.util';

const logger = createLogger('JadwalService');

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

type UpdateStatusKelulusanContext = LogJadwalContext & {
  actor_email?: string;
  dosen_nip?: string;
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
  status_kelulusan?: StatusKelulusan;
  page?: number;
  limit?: number;
};

type GetJadwalDosenSayaParams = {
  search?: string;
  jenis?: string;
  tahun_ajaran?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  kode_ruangan?: string;
  nim?: string;
  status_kelulusan?: StatusKelulusan;
  status_berkas?: StatusBerkas;
  status_jadwal?: StatusJadwal;
  page?: number;
  limit?: number;
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

const ROLE_TO_FRONTEND: Record<PenilaiRole, string> = {
  [PenilaiRole.KP_PEMBIMBING]: 'PEMBIMBING_1',
  [PenilaiRole.KP_PENGUJI]: 'PENGUJI_1',
  [PenilaiRole.TA_PEMBIMBING_1]: 'PEMBIMBING_1',
  [PenilaiRole.TA_PEMBIMBING_2]: 'PEMBIMBING_2',
  [PenilaiRole.TA_PENGUJI_1]: 'PENGUJI_1',
  [PenilaiRole.TA_PENGUJI_2]: 'PENGUJI_2',
  [PenilaiRole.TA_KETUA_SIDANG]: 'KETUA_SIDANG',
  [PenilaiRole.KP_INSTANSI]: 'INSTANSI',
  [PenilaiRole.ARTIKEL_TA]: 'ARTIKEL_TA',
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
      `jadwal:dosen:ringkas:${email}:${hashCacheKey(params)}`,
      300,
      async () => {
        const jadwal = await JadwalRepository.findByDosenEmail(email);
        const jadwalWithPendaftaran =
          await JadwalService.attachPendaftaranDosen(jadwal);
        let data = jadwalWithPendaftaran;

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

        if (params.tanggal_mulai) {
          data = data.filter((item: any) => {
            const tanggal = item.tanggal
              ? JadwalHelper.formatDateInJakarta(item.tanggal)
              : null;
            return tanggal !== null && tanggal >= params.tanggal_mulai!;
          });
        }

        if (params.tanggal_selesai) {
          data = data.filter((item: any) => {
            const tanggal = item.tanggal
              ? JadwalHelper.formatDateInJakarta(item.tanggal)
              : null;
            return tanggal !== null && tanggal <= params.tanggal_selesai!;
          });
        }

        if (params.kode_ruangan) {
          data = data.filter(
            (item: any) => item.kode_ruangan === params.kode_ruangan
          );
        }

        if (params.nim) {
          data = data.filter((item: any) => item.nim === params.nim);
        }

        if (params.status_kelulusan) {
          data = data.filter(
            (item: any) => item.status_kelulusan === params.status_kelulusan
          );
        }

        if (params.status_berkas) {
          data = data.filter(
            (item: any) =>
              item.pendaftaran?.status_berkas === params.status_berkas
          );
        }

        if (params.status_jadwal) {
          data = data.filter(
            (item: any) =>
              item.pendaftaran?.status_jadwal === params.status_jadwal
          );
        }

        let ringkasData = data.map((item: any) =>
          JadwalService.formatJadwalDosenSayaRingkas(item, email)
        );

        if (params.search) {
          const fuse = new Fuse(ringkasData, {
            threshold: 0.3,
            ignoreLocation: true,
            keys: [
              'id',
              'mahasiswa.nim',
              'mahasiswa.nama',
              'mahasiswa.email',
              'dosen.role',
              'dosen.peran_dosen',
              'jenis_seminar.kode',
              'jenis_seminar.nama',
              'ruangan.kode',
              'ruangan.nama',
            ],
          });
          ringkasData = fuse.search(params.search).map((result) => result.item);
        }

        const total = ringkasData.length;
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;
        const total_page = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const paginatedData = ringkasData.slice(start, start + limit);

        return {
          response: true,
          message: paginatedData.length
            ? 'Data jadwal dosen berhasil diambil'
            : 'Data jadwal dosen masih kosong',
          data: paginatedData,
          pagination: {
            page,
            limit,
            total,
            total_page,
          },
        };
      }
    );
  }

  public static async getJadwalDosenSayaById(email: string, id: string) {
    return redisService.remember(
      `jadwal:dosen:detail:${email}:${id}`,
      300,
      async () => {
        const jadwal = await JadwalRepository.findById(id);

        if (!jadwal) {
          throw new APIError(`Jadwal dengan ID ${id} tidak ditemukan`, 404);
        }

        const penilaianLogin = JadwalService.findPenilaianDosenLogin(
          jadwal,
          email
        );
        if (!penilaianLogin) {
          throw new APIError('Anda tidak memiliki akses ke jadwal ini', 403);
        }

        const [jadwalWithPendaftaran] =
          await JadwalService.attachPendaftaranDosen([jadwal]);
        const detail = JadwalService.formatJadwalDetailTimezone(
          jadwalWithPendaftaran
        );

        return {
          response: true,
          message: 'Detail jadwal dosen berhasil diambil',
          data: {
            ...detail,
            tahun_ajaran: detail?.kode_tahun_ajaran
              ? TahunAjaranHelper.parseStringNameByCode(
                  detail.kode_tahun_ajaran
                )
              : null,
            angkatan: JadwalService.calculateAngkatanFromNim(
              detail.mahasiswa?.nim ?? detail.nim
            ),
            semester: JadwalService.calculateSemesterFromNimAndTahunAjaran(
              detail.mahasiswa?.nim ?? detail.nim,
              detail.kode_tahun_ajaran
            ),
            dosen_login: JadwalService.formatDosenLoginRole(penilaianLogin),
          },
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
        const now = new Date();
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

          const waktuMulai = j.waktu_mulai;
          const waktuSelesai = j.waktu_selesai;

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
                tanggal: JadwalHelper.formatDateInJakarta(waktuMulai),
                jam_mulai: JadwalHelper.formatTimeInJakarta(waktuMulai),
                jam_selesai: JadwalHelper.formatTimeInJakarta(waktuSelesai),
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
          status_kelulusan: params.status_kelulusan,
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

    const jadwalWithAllPenilaianRoles =
      await JadwalService.attachAllPenilaianRoles(jadwal);

    return {
      response: true,
      message: 'Data jadwal berhasil diambil',
      data: JadwalService.formatJadwalTimezone(jadwalWithAllPenilaianRoles),
    };
  }

  public static async getPenilaianByJadwal(id: string) {
    const jadwal = await prisma.jadwal.findUnique({
      where: { id },
      include: {
        mahasiswa: true,
        jenis_seminar: true,
        ruangan: true,
      },
    });

    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    const penilaianList = (await prisma.penilaian.findMany({
      where: { id_jadwal: id },
      include: {
        dosen: true,
        detail_penilaian: {
          include: { komponen: true },
        },
      },
      orderBy: { role: 'asc' },
    })) as any[];

    const penilaian = await JadwalService.buildAllPenilaianRoles(
      jadwal.id_jenis_seminar,
      penilaianList
    );
    const nilaiSummary = await JadwalService.buildNilaiSummary(
      jadwal.id_jenis_seminar,
      penilaian
    );

    if (!penilaian.length) {
      throw new APIError(
        `Jenis seminar pada jadwal ID ${id} belum memiliki komponen penilaian aktif.`,
        404
      );
    }

    return {
      response: true,
      message: 'Data penilaian jadwal berhasil diambil',
      data: {
        jadwal: JadwalService.formatJadwalTimezone(jadwal),
        penilaian,
        nilai_lengkap: nilaiSummary.nilai_lengkap,
      },
    };
  }

  public static async submitPenilaianByJadwalRole(
    idJadwal: string,
    role: PenilaiRole,
    details: { id_komponen: string; nilai: number }[],
    context: LogJadwalContext
  ) {
    if (context.actor_type !== LogActorType.KOORDINATOR) {
      throw new APIError(
        'Hanya koordinator yang dapat mengisi nilai role ini.',
        403
      );
    }

    const jadwal = await JadwalRepository.findById(idJadwal);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan.', 404);
    }

    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar: jadwal.id_jenis_seminar,
        role,
        is_aktif: true,
      },
    });

    if (!activeComponents.length) {
      throw new APIError(
        `Komponen penilaian aktif untuk role ${role} pada jenis seminar ini tidak ditemukan.`,
        404
      );
    }

    const activeComponentIds = new Set(activeComponents.map((c) => c.id));
    for (const item of details) {
      if (!activeComponentIds.has(item.id_komponen)) {
        throw new APIError(
          `Komponen ${item.id_komponen} tidak valid atau tidak aktif untuk role ${role} pada jenis seminar ini`,
          400
        );
      }
    }

    const idPenilaian = await prisma.$transaction(async (tx) => {
      let penilaian = await tx.penilaian.findUnique({
        where: {
          id_jadwal_role: {
            id_jadwal: idJadwal,
            role,
          },
        },
      });

      if (!penilaian) {
        penilaian = await tx.penilaian.create({
          data: {
            id_jadwal: idJadwal,
            role,
            nip: null,
          } as any,
        });
      }

      for (const item of details) {
        const existing = await tx.detail_penilaian.findUnique({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian: penilaian.id,
              id_komponen: item.id_komponen,
            },
          },
        });

        await tx.detail_penilaian.upsert({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian: penilaian.id,
              id_komponen: item.id_komponen,
            },
          },
          update: { nilai: item.nilai },
          create: {
            id_penilaian: penilaian.id,
            id_komponen: item.id_komponen,
            nilai: item.nilai,
          },
        });

        await LogService.createPenilaianLogTx(tx, {
          action: existing ? LogActionType.UPDATE : LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          id_jadwal: idJadwal,
          id_komponen_penilaian: item.id_komponen,
          old_nilai: existing ? existing.nilai : null,
          new_nilai: item.nilai,
        });
      }

      return penilaian.id;
    });

    return {
      response: true,
      message: 'Penilaian berhasil disimpan.',
      data: {
        id_penilaian: idPenilaian,
        id_jadwal: idJadwal,
        role,
      },
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

    const waktuMulaiServer = JadwalHelper.createDateFromFrontendZAsJakarta(
      new Date(data.waktu_mulai)
    );
    const waktuSelesaiServer = JadwalHelper.createDateFromFrontendZAsJakarta(
      new Date(data.waktu_selesai)
    );
    const tanggalServer = JadwalHelper.createDateFromFrontendZAsJakarta(
      new Date(data.tanggal)
    );

    await JadwalService.validateScheduleConflicts({
      nim: data.nim,
      kodeRuangan: data.kode_ruangan,
      waktuMulai: waktuMulaiServer,
      waktuSelesai: waktuSelesaiServer,
      penilai: data.penilai,
    });

    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();
    let createdId = '';

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      const existing = await JadwalRepository.existsByMahasiswaAndJenis(
        data.nim,
        jenis.id,
        kode_tahun_ajaran,
        undefined,
        tx
      );
      if (existing) {
        throw new APIError(
          `Mahasiswa ${data.nim} sudah memiliki jadwal untuk jenis ${jenis.kode}`,
          400
        );
      }

      const id = await JadwalHelper.generateId(jenis.kode, tx);
      createdId = id;

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

      await JadwalService.createPenilaianTx(tx, id, data.penilai, jenis.kode);
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

    const googleCalendarJob =
      await JadwalService.enqueueGoogleCalendarInvitation(createdId, 'created');
    const notificationEmailJob = await JadwalEmailService.enqueueById(
      createdId,
      'scheduled'
    );

    return {
      response: true,
      message: 'Jadwal berhasil ditambahkan',
      data: jadwalWithTimezone,
      google_calendar: googleCalendarJob,
      notification_email: notificationEmailJob,
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

    const finalPenilai = data.penilai
      ? data.penilai
      : JadwalService.getAssignablePenilai(existingJadwal.penilaian);
    JadwalService.validateUniquePenilaiAssignments(finalPenilai);
    await JadwalService.validatePenilai(finalPenilai, jenis);

    const waktuMulaiServer = data.waktu_mulai
      ? JadwalHelper.createDateFromFrontendZAsJakarta(
          new Date(data.waktu_mulai)
        )
      : existingJadwal.waktu_mulai;
    const waktuSelesaiServer = data.waktu_selesai
      ? JadwalHelper.createDateFromFrontendZAsJakarta(
          new Date(data.waktu_selesai)
        )
      : existingJadwal.waktu_selesai;
    const tanggalServer = data.tanggal
      ? JadwalHelper.createDateFromFrontendZAsJakarta(new Date(data.tanggal))
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
        await JadwalService.createPenilaianTx(tx, id, data.penilai, jenis.kode);
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

    const googleCalendarJob =
      await JadwalService.enqueueGoogleCalendarInvitation(id, 'updated');

    return {
      response: true,
      message: 'Jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
      google_calendar: googleCalendarJob,
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

  public static async patchStatusKelulusan(
    id: string,
    status_kelulusan: StatusKelulusan,
    context: UpdateStatusKelulusanContext
  ) {
    const existingJadwal = await JadwalRepository.findById(id);
    if (!existingJadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    await JadwalService.authorizeUpdateStatusKelulusan(existingJadwal, context);

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      await JadwalRepository.updateStatusKelulusan(
        id,
        { status_kelulusan },
        tx
      );
      const updatedJadwal = await JadwalRepository.findById(id, tx);
      const formatted = JadwalService.formatJadwalTimezone(updatedJadwal);

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
    const notificationEmailJob = await JadwalEmailService.enqueueById(
      id,
      'status_kelulusan_updated'
    );

    return {
      response: true,
      message: 'Status kelulusan jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
      notification_email: notificationEmailJob,
    };
  }

  private static async enqueueGoogleCalendarInvitation(
    jadwalId: string,
    action: WorkerJadwalEmailAction
  ) {
    try {
      const job = await WorkerJobService.enqueue(
        WorkerJobType.JADWAL_EMAIL_SEND,
        { jadwalId, action },
        { maxAttempts: 5 }
      );
      return {
        success: true,
        queued: true,
        job_id: job.id,
        status: job.status,
        message: 'Undangan jadwal akan dikirim oleh worker.',
      };
    } catch (error: any) {
      logger.error('Google Calendar invitation queue failed', {
        jadwalId,
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        queued: false,
        skipped: false,
        message:
          'Jadwal tersimpan, tetapi undangan Google Calendar gagal masuk antrean worker',
        error: error?.message ?? 'Unknown error',
      };
    }
  }

  public static async sendGoogleCalendarInvitationById(
    jadwalId: string,
    action: WorkerJadwalEmailAction
  ) {
    const jadwal = await JadwalRepository.findById(jadwalId);
    if (!jadwal) {
      logger.warn('Google Calendar invitation skipped: jadwal not found', {
        jadwalId,
        action,
      });
      return {
        success: false,
        skipped: true,
        message: 'Jadwal tidak ditemukan, undangan Google Calendar dilewati',
      };
    }

    try {
      return await googleCalendarService.syncJadwalInvitation(jadwal, action);
    } catch (error: any) {
      logger.error('Google Calendar API Error', {
        jadwalId,
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private static async authorizeUpdateStatusKelulusan(
    jadwal: any,
    context: UpdateStatusKelulusanContext
  ) {
    if (context.actor_type === LogActorType.KOORDINATOR) {
      return;
    }

    if (context.actor_type !== LogActorType.DOSEN) {
      throw new APIError(
        'Hanya dosen atau koordinator yang dapat mengubah status kelulusan',
        403
      );
    }

    let dosenNip = context.dosen_nip;
    if (!dosenNip && context.actor_email) {
      const dosen = await DosenRepository.findByEmail(context.actor_email);
      dosenNip = dosen?.nip;
    }

    if (!dosenNip) {
      throw new APIError('Data dosen tidak ditemukan untuk akun ini', 404);
    }

    const isPenilai = Array.isArray(jadwal.penilaian)
      ? jadwal.penilaian.some((penilaian: any) => penilaian.nip === dosenNip)
      : false;

    if (!isPenilai) {
      throw new APIError(
        'Dosen hanya dapat mengubah status kelulusan pada jadwal yang diampu',
        403
      );
    }
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

  private static getAssignablePenilai(penilaian: any[]): DosenAssignment[] {
    const assignableRoles = new Set<PenilaiRole>([
      PenilaiRole.KP_PEMBIMBING,
      PenilaiRole.KP_PENGUJI,
      PenilaiRole.TA_PEMBIMBING_1,
      PenilaiRole.TA_PEMBIMBING_2,
      PenilaiRole.TA_PENGUJI_1,
      PenilaiRole.TA_PENGUJI_2,
      PenilaiRole.TA_KETUA_SIDANG,
    ]);

    return penilaian
      .filter((item: any) => item.nip && assignableRoles.has(item.role))
      .map((item: any) => ({
        nip: item.nip,
        role: item.role,
      }));
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
    penilai: DosenAssignment[],
    kodeJenisSeminar: string
  ) {
    const penilaianData = penilai.map((item) => ({
      id_jadwal,
      nip: item.nip,
      role: item.role,
    }));

    if (kodeJenisSeminar === 'SIDANG_PAPERBASED') {
      const ketuaSidang = penilai.find(
        (item) => item.role === PenilaiRole.TA_KETUA_SIDANG
      );

      if (ketuaSidang) {
        penilaianData.push({
          id_jadwal,
          nip: ketuaSidang.nip,
          role: PenilaiRole.ARTIKEL_TA,
        });
      }
    }

    await tx.penilaian.createMany({
      data: penilaianData,
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

    if (jenis.ada_ketua_sidang && ketuaCount > 1) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} maksimal memiliki 1 ketua sidang`,
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

  private static findPenilaianDosenLogin(jadwal: any, email: string) {
    if (!Array.isArray(jadwal?.penilaian)) {
      return null;
    }

    return (
      jadwal.penilaian.find(
        (item: any) => item?.dosen?.email?.toLowerCase() === email.toLowerCase()
      ) ?? null
    );
  }

  private static formatDosenLoginRole(penilaian: any) {
    if (!penilaian) {
      return null;
    }

    return {
      nip: penilaian.nip ?? penilaian.dosen?.nip ?? null,
      nama: penilaian.dosen?.nama ?? null,
      email: penilaian.dosen?.email ?? null,
      role: penilaian.role,
      peran_dosen: ROLE_TO_FRONTEND[penilaian.role as PenilaiRole],
    };
  }

  private static formatJadwalDosenSayaRingkas(jadwal: any, email: string) {
    const penilaianLogin = JadwalService.findPenilaianDosenLogin(jadwal, email);
    const jenisKode = jadwal?.jenis_seminar?.kode ?? null;

    return {
      id: jadwal.id,
      mahasiswa: jadwal.mahasiswa
        ? {
            nim: jadwal.mahasiswa.nim,
            nama: jadwal.mahasiswa.nama,
            email: jadwal.mahasiswa.email,
          }
        : {
            nim: jadwal.nim ?? null,
            nama: null,
            email: null,
          },
      dosen: JadwalService.formatDosenLoginRole(penilaianLogin),
      jenis_seminar: jadwal.jenis_seminar
        ? {
            id: jadwal.jenis_seminar.id,
            kode: jadwal.jenis_seminar.kode,
            nama: jadwal.jenis_seminar.nama,
            label: jenisKode ? KODE_TO_FRONTEND[jenisKode] || jenisKode : null,
          }
        : null,
      tanggal: jadwal?.tanggal
        ? JadwalHelper.formatDateInJakarta(jadwal.tanggal)
        : null,
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_selesai)
        : null,
      ruangan: jadwal.ruangan
        ? {
            kode: jadwal.ruangan.kode,
            nama: jadwal.ruangan.nama,
          }
        : null,
      status_kelulusan: jadwal.status_kelulusan,
      kode_tahun_ajaran: jadwal.kode_tahun_ajaran,
      tahun_ajaran_nama: jadwal?.kode_tahun_ajaran
        ? TahunAjaranHelper.parseStringNameByCode(jadwal.kode_tahun_ajaran)
        : null,
    };
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

  private static async attachPendaftaranDosen(jadwal: any[]) {
    if (!Array.isArray(jadwal) || jadwal.length === 0) {
      return jadwal;
    }

    const jadwalKeyMap = new Map<
      string,
      { nim: string; id_jenis_seminar: string; kode_tahun_ajaran: string }
    >();

    for (const item of jadwal) {
      if (!item?.nim || !item?.id_jenis_seminar || !item?.kode_tahun_ajaran) {
        continue;
      }

      const key = `${item.nim}|${item.id_jenis_seminar}|${item.kode_tahun_ajaran}`;
      jadwalKeyMap.set(key, {
        nim: item.nim,
        id_jenis_seminar: item.id_jenis_seminar,
        kode_tahun_ajaran: item.kode_tahun_ajaran,
      });
    }

    const pendaftaranWhere = Array.from(jadwalKeyMap.values());
    if (pendaftaranWhere.length === 0) {
      return jadwal.map((item) => ({ ...item, pendaftaran: null }));
    }

    const pendaftaranList = await prisma.pendaftaran.findMany({
      where: { OR: pendaftaranWhere },
      include: {
        jenis_seminar: true,
        data_pendaftaran: {
          where: {
            dokumen_template: {
              can_view_dosen: true,
            },
          },
          include: {
            dokumen_template: {
              select: {
                id: true,
                kode: true,
                nama: true,
                tipe_input: true,
                format_file: true,
                max_size_mb: true,
                can_view_dosen: true,
                is_special: true,
              },
            },
          },
          orderBy: { id_dokumen_template: 'asc' },
        },
      },
    });

    const pendaftaranMap = new Map<string, (typeof pendaftaranList)[number]>();
    for (const pendaftaran of pendaftaranList) {
      const key = `${pendaftaran.nim}|${pendaftaran.id_jenis_seminar}|${pendaftaran.kode_tahun_ajaran}`;
      pendaftaranMap.set(key, pendaftaran);
    }

    return jadwal.map((item) => {
      const key = `${item.nim}|${item.id_jenis_seminar}|${item.kode_tahun_ajaran}`;
      const pendaftaran = pendaftaranMap.get(key);

      return {
        ...item,
        pendaftaran: pendaftaran
          ? {
              ...pendaftaran,
              mahasiswa: item.mahasiswa ?? null,
            }
          : null,
      };
    });
  }

  private static async attachAllPenilaianRoles(jadwal: any) {
    const penilaian = await JadwalService.buildAllPenilaianRoles(
      jadwal.id_jenis_seminar,
      jadwal.penilaian ?? []
    );
    const nilaiSummary = await JadwalService.buildNilaiSummary(
      jadwal.id_jenis_seminar,
      penilaian
    );

    return {
      ...jadwal,
      penilaian,
      nilai_lengkap: nilaiSummary.nilai_lengkap,
    };
  }

  private static async buildNilaiSummary(
    idJenisSeminar: string,
    penilaian: any[]
  ) {
    const round = (value: number) => Math.round(value * 100) / 100;
    const getNilaiHuruf = (nilai: number | null) => {
      if (nilai == null) return null;
      if (nilai >= 85) return 'A';
      if (nilai >= 80) return 'A-';
      if (nilai >= 75) return 'B+';
      if (nilai >= 70) return 'B';
      if (nilai >= 65) return 'B-';
      if (nilai >= 60) return 'C+';
      if (nilai >= 55) return 'C';
      if (nilai >= 50) return 'D';
      return 'E';
    };
    const nilaiFull = penilaian.map((item) => {
      const totalPersentaseKomponen = (item.komponen ?? []).reduce(
        (sum: number, komponen: any) => sum + (komponen.persentase ?? 0),
        0
      );
      const totalPersentaseDinilai = (item.komponen ?? []).reduce(
        (sum: number, komponen: any) =>
          komponen.nilai != null ? sum + (komponen.persentase ?? 0) : sum,
        0
      );
      const nilaiKalkulasi = (item.komponen ?? []).reduce(
        (sum: number, komponen: any) =>
          komponen.nilai != null
            ? sum + komponen.nilai * ((komponen.persentase ?? 0) / 100)
            : sum,
        0
      );

      return {
        id_penilaian: item.id_penilaian,
        role: item.role,
        nip: item.nip,
        dosen: item.dosen,
        has_penilaian: item.has_penilaian,
        status: item.status,
        total_persentase_komponen: totalPersentaseKomponen,
        total_persentase_dinilai: totalPersentaseDinilai,
        is_komponen_lengkap:
          totalPersentaseKomponen > 0 &&
          totalPersentaseDinilai >= totalPersentaseKomponen,
        nilai_kalkulasi:
          totalPersentaseDinilai > 0 ? round(nilaiKalkulasi) : null,
        nilai_akhir: item.nilai_akhir != null ? round(item.nilai_akhir) : null,
      };
    });

    const bobotList = await prisma.bobot_penilai.findMany({
      where: { id_jenis_seminar: idJenisSeminar },
      orderBy: { role: 'asc' },
    });
    const nilaiByRole = new Map<PenilaiRole, (typeof nilaiFull)[number]>(
      nilaiFull.map((item) => [item.role as PenilaiRole, item])
    );

    let totalNilai = 0;
    let totalBobot = 0;
    const detail = bobotList.map((bobot) => {
      const nilaiRole = nilaiByRole.get(bobot.role);
      const nilaiKalkulasi = nilaiRole?.nilai_kalkulasi ?? null;
      const kontribusi =
        nilaiKalkulasi != null
          ? round(nilaiKalkulasi * (bobot.persentase / 100))
          : null;

      totalBobot += bobot.persentase;
      if (kontribusi != null) totalNilai += kontribusi;

      return {
        id_bobot_penilai: bobot.id,
        role: bobot.role,
        bobot_persentase: bobot.persentase,
        id_penilaian: nilaiRole?.id_penilaian ?? null,
        has_penilaian: nilaiRole?.has_penilaian ?? false,
        status: nilaiRole?.status ?? 'Belum Ada Penilai',
        nilai_role: nilaiKalkulasi,
        kontribusi_nilai: kontribusi,
      };
    });

    const totalNilaiAkhir = detail.length ? round(totalNilai) : null;

    return {
      nilai_lengkap: {
        total_nilai: totalNilaiAkhir,
        nilai_huruf: getNilaiHuruf(totalNilaiAkhir),
        total_bobot_persentase: totalBobot,
        is_bobot_lengkap: totalBobot === 100,
        detail,
      },
    };
  }

  private static async buildAllPenilaianRoles(
    idJenisSeminar: string,
    penilaianList: any[]
  ) {
    const komponenList = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar: idJenisSeminar,
        is_aktif: true,
      },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });

    const roles = Array.from(new Set(komponenList.map((item) => item.role)));
    const komponenByRole = new Map<PenilaiRole, typeof komponenList>();
    for (const role of roles) {
      komponenByRole.set(
        role,
        komponenList.filter((komponen) => komponen.role === role)
      );
    }

    const penilaianByRole = new Map<PenilaiRole, any>(
      penilaianList.map((item) => [item.role, item])
    );

    return roles.map((role) => {
      const item = penilaianByRole.get(role);
      const detailPenilaian = item?.detail_penilaian ?? [];
      const nilaiByKomponen = new Map<string, any>(
        detailPenilaian.map((detail: any) => [detail.id_komponen, detail])
      );
      let nilaiAkhir = 0;
      let totalPersentaseDinilai = 0;

      const komponen = (komponenByRole.get(role) ?? []).map((komponenItem) => {
        const detail = nilaiByKomponen.get(komponenItem.id);
        if (detail) {
          nilaiAkhir += detail.nilai * (komponenItem.persentase / 100);
          totalPersentaseDinilai += komponenItem.persentase;
        }

        return {
          id: komponenItem.id,
          nama: komponenItem.nama,
          persentase: komponenItem.persentase,
          is_aktif: komponenItem.is_aktif,
          nilai: detail?.nilai ?? null,
          catatan: detail?.catatan ?? null,
          id_detail_penilaian: detail?.id ?? null,
        };
      });

      return {
        id: item?.id ?? null,
        id_penilaian: item?.id ?? null,
        id_jadwal: item?.id_jadwal ?? null,
        role,
        nip: item?.nip ?? null,
        dosen: item?.dosen
          ? {
              nip: item.dosen.nip,
              nama: item.dosen.nama,
              email: item.dosen.email,
              no_hp: item.dosen.no_hp,
            }
          : null,
        has_penilaian: Boolean(item),
        status: !item
          ? 'Belum Ada Penilai'
          : detailPenilaian.length
            ? 'Sudah Dinilai'
            : 'Belum Dinilai',
        nilai_akhir:
          totalPersentaseDinilai > 0
            ? (nilaiAkhir / totalPersentaseDinilai) * 100
            : null,
        detail_penilaian: detailPenilaian,
        komponen,
      };
    });
  }

  private static calculateAngkatanFromNim(nim?: string) {
    if (!nim || nim.length < 3) {
      return null;
    }

    const angkatan = Number(`20${nim.slice(1, 3)}`);
    return Number.isNaN(angkatan) ? null : angkatan;
  }

  private static calculateSemesterFromNimAndTahunAjaran(
    nim?: string,
    tahunAjaran?: string
  ) {
    if (!nim || nim.length < 3 || !tahunAjaran || tahunAjaran.length < 5) {
      return null;
    }

    const angkatan = JadwalService.calculateAngkatanFromNim(nim);
    const tahunMulaiAjaran = Number(tahunAjaran.slice(0, 4));
    const semesterTahunAjaran = Number(tahunAjaran.slice(4));
    if (
      angkatan === null ||
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
      tanggal: jadwal?.tanggal
        ? JadwalHelper.formatDateInJakarta(jadwal.tanggal)
        : null,
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_selesai)
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
      tanggal: jadwal?.tanggal
        ? JadwalHelper.formatDateInJakarta(jadwal.tanggal)
        : null,
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.formatTimeInJakarta(jadwal.waktu_selesai)
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
