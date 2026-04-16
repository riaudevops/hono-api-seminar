import prisma from '../infrastructures/db.infrastructure';
import { PenilaiRole } from '@prisma/client';

export interface CreateKomponenPenilaianInput {
  id: string;
  nama: string;
  persentase: number;
  is_aktif?: boolean;
  role: PenilaiRole;
}

export interface UpdateKomponenPenilaianInput {
  nama?: string;
  persentase?: number;
  is_aktif?: boolean;
  role?: PenilaiRole;
}

export default class KomponenPenilaianRepository {
  public static async findAll() {
    return prisma.komponen_penilaian.findMany({
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });
  }

  public static async findById(id: string) {
    return prisma.komponen_penilaian.findUnique({
      where: { id },
    });
  }

  public static async findByRole(role: PenilaiRole) {
    return prisma.komponen_penilaian.findMany({
      where: { role },
      orderBy: { id: 'asc' },
    });
  }

  public static async findAktifByRole(role: PenilaiRole) {
    return prisma.komponen_penilaian.findMany({
      where: {
        role,
        is_aktif: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  public static async findAktif() {
    return prisma.komponen_penilaian.findMany({
      where: { is_aktif: true },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
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

  public static async getTotalPersentaseByRole(role: PenilaiRole) {
    const result = await prisma.komponen_penilaian.aggregate({
      where: {
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
