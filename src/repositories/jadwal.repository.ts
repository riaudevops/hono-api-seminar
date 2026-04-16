import prisma from '../infrastructures/db.infrastructure';
import { JenisJadwal } from '@prisma/client';

export interface CreateJadwalInput {
  id: string;
  tanggal: Date;
  waktu_mulai: Date;
  waktu_selesai: Date;
  jenis: JenisJadwal;
  nim: string;
  kode_ruangan: string;
  kode_tahun_ajaran: string;
}

export interface UpdateJadwalInput {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  jenis?: JenisJadwal;
  nim?: string;
  kode_ruangan?: string;
}

export default class JadwalRepository {
  public static async findAll(jenis?: JenisJadwal) {
    return await prisma.jadwal.findMany({
      where: jenis ? { jenis } : undefined,
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

  public static async findById(id: string) {
    return await prisma.jadwal.findUnique({
      where: { id },
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
    });
  }

  public static async findByMahasiswaEmail(email: string) {
    return await prisma.jadwal.findMany({
      where: {
        mahasiswa: { email },
      },
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
    });
  }

  public static async findByDosenEmail(email: string) {
    return await prisma.jadwal.findMany({
      where: {
        penilaian: {
          some: {
            dosen: { email },
          },
        },
      },
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
    });
  }

  public static async existsByMahasiswaAndJenis(
    nim: string,
    jenis: JenisJadwal,
    excludeId?: string
  ) {
    return await prisma.jadwal.findFirst({
      where: {
        nim,
        jenis,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
  }

  public static async create(data: CreateJadwalInput) {
    return await prisma.jadwal.create({
      data: {
        id: data.id,
        tanggal: data.tanggal,
        waktu_mulai: data.waktu_mulai,
        waktu_selesai: data.waktu_selesai,
        jenis: data.jenis,
        nim: data.nim,
        kode_ruangan: data.kode_ruangan,
        kode_tahun_ajaran: data.kode_tahun_ajaran,
      },
      include: {
        mahasiswa: true,
        ruangan: true,
      },
    });
  }

  public static async update(id: string, data: UpdateJadwalInput) {
    return await prisma.jadwal.update({
      where: { id },
      data,
      include: {
        mahasiswa: true,
        ruangan: true,
        penilaian: true,
      },
    });
  }

  public static async findLastIdByJenis(
    jenis: JenisJadwal,
    prefix: string
  ): Promise<string | null> {
    const lastJadwal = await prisma.jadwal.findFirst({
      where: {
        jenis,
        id: {
          startsWith: prefix,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        id: true,
      },
    });
    return lastJadwal ? lastJadwal.id : null;
  }

  public static async destroy(id: string) {
    return await prisma.jadwal.delete({
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
        tanggal: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        mahasiswa: true,
        ruangan: true,
        penilaian: {
          include: {
            dosen: true,
          },
        },
      },
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
        AND: [
          {
            waktu_mulai: { lt: waktu_selesai },
            waktu_selesai: { gt: waktu_mulai },
          },
        ],
      },
    });
  }
}
