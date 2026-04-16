import prisma from '../infrastructures/db.infrastructure';
import { PenilaiRole } from '@prisma/client';

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
  // =====================
  // Penilaian Methods
  // =====================

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
          include: {
            komponen: true,
          },
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
          include: {
            komponen: true,
          },
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
          include: {
            komponen: true,
          },
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
          },
        },
        detail_penilaian: {
          include: {
            komponen: true,
          },
        },
      },
    });
  }

  public static async findByJadwalAndDosen(id_jadwal: string, nip: string) {
    return prisma.penilaian.findUnique({
      where: {
        id_jadwal_nip: {
          id_jadwal,
          nip,
        },
      },
      include: {
        dosen: true,
        detail_penilaian: {
          include: {
            komponen: true,
          },
        },
      },
    });
  }

  public static async findByJadwalAndRole(
    id_jadwal: string,
    role: PenilaiRole
  ) {
    return prisma.penilaian.findMany({
      where: {
        id_jadwal,
        role,
      },
      include: {
        dosen: true,
        detail_penilaian: {
          include: {
            komponen: true,
          },
        },
      },
    });
  }

  public static async create(data: CreatePenilaianInput) {
    return prisma.penilaian.create({
      data: {
        id_jadwal: data.id_jadwal,
        nip: data.nip,
        role: data.role,
      },
      include: {
        dosen: true,
        detail_penilaian: true,
      },
    });
  }

  public static async createMany(data: CreatePenilaianInput[]) {
    return prisma.penilaian.createMany({
      data: data.map((item) => ({
        id_jadwal: item.id_jadwal,
        nip: item.nip,
        role: item.role,
      })),
    });
  }

  public static async destroy(id: string) {
    return prisma.penilaian.delete({
      where: { id },
    });
  }

  public static async destroyByJadwalId(id_jadwal: string) {
    return prisma.penilaian.deleteMany({
      where: { id_jadwal },
    });
  }

  // =====================
  // Detail Penilaian Methods
  // =====================

  public static async createDetailPenilaian(data: CreateDetailPenilaianInput) {
    return prisma.detail_penilaian.create({
      data: {
        id_penilaian: data.id_penilaian,
        id_komponen: data.id_komponen,
        nilai: data.nilai,
      },
      include: {
        komponen: true,
      },
    });
  }

  public static async createManyDetailPenilaian(
    data: CreateDetailPenilaianInput[]
  ) {
    return prisma.detail_penilaian.createMany({
      data: data.map((item) => ({
        id_penilaian: item.id_penilaian,
        id_komponen: item.id_komponen,
        nilai: item.nilai,
      })),
    });
  }

  public static async findDetailById(id: string) {
    return prisma.detail_penilaian.findUnique({
      where: { id },
      include: {
        penilaian: {
          include: {
            jadwal: true,
            dosen: true,
          },
        },
        komponen: true,
      },
    });
  }

  public static async findDetailByPenilaianId(id_penilaian: string) {
    return prisma.detail_penilaian.findMany({
      where: { id_penilaian },
      include: {
        komponen: true,
      },
    });
  }

  public static async findDetailByPenilaianAndKomponen(
    id_penilaian: string,
    id_komponen: string
  ) {
    return prisma.detail_penilaian.findUnique({
      where: {
        id_penilaian_id_komponen: {
          id_penilaian,
          id_komponen,
        },
      },
      include: {
        komponen: true,
      },
    });
  }

  public static async updateDetailPenilaian(
    id: string,
    data: UpdateDetailPenilaianInput
  ) {
    return prisma.detail_penilaian.update({
      where: { id },
      data: {
        nilai: data.nilai,
      },
      include: {
        komponen: true,
      },
    });
  }

  public static async upsertDetailPenilaian(
    id_penilaian: string,
    id_komponen: string,
    nilai: number
  ) {
    return prisma.detail_penilaian.upsert({
      where: {
        id_penilaian_id_komponen: {
          id_penilaian,
          id_komponen,
        },
      },
      update: {
        nilai,
      },
      create: {
        id_penilaian,
        id_komponen,
        nilai,
      },
      include: {
        komponen: true,
      },
    });
  }

  public static async destroyDetail(id: string) {
    return prisma.detail_penilaian.delete({
      where: { id },
    });
  }

  public static async destroyDetailByPenilaianId(id_penilaian: string) {
    return prisma.detail_penilaian.deleteMany({
      where: { id_penilaian },
    });
  }

  // =====================
  // Calculation Methods
  // =====================

  public static async calculateNilaiAkhirByJadwal(id_jadwal: string) {
    const penilaianList = await prisma.penilaian.findMany({
      where: { id_jadwal },
      include: {
        detail_penilaian: {
          include: {
            komponen: true,
          },
        },
      },
    });

    let totalNilai = 0;
    let totalPersentase = 0;

    for (const penilaian of penilaianList) {
      for (const detail of penilaian.detail_penilaian) {
        totalNilai += detail.nilai * (detail.komponen.persentase / 100);
        totalPersentase += detail.komponen.persentase;
      }
    }

    return {
      totalNilai,
      totalPersentase,
      nilaiAkhir:
        totalPersentase > 0 ? (totalNilai / totalPersentase) * 100 : 0,
    };
  }

  public static async getRekapNilaiByMahasiswa(nim: string) {
    return prisma.jadwal.findMany({
      where: { nim },
      include: {
        mahasiswa: true,
        ruangan: true,
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
      },
      orderBy: {
        tanggal: 'desc',
      },
    });
  }
}
