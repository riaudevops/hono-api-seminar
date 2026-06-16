import PenilaianRepository from '../penilaian/penilaian.repository';
import { KomponenPenilaianRepository } from '../komponen-penilaian';
import { ConstraintDosenRepository } from '../constraint-dosen';
import { DosenModuleRepository as DosenRepository } from '../dosen';
import { JadwalRepository } from '../jadwal';
import { LogRepository, LogService } from '../log';
import JadwalHelper from '../../helpers/jadwal.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import { APIError } from '../../utils/api-error.util';
import prisma from '../../infrastructures/db.infrastructure';
import {
  PenilaiRole,
  LogActionType,
  LogActorType,
  LogEntityType,
  type ConstraintType,
  type Prisma,
} from '@prisma/client';

// ─── Mapping helpers ───────────────────────────────────────────────

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

const BIMBINGAN_ROLES: PenilaiRole[] = [
  PenilaiRole.KP_PEMBIMBING,
  PenilaiRole.TA_PEMBIMBING_1,
  PenilaiRole.TA_PEMBIMBING_2,
];

const MENGUIJI_ROLES: PenilaiRole[] = [
  PenilaiRole.KP_PENGUJI,
  PenilaiRole.TA_PENGUJI_1,
  PenilaiRole.TA_PENGUJI_2,
  PenilaiRole.TA_KETUA_SIDANG,
];

function computeSemester(nim: string): number {
  const angkatan = parseInt(`20${nim.slice(1, 3)}`);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  return (currentYear - angkatan) * 2 + (currentMonth >= 8 ? 1 : 2);
}

function computeAngkatan(nim: string): number {
  return parseInt(`20${nim.slice(1, 3)}`);
}

function computeStatusJadwal(waktuMulai: Date, waktuSelesai: Date): string {
  const now = JadwalHelper.getCurrentJakartaTime();
  const mulai = JadwalHelper.convertToJakartaTimezone(waktuMulai);
  const selesai = JadwalHelper.convertToJakartaTimezone(waktuSelesai);

  if (now < mulai) return 'AKAN_DATANG';
  if (now >= mulai && now <= selesai) return 'BERLANGSUNG';
  return 'SELESAI';
}

function jenisKodeFromJadwal(j: any): string {
  return j.jenis_seminar?.kode || '';
}

// ─── Service ───────────────────────────────────────────────────────

export default class DosenSeminarService {
  public static async getJadwalSeminar(nip: string) {
    const penilaianList = await PenilaianRepository.findByDosenNip(nip);

    const data = penilaianList.map((p) => {
      const j: any = p.jadwal;
      const m = j.mahasiswa;
      const r = j.ruangan;

      const waktuMulai = JadwalHelper.convertToJakartaTimezone(j.waktu_mulai);
      const waktuSelesai = JadwalHelper.convertToJakartaTimezone(
        j.waktu_selesai
      );

      const kode = jenisKodeFromJadwal(j);

      return {
        id: j.id,
        tanggal: waktuMulai.toISOString().slice(0, 10),
        jam_mulai: waktuMulai.toISOString().slice(11, 16),
        jam_selesai: waktuSelesai.toISOString().slice(11, 16),
        ruangan: {
          kode: r.kode,
          nama: r.nama,
          status: r.status,
        },
        mahasiswa: {
          nim: m.nim,
          nama: m.nama,
          aktif: m.aktif,
          email: m.email,
          nip: '-',
          semester: computeSemester(m.nim),
          angkatan: computeAngkatan(m.nim),
        },
        jenis_seminar: KODE_TO_FRONTEND[kode] || kode,
        status: computeStatusJadwal(j.waktu_mulai, j.waktu_selesai),
        peran_dosen: ROLE_TO_FRONTEND[p.role as PenilaiRole],
      };
    });

    return {
      response: true,
      message: 'Berhasil mengambil data jadwal seminar',
      data,
    };
  }

  public static async getStats(nip: string) {
    const dosen = await DosenRepository.findByNip(nip);
    if (!dosen) {
      throw new APIError('Data dosen tidak ditemukan', 404);
    }

    const penilaianList = await PenilaianRepository.findByDosenNip(nip);

    let total_bimbingan = 0;
    let total_menguji = 0;
    let sudah_dinilai = 0;
    let belum_dinilai = 0;
    let upcomingJadwal: any = null;
    let agenda_hari_ini = 0;

    const now = JadwalHelper.getCurrentJakartaTime();
    const todayStr = now.toISOString().slice(0, 10);

    for (const p of penilaianList) {
      const role = p.role as PenilaiRole;

      if (BIMBINGAN_ROLES.includes(role)) total_bimbingan++;
      if (MENGUIJI_ROLES.includes(role)) total_menguji++;

      const hasNilai = p.detail_penilaian && p.detail_penilaian.length > 0;
      if (hasNilai) sudah_dinilai++;
      else belum_dinilai++;

      const j: any = p.jadwal;
      const waktuMulai = JadwalHelper.convertToJakartaTimezone(j.waktu_mulai);
      const waktuSelesai = JadwalHelper.convertToJakartaTimezone(
        j.waktu_selesai
      );
      const jadwalDateStr = waktuMulai.toISOString().slice(0, 10);

      if (jadwalDateStr === todayStr) {
        agenda_hari_ini++;
      }

      if (waktuMulai > now && !upcomingJadwal) {
        const kode = jenisKodeFromJadwal(j);
        upcomingJadwal = {
          jenis_seminar: KODE_TO_FRONTEND[kode] || kode,
          mahasiswa_nama: j.mahasiswa.nama,
          tanggal: jadwalDateStr,
          jam_mulai: waktuMulai.toISOString().slice(11, 16),
          jam_selesai: waktuSelesai.toISOString().slice(11, 16),
          ruangan: j.ruangan.nama,
        };
      }
    }

    const kodeTahunAjaran = TahunAjaranHelper.findSekarang();
    const semester = TahunAjaranHelper.parseStringNameByCode(kodeTahunAjaran);

    return {
      response: true,
      message: 'Berhasil mengambil statistik',
      data: {
        total_bimbingan,
        total_menguji,
        sudah_dinilai,
        belum_dinilai,
        upcoming_seminar: upcomingJadwal,
        nama_dosen: dosen.nama,
        semester: `Semester ${semester}`,
        agenda_hari_ini,
      },
    };
  }

  public static async getKomponenPenilaian(
    filters: { id_jenis_seminar?: string } = {}
  ) {
    const komponenList = await KomponenPenilaianRepository.findAktif(filters);

    const data = komponenList.map((k: any) => ({
      id: k.id,
      nama_komponen: k.nama,
      bobot_persen: k.persentase,
      peran_penilai: [ROLE_TO_FRONTEND[k.role as PenilaiRole]],
      is_aktif: k.is_aktif,
      deskripsi: '',
      id_jenis_seminar: k.id_jenis_seminar,
      jenis_seminar: k.jenis_seminar
        ? {
            id: k.jenis_seminar.id,
            kode: k.jenis_seminar.kode,
            nama: k.jenis_seminar.nama,
          }
        : null,
    }));

    return {
      response: true,
      message: 'Berhasil mengambil komponen penilaian',
      data,
    };
  }

  public static async getKomponenPenilaianSaya(
    nip: string,
    params: { id_jenis_seminar: string; jadwal_id: string }
  ) {
    const jadwal = await JadwalRepository.findById(params.jadwal_id);
    if (!jadwal) {
      throw new APIError(
        `Jadwal dengan ID ${params.jadwal_id} tidak ditemukan`,
        404
      );
    }

    if (jadwal.id_jenis_seminar !== params.id_jenis_seminar) {
      throw new APIError('ID jenis seminar tidak sesuai dengan jadwal', 400);
    }

    const penilaian = await PenilaianRepository.findByJadwalAndDosen(
      params.jadwal_id,
      nip
    );
    if (!penilaian) {
      throw new APIError(
        'Anda tidak ditugaskan sebagai penilai pada jadwal ini.',
        403
      );
    }

    const komponenList = await KomponenPenilaianRepository.findAktif({
      id_jenis_seminar: params.id_jenis_seminar,
      role: penilaian.role,
    });

    const komponen = komponenList.map((k: any) => ({
      id: k.id,
      nama_komponen: k.nama,
      bobot_persen: k.persentase,
      peran_penilai: [ROLE_TO_FRONTEND[k.role as PenilaiRole]],
      is_aktif: k.is_aktif,
      deskripsi: '',
      id_jenis_seminar: k.id_jenis_seminar,
      jenis_seminar: k.jenis_seminar
        ? {
            id: k.jenis_seminar.id,
            kode: k.jenis_seminar.kode,
            nama: k.jenis_seminar.nama,
          }
        : null,
    }));
    const totalPersentaseAktif = komponenList.reduce(
      (total, item) => total + item.persentase,
      0
    );
    const jenisSeminar = (jadwal as any).jenis_seminar
      ? {
          id: (jadwal as any).jenis_seminar.id,
          kode: (jadwal as any).jenis_seminar.kode,
          nama: (jadwal as any).jenis_seminar.nama,
        }
      : (komponen[0]?.jenis_seminar ?? null);

    return {
      response: true,
      message: 'Berhasil mengambil komponen penilaian saya',
      data: {
        jadwal_id: params.jadwal_id,
        dosen_nip: nip,
        role: penilaian.role,
        peran_dosen: ROLE_TO_FRONTEND[penilaian.role as PenilaiRole],
        id_jenis_seminar: params.id_jenis_seminar,
        jenis_seminar: jenisSeminar,
        total_persentase_aktif: totalPersentaseAktif,
        is_complete: totalPersentaseAktif === 100,
        komponen,
      },
    };
  }

  public static async getPenilaianByJadwal(jadwal_id: string) {
    const penilaianList = await PenilaianRepository.findByJadwalId(jadwal_id);

    const data =
      penilaianList?.flatMap((p) =>
        p.detail_penilaian.map((d) => ({
          jadwal_id: p.id_jadwal,
          komponen_id: d.id_komponen,
          dosen_nama: p.dosen?.nama ?? null,
          dosen_nip: p.dosen?.nip ?? null,
          peran_dosen: ROLE_TO_FRONTEND[p.role as PenilaiRole],
          nilai: d.nilai,
          submitted_at: d.nilai != null ? new Date().toISOString() : null,
        }))
      ) ?? [];

    return {
      response: true,
      message: data.length
        ? 'Berhasil mengambil data penilaian'
        : 'Data penilaian untuk jadwal ini masih kosong',
      data,
    };
  }

  public static async submitNilai(
    nip: string,
    body: {
      jadwal_id: string;
      penilaian: {
        komponen_id: string;
        mahasiswa_nim: string;
        dosen_nip: string;
        nilai: number;
      }[];
    }
  ) {
    const { jadwal_id, penilaian } = body;

    for (const item of penilaian) {
      if (item.dosen_nip !== nip) {
        throw new APIError(
          'Anda hanya dapat menilai dengan NIP Anda sendiri',
          403
        );
      }
    }

    const jadwal = await JadwalRepository.findById(jadwal_id);
    if (!jadwal) {
      throw new APIError(`Jadwal dengan ID ${jadwal_id} tidak ditemukan`, 404);
    }

    const penilaianRecord = await PenilaianRepository.findByJadwalAndDosen(
      jadwal_id,
      nip
    );
    if (!penilaianRecord) {
      throw new APIError(
        'Anda tidak ditugaskan sebagai penilai untuk jadwal ini',
        403
      );
    }

    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar: jadwal.id_jenis_seminar,
        role: penilaianRecord.role,
        is_aktif: true,
      },
    });
    const activeComponentIds = activeComponents.map((c) => c.id);

    for (const item of penilaian) {
      if (!activeComponentIds.includes(item.komponen_id)) {
        throw new APIError(
          `Komponen ${item.komponen_id} tidak valid atau tidak aktif untuk role Anda`,
          400
        );
      }
    }

    const context = {
      actor_id: nip,
      actor_type: LogActorType.DOSEN,
    };

    await prisma.$transaction(async (tx) => {
      for (const item of penilaian) {
        const existingDetail = await tx.detail_penilaian.findUnique({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian: penilaianRecord.id,
              id_komponen: item.komponen_id,
            },
          },
        });

        await tx.detail_penilaian.upsert({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian: penilaianRecord.id,
              id_komponen: item.komponen_id,
            },
          },
          update: { nilai: item.nilai },
          create: {
            id_penilaian: penilaianRecord.id,
            id_komponen: item.komponen_id,
            nilai: item.nilai,
          },
        });

        await LogService.createPenilaianLogTx(tx, {
          action: existingDetail ? LogActionType.UPDATE : LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          id_jadwal: jadwal_id,
          id_komponen_penilaian: item.komponen_id,
          old_nilai: existingDetail ? existingDetail.nilai : null,
          new_nilai: item.nilai,
        });
      }
    });

    let total_nilai_weighted = 0;
    for (const item of penilaian) {
      const komponen = activeComponents.find((c) => c.id === item.komponen_id);
      if (komponen) {
        total_nilai_weighted += item.nilai * (komponen.persentase / 100);
      }
    }

    return {
      response: true,
      message: 'Nilai berhasil disimpan',
      data: {
        jadwal_id,
        dosen_nip: nip,
        submitted_at: new Date().toISOString(),
        total_nilai_weighted: Math.round(total_nilai_weighted * 100) / 100,
      },
    };
  }

  public static async getLogPenilaian(nip: string) {
    const dosen = await DosenRepository.findByNip(nip);
    if (!dosen) {
      throw new APIError('Data dosen tidak ditemukan', 404);
    }

    const logs = await LogRepository.findByFilters({
      actor_id: nip,
      entity_type: LogEntityType.PENILAIAN,
    });

    const enrichedData = await Promise.all(
      logs.map(async (log) => {
        const jadwal = await JadwalRepository.findById(log.entity_id);
        let mahasiswa_nama = '-';
        let jenis_jadwal = '-';

        if (jadwal) {
          mahasiswa_nama = (jadwal as any).mahasiswa?.nama || '-';
          const kode = (jadwal as any).jenis_seminar?.kode || '';
          jenis_jadwal = KODE_TO_FRONTEND[kode] || kode || '-';
        }

        const aksiMap: Record<string, string> = {
          CREATE: 'INPUT_NILAI',
          UPDATE: 'UPDATE_NILAI',
          DELETE: 'SUBMIT_NILAI',
        };

        const oldNilai = (log.old_values as any)?.nilai ?? null;
        const newNilai = (log.new_values as any)?.nilai ?? null;

        return {
          id: log.id,
          timestamp: log.timestamp,
          dosen_nama: dosen.nama,
          mahasiswa_nama,
          jenis_jadwal,
          aksi: aksiMap[log.action] || log.action,
          detail: `Nilai ${oldNilai != null ? `diubah dari ${oldNilai} ke ${newNilai}` : `diinput: ${newNilai}`}`,
        };
      })
    );

    return {
      response: true,
      message: 'Berhasil mengambil log penilaian',
      data: enrichedData,
    };
  }

  public static async getConstraints(nip: string) {
    const constraints = await ConstraintDosenRepository.findByNip(nip);

    const data = constraints.map((c) => ({
      id: c.id,
      nip: c.nip,
      type: c.type,
      hari: c.hari,
      waktu_mulai: c.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(c.waktu_mulai)
            .toISOString()
            .slice(11, 16)
        : null,
      waktu_selesai: c.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(c.waktu_selesai)
            .toISOString()
            .slice(11, 16)
        : null,
      keterangan: c.keterangan,
      priority: c.priority,
      is_active: c.is_active,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    return {
      response: true,
      message: 'Berhasil mengambil constraints',
      data,
    };
  }

  public static async createConstraint(
    nip: string,
    data: {
      type: ConstraintType;
      hari?: number | null;
      waktu_mulai?: string | null;
      waktu_selesai?: string | null;
      keterangan?: string | null;
      priority?: number;
      is_active?: boolean;
    }
  ) {
    const createInput: Prisma.constraint_dosenCreateInput = {
      type: data.type,
      hari: data.hari ?? undefined,
      waktu_mulai: data.waktu_mulai ? new Date(data.waktu_mulai) : undefined,
      waktu_selesai: data.waktu_selesai
        ? new Date(data.waktu_selesai)
        : undefined,
      keterangan: data.keterangan ?? undefined,
      priority: data.priority ?? 1,
      is_active: data.is_active ?? true,
      dosen: { connect: { nip } },
    };

    const constraint = await ConstraintDosenRepository.create(createInput);

    return {
      response: true,
      message: 'Constraint berhasil ditambahkan',
      data: constraint,
    };
  }
}
