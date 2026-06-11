import prisma from '../../infrastructures/db.infrastructure';
import type { PenilaiRole } from '@prisma/client';

export interface CreatePenilaianInput {
  id_jadwal: string;
  nip: string;
  role: PenilaiRole;
}

export interface CreateDetailPenilaianInput {
  id_penilaian: string;
  id_komponen: string;
  nilai: number;
}

export interface UpdateDetailPenilaianInput {
  nilai: number;
}

export default class PenilaianRepository {
  public static async findAll() {
    return prisma.penilaian.findMany({
      include: {
        jadwal: {
          include: {
            mahasiswa: true,
            ruangan: true,
          },
        },
        dosen: true,
        detail_penilaian: {
          include: { komponen: true },
        },
      },
    });
  }

  public static async findById(id: string) {
    return prisma.penilaian.findUnique({
      where: { id },
      include: {
        jadwal: {
          include: {
            mahasiswa: true,
            ruangan: true,
          },
        },
        dosen: true,
        detail_penilaian: {
          include: { komponen: true },
        },
      },
    });
  }

  public static async findByJadwalId(id_jadwal: string) {
    return prisma.penilaian.findMany({
      where: { id_jadwal },
      include: {
        dosen: true,
        detail_penilaian: {
          include: { komponen: true },
        },
      },
    });
  }

  public static async findByDosenNip(nip: string) {
    return prisma.penilaian.findMany({
      where: { nip },
      include: {
        jadwal: {
          include: {
            mahasiswa: true,
            ruangan: true,
            jenis_seminar: true,
          },
        },
        detail_penilaian: {
          include: { komponen: true },
        },
      },
    });
  }

  public static async findByJadwalAndDosen(id_jadwal: string, nip: string) {
    return prisma.penilaian.findFirst({
      where: { id_jadwal, nip },
    });
  }

  public static async create(data: CreatePenilaianInput) {
    return prisma.penilaian.create({ data });
  }

  public static async createMany(data: CreatePenilaianInput[]) {
    return prisma.penilaian.createMany({ data, skipDuplicates: true });
  }

  public static async deleteByJadwalId(id_jadwal: string) {
    return prisma.penilaian.deleteMany({ where: { id_jadwal } });
  }

  public static async upsertDetail(data: CreateDetailPenilaianInput) {
    return prisma.detail_penilaian.upsert({
      where: {
        id_penilaian_id_komponen: {
          id_penilaian: data.id_penilaian,
          id_komponen: data.id_komponen,
        },
      },
      update: { nilai: data.nilai },
      create: data,
    });
  }

  public static async findDetailByPenilaianId(id_penilaian: string) {
    return prisma.detail_penilaian.findMany({
      where: { id_penilaian },
      include: { komponen: true },
    });
  }

  public static async getAverageNilaiByJadwal(id_jadwal: string) {
    const result = await prisma.detail_penilaian.findMany({
      where: { penilaian: { id_jadwal } },
      include: { komponen: true },
    });

    if (!result.length) return 0;

    let totalMs = 0;
    for (const d of result) {
      totalMs += d.nilai * (d.komponen.persentase / 100);
    }
    return totalMs / result.length;
  }
}
