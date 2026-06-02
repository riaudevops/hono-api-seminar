import prisma from '../../infrastructures/db.infrastructure';

export interface CreateRuanganInput {
  kode: string;
  nama: string;
  status?: boolean;
  urutan?: number;
}

export interface UpdateRuanganInput {
  nama?: string;
  status?: boolean;
  urutan?: number;
}

export default class RuanganRepository {
  public static async findAll() {
    return prisma.ruangan.findMany({
      orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
    });
  }

  public static async findByKode(kode: string) {
    return prisma.ruangan.findUnique({
      where: { kode },
    });
  }

  public static async findAktif() {
    return prisma.ruangan.findMany({
      where: { status: true },
      orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
    });
  }

  public static async create(data: CreateRuanganInput) {
    return prisma.ruangan.create({
      data: {
        kode: data.kode,
        nama: data.nama,
        status: data.status ?? true,
        urutan: data.urutan ?? 0,
      },
    });
  }

  public static async update(kode: string, data: UpdateRuanganInput) {
    return prisma.ruangan.update({
      where: { kode },
      data,
    });
  }

  public static async destroy(kode: string) {
    return prisma.ruangan.delete({
      where: { kode },
    });
  }

  public static async checkTimeConflict(
    kode_ruangan: string,
    waktu_mulai: Date,
    waktu_selesai: Date,
    excludeJadwalId?: string
  ) {
    return prisma.jadwal.findFirst({
      where: {
        kode_ruangan,
        ...(excludeJadwalId && { id: { not: excludeJadwalId } }),
        AND: [
          {
            waktu_mulai: { lt: waktu_selesai },
            waktu_selesai: { gt: waktu_mulai },
          },
        ],
      },
      include: {
        mahasiswa: true,
      },
    });
  }

  public static async getRuanganWithJadwal(kode: string) {
    return prisma.ruangan.findUnique({
      where: { kode },
      include: {
        jadwal: {
          include: {
            mahasiswa: true,
            penilaian: {
              include: {
                dosen: true,
              },
            },
          },
          orderBy: {
            tanggal: 'desc',
          },
        },
      },
    });
  }
}
