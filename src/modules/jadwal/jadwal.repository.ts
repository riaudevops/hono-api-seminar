import type { Prisma, StatusKelulusan } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';

type PrismaClientOrTx = any;

const listInclude = {
  mahasiswa: true,
  ruangan: true,
  jenis_seminar: true,
  penilaian: {
    include: {
      dosen: true,
    },
  },
} as const;

const detailInclude = {
  mahasiswa: true,
  ruangan: true,
  jenis_seminar: true,
  penilaian: {
    include: {
      dosen: true,
      detail_penilaian: {
        include: {
          komponen: true,
        },
      },
    },
  },
} as const;

export interface JadwalFilter {
  id_jenis_seminar?: string;
  tanggal_mulai?: Date;
  tanggal_selesai?: Date;
  kode_ruangan?: string;
  nim?: string;
  nip_dosen?: string;
  kode_tahun_ajaran?: string;
  status_kelulusan?: StatusKelulusan;
}

export interface CreateJadwalInput {
  id: string;
  tanggal: Date;
  waktu_mulai: Date;
  waktu_selesai: Date;
  id_jenis_seminar: string;
  nim: string;
  kode_ruangan: string;
  kode_tahun_ajaran: string;
}

export interface UpdateJadwalInput {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  id_jenis_seminar?: string;
  nim?: string;
  kode_ruangan?: string;
}

export interface UpdateStatusKelulusanJadwalInput {
  status_kelulusan: StatusKelulusan;
}

function buildWhere(filters: JadwalFilter): Prisma.jadwalWhereInput {
  return {
    ...(filters.id_jenis_seminar && {
      id_jenis_seminar: filters.id_jenis_seminar,
    }),
    ...(filters.kode_ruangan && { kode_ruangan: filters.kode_ruangan }),
    ...(filters.nim && { nim: filters.nim }),
    ...(filters.kode_tahun_ajaran && {
      kode_tahun_ajaran: filters.kode_tahun_ajaran,
    }),
    ...(filters.status_kelulusan && {
      status_kelulusan: filters.status_kelulusan,
    }),
    ...(filters.nip_dosen && {
      penilaian: {
        some: { nip: filters.nip_dosen },
      },
    }),
    ...((filters.tanggal_mulai || filters.tanggal_selesai) && {
      tanggal: {
        ...(filters.tanggal_mulai && { gte: filters.tanggal_mulai }),
        ...(filters.tanggal_selesai && { lte: filters.tanggal_selesai }),
      },
    }),
  };
}

export default class JadwalRepository {
  public static async findAll(
    filters: JadwalFilter = {},
    limit = 20,
    offset = 0
  ) {
    return await prisma.jadwal.findMany({
      where: buildWhere(filters),
      include: listInclude,
      orderBy: [{ tanggal: 'desc' }, { waktu_mulai: 'asc' }],
      take: limit,
      skip: offset,
    });
  }

  public static async count(filters: JadwalFilter = {}) {
    return await prisma.jadwal.count({ where: buildWhere(filters) });
  }

  public static async findById(id: string, client: PrismaClientOrTx = prisma) {
    return await client.jadwal.findUnique({
      where: { id },
      include: detailInclude,
    });
  }

  public static async findByMahasiswaEmail(email: string) {
    return await prisma.jadwal.findMany({
      where: { mahasiswa: { email } },
      include: listInclude,
      orderBy: [{ tanggal: 'asc' }, { waktu_mulai: 'asc' }],
    });
  }

  public static async findByDosenEmail(email: string) {
    return await prisma.jadwal.findMany({
      where: {
        penilaian: {
          some: { dosen: { email } },
        },
      },
      include: listInclude,
      orderBy: [{ tanggal: 'asc' }, { waktu_mulai: 'asc' }],
    });
  }

  public static async existsByMahasiswaAndJenis(
    nim: string,
    id_jenis_seminar: string,
    kode_tahun_ajaran: string,
    excludeId?: string,
    client: PrismaClientOrTx = prisma
  ) {
    return await client.jadwal.findFirst({
      where: {
        nim,
        id_jenis_seminar,
        kode_tahun_ajaran,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
  }

  public static async existsByMahasiswaAndTime(
    nim: string,
    waktu_mulai: Date,
    waktu_selesai: Date,
    excludeId?: string,
    client: PrismaClientOrTx = prisma
  ) {
    return await client.jadwal.findFirst({
      where: {
        nim,
        ...(excludeId && { id: { not: excludeId } }),
        waktu_mulai: { lt: waktu_selesai },
        waktu_selesai: { gt: waktu_mulai },
      },
      select: { id: true },
    });
  }

  public static async create(
    data: CreateJadwalInput,
    client: PrismaClientOrTx = prisma
  ) {
    return await client.jadwal.create({
      data,
      include: listInclude,
    });
  }

  public static async update(
    id: string,
    data: UpdateJadwalInput,
    client: PrismaClientOrTx = prisma
  ) {
    return await client.jadwal.update({
      where: { id },
      data,
      include: listInclude,
    });
  }

  public static async updateStatusKelulusan(
    id: string,
    data: UpdateStatusKelulusanJadwalInput,
    client: PrismaClientOrTx = prisma
  ) {
    return await client.jadwal.update({
      where: { id },
      data,
      include: detailInclude,
    });
  }

  public static async findLastIdByPrefix(
    prefix: string,
    client: PrismaClientOrTx = prisma
  ): Promise<string | null> {
    const lastJadwal = await client.jadwal.findFirst({
      where: { id: { startsWith: prefix } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return lastJadwal ? lastJadwal.id : null;
  }

  public static async destroy(id: string, client: PrismaClientOrTx = prisma) {
    return await client.jadwal.delete({
      where: { id },
    });
  }

  public static async findByTanggal(tanggal: Date) {
    const startOfDay = new Date(tanggal);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tanggal);
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.jadwal.findMany({
      where: {
        tanggal: { gte: startOfDay, lte: endOfDay },
      },
      include: listInclude,
    });
  }

  public static async findByDateRange(startDate: Date, endDate: Date) {
    return prisma.jadwal.findMany({
      where: {
        tanggal: { gte: startDate, lte: endDate },
      },
      include: listInclude,
      orderBy: { tanggal: 'asc' },
    });
  }

  public static async findBlockingSchedulesForGeneration(
    startDate: Date,
    endDate: Date
  ) {
    return prisma.jadwal.findMany({
      where: {
        tanggal: { gte: startDate, lte: endDate },
      },
      select: {
        tanggal: true,
        waktu_mulai: true,
        waktu_selesai: true,
        kode_ruangan: true,
        penilaian: {
          select: {
            nip: true,
          },
        },
      },
      orderBy: { tanggal: 'asc' },
    });
  }

  public static async checkTimeConflict(
    kode_ruangan: string,
    waktu_mulai: Date,
    waktu_selesai: Date,
    excludeId?: string
  ) {
    return await prisma.jadwal.findFirst({
      where: {
        kode_ruangan,
        ...(excludeId && { id: { not: excludeId } }),
        waktu_mulai: { lt: waktu_selesai },
        waktu_selesai: { gt: waktu_mulai },
      },
    });
  }
}
