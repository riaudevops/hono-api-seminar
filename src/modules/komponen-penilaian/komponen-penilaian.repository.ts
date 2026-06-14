import prisma from '../../infrastructures/db.infrastructure';
import type { PenilaiRole } from '@prisma/client';

export interface CreateKomponenPenilaianInput {
  id: string;
  nama: string;
  persentase: number;
  is_aktif?: boolean;
  role: PenilaiRole;
  id_jenis_seminar: string;
}

export interface UpdateKomponenPenilaianInput {
  nama?: string;
  persentase?: number;
  is_aktif?: boolean;
  role?: PenilaiRole;
  id_jenis_seminar?: string;
}

export default class KomponenPenilaianRepository {
  public static async findAll(
    filters: {
      role?: PenilaiRole;
      id_jenis_seminar?: string;
      is_aktif?: boolean;
    } = {}
  ) {
    return prisma.komponen_penilaian.findMany({
      where: {
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.id_jenis_seminar
          ? { id_jenis_seminar: filters.id_jenis_seminar }
          : {}),
        ...(filters.is_aktif !== undefined
          ? { is_aktif: filters.is_aktif }
          : {}),
      },
      include: {
        jenis_seminar: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: [{ id_jenis_seminar: 'asc' }, { role: 'asc' }, { id: 'asc' }],
    });
  }

  public static async findById(id: string) {
    return prisma.komponen_penilaian.findUnique({
      where: { id },
    });
  }

  public static async findByJenisAndRole(
    id_jenis_seminar: string,
    role: PenilaiRole
  ) {
    return prisma.komponen_penilaian.findMany({
      where: { id_jenis_seminar, role },
      include: {
        jenis_seminar: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  public static async findAktifByJenisAndRole(
    id_jenis_seminar: string,
    role: PenilaiRole
  ) {
    return prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar,
        role,
        is_aktif: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  public static async findAktif(
    filters: { id_jenis_seminar?: string; role?: PenilaiRole } = {}
  ) {
    return prisma.komponen_penilaian.findMany({
      where: {
        is_aktif: true,
        ...(filters.id_jenis_seminar
          ? { id_jenis_seminar: filters.id_jenis_seminar }
          : {}),
        ...(filters.role ? { role: filters.role } : {}),
      },
      include: {
        jenis_seminar: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: [{ id_jenis_seminar: 'asc' }, { role: 'asc' }, { id: 'asc' }],
    });
  }

  public static async create(data: CreateKomponenPenilaianInput) {
    return prisma.komponen_penilaian.create({
      data: {
        id: data.id,
        nama: data.nama,
        persentase: data.persentase,
        is_aktif: data.is_aktif ?? true,
        role: data.role,
        id_jenis_seminar: data.id_jenis_seminar,
      },
    });
  }

  public static async createMany(data: CreateKomponenPenilaianInput[]) {
    return prisma.komponen_penilaian.createMany({
      data: data.map((item) => ({
        id: item.id,
        nama: item.nama,
        persentase: item.persentase,
        is_aktif: item.is_aktif ?? true,
        role: item.role,
        id_jenis_seminar: item.id_jenis_seminar,
      })),
    });
  }

  public static async update(id: string, data: UpdateKomponenPenilaianInput) {
    return prisma.komponen_penilaian.update({
      where: { id },
      data,
    });
  }

  public static async destroy(id: string) {
    return prisma.komponen_penilaian.delete({
      where: { id },
    });
  }

  public static async getTotalPersentaseByJenisAndRole(
    id_jenis_seminar: string,
    role: PenilaiRole
  ) {
    const result = await prisma.komponen_penilaian.aggregate({
      where: {
        id_jenis_seminar,
        role,
        is_aktif: true,
      },
      _sum: {
        persentase: true,
      },
    });
    return result._sum.persentase ?? 0;
  }

  public static async getKomponenWithDetailPenilaian(id: string) {
    return prisma.komponen_penilaian.findUnique({
      where: { id },
      include: {
        detail_penilaian: {
          include: {
            penilaian: {
              include: {
                jadwal: true,
                dosen: true,
              },
            },
          },
        },
      },
    });
  }
}
