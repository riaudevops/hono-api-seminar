import prisma from '../infrastructures/db.infrastructure';

export interface CreateDosenInput {
  nip: string;
  nama: string;
  email: string;
  no_hp?: string;
}

export interface UpdateDosenInput {
  nama?: string;
  email?: string;
  no_hp?: string;
}

export default class DosenRepository {
  public static async findAll() {
    return prisma.dosen.findMany({
      orderBy: {
        nama: 'asc',
      },
    });
  }

  public static async findByNip(nip: string) {
    return prisma.dosen.findUnique({
      where: { nip },
    });
  }

  public static async findByEmail(email: string) {
    return prisma.dosen.findUnique({
      where: { email },
    });
  }

  public static async create(data: CreateDosenInput) {
    return prisma.dosen.create({
      data,
    });
  }

  public static async update(nip: string, data: UpdateDosenInput) {
    return prisma.dosen.update({
      where: { nip },
      data,
    });
  }

  public static async destroy(nip: string) {
    return prisma.dosen.delete({
      where: { nip },
    });
  }

  public static async findByNips(nips: string[]) {
    return prisma.dosen.findMany({
      where: {
        nip: { in: nips },
      },
    });
  }

  public static async checkDosenTimeConflict(
    nips: string[],
    waktu_mulai: Date,
    waktu_selesai: Date,
    excludeJadwalId?: string
  ) {
    return prisma.jadwal.findFirst({
      where: {
        ...(excludeJadwalId && { id: { not: excludeJadwalId } }),
        penilaian: {
          some: {
            nip: { in: nips },
          },
        },
        AND: [
          {
            waktu_mulai: { lt: waktu_selesai },
            waktu_selesai: { gt: waktu_mulai },
          },
        ],
      },
      include: {
        penilaian: {
          include: {
            dosen: true,
          },
        },
      },
    });
  }

  public static async getDosenWithPenilaian(nip: string) {
    return prisma.dosen.findUnique({
      where: { nip },
      include: {
        penilaian: {
          include: {
            jadwal: {
              include: {
                mahasiswa: true,
              },
            },
            detail_penilaian: {
              include: {
                komponen: true,
              },
            },
          },
        },
      },
    });
  }
}
