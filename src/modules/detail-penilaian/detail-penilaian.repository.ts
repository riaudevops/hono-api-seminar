import type { PenilaiRole, Prisma } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import type { DetailPenilaianItemInput } from './detail-penilaian.type';

type PrismaClientOrTx = any;

const penilaianDetailInclude = {
  jadwal: {
    include: {
      mahasiswa: true,
      ruangan: true,
      jenis_seminar: true,
    },
  },
  dosen: true,
  detail_penilaian: {
    include: {
      komponen: true,
    },
    orderBy: { id_komponen: 'asc' },
  },
} as const;

const penilaianRekapInclude = {
  jadwal: {
    select: {
      id_jenis_seminar: true,
    },
  },
  dosen: true,
  detail_penilaian: {
    include: {
      komponen: true,
    },
  },
} as const;

export type PenilaianDetailRecord = Prisma.penilaianGetPayload<{
  include: typeof penilaianDetailInclude;
}>;

export type PenilaianRekapRecord = Prisma.penilaianGetPayload<{
  include: typeof penilaianRekapInclude;
}>;

export default class DetailPenilaianRepository {
  public static async findPenilaianById(
    id: string
  ): Promise<PenilaianDetailRecord | null> {
    return prisma.penilaian.findUnique({
      where: { id },
      include: penilaianDetailInclude,
    });
  }

  public static async findPenilaianByJadwalId(
    id_jadwal: string
  ): Promise<PenilaianRekapRecord[]> {
    return prisma.penilaian.findMany({
      where: { id_jadwal },
      include: penilaianRekapInclude,
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    }) as unknown as Promise<PenilaianRekapRecord[]>;
  }

  public static async findPenilaianByDosenNip(nip: string) {
    return prisma.penilaian.findMany({
      where: { nip },
      include: penilaianDetailInclude,
      orderBy: [{ id_jadwal: 'asc' }, { role: 'asc' }, { id: 'asc' }],
    }) as unknown as Promise<PenilaianDetailRecord[]>;
  }

  public static async findActiveComponentsByJenisAndRole(
    id_jenis_seminar: string,
    role: PenilaiRole
  ) {
    return prisma.komponen_penilaian.findMany({
      where: { id_jenis_seminar, role, is_aktif: true },
      orderBy: { id: 'asc' },
    });
  }

  public static async findExistingDetails(
    id_penilaian: string,
    componentIds: string[]
  ) {
    return prisma.detail_penilaian.findMany({
      where: {
        id_penilaian,
        id_komponen: { in: componentIds },
      },
    });
  }

  public static async upsertDetailsTx(
    tx: PrismaClientOrTx,
    id_penilaian: string,
    details: DetailPenilaianItemInput[]
  ) {
    const savedDetails = [];

    for (const detail of details) {
      const savedDetail = await tx.detail_penilaian.upsert({
        where: {
          id_penilaian_id_komponen: {
            id_penilaian,
            id_komponen: detail.id_komponen,
          },
        },
        update: {
          nilai: detail.nilai,
          catatan: detail.catatan,
        },
        create: {
          id_penilaian,
          id_komponen: detail.id_komponen,
          nilai: detail.nilai,
          catatan: detail.catatan,
        },
        include: {
          komponen: true,
        },
      });

      savedDetails.push(savedDetail);
    }

    return savedDetails;
  }

  public static async findDetailsByPenilaianIdTx(
    tx: PrismaClientOrTx,
    id_penilaian: string
  ) {
    return tx.detail_penilaian.findMany({
      where: { id_penilaian },
      include: { komponen: true },
      orderBy: { id_komponen: 'asc' },
    });
  }
}
