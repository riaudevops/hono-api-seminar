import prisma from '../infrastructures/db.infrastructure';

export interface CreateKeahlianDosenInput {
  nip: string;
  id_bidang_keahlian: string;
}

export interface UpdateKeahlianDosenInput {
  nip?: string;
  id_bidang_keahlian?: string;
}

export interface FindKeahlianDosenFilter {
  nip?: string;
  id_bidang_keahlian?: string;
  bidang?: string;
}

export default class KeahlianDosenRepository {
  public static async findAll() {
    return prisma.keahlian_dosen.findMany({
      include: {
        dosen: true,
        bidang_keahlian: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  public static async findById(id: string) {
    return prisma.keahlian_dosen.findUnique({
      where: { id },
      include: {
        dosen: true,
        bidang_keahlian: true,
      },
    });
  }

  public static async findByFilters(filters: FindKeahlianDosenFilter) {
    const { nip, id_bidang_keahlian, bidang } = filters;

    return prisma.keahlian_dosen.findMany({
      where: {
        ...(nip ? { nip } : {}),
        ...(id_bidang_keahlian ? { id_bidang_keahlian } : {}),
        ...(bidang
          ? {
              bidang_keahlian: {
                nama: {
                  contains: bidang,
                  mode: 'insensitive',
                },
              },
            }
          : {}),
      },
      include: {
        dosen: true,
        bidang_keahlian: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  public static async findByPair(nip: string, id_bidang_keahlian: string) {
    return prisma.keahlian_dosen.findUnique({
      where: {
        nip_id_bidang_keahlian: {
          nip,
          id_bidang_keahlian,
        },
      },
    });
  }

  public static async existsByBidangKeahlianId(id_bidang_keahlian: string) {
    const row = await prisma.keahlian_dosen.findFirst({
      where: { id_bidang_keahlian },
      select: { id: true },
    });

    return Boolean(row);
  }

  public static async create(data: CreateKeahlianDosenInput) {
    return prisma.keahlian_dosen.create({
      data,
      include: {
        dosen: true,
        bidang_keahlian: true,
      },
    });
  }

  public static async update(id: string, data: UpdateKeahlianDosenInput) {
    return prisma.keahlian_dosen.update({
      where: { id },
      data,
      include: {
        dosen: true,
        bidang_keahlian: true,
      },
    });
  }

  public static async destroy(id: string) {
    return prisma.keahlian_dosen.delete({
      where: { id },
    });
  }
}
