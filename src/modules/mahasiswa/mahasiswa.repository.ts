import { Prisma } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import { GetAllMahasiswaQuery, UpdateDataSayaType } from './mahasiswa.type';

export default class MahasiswaRepository {
  private static buildWhere(
    query: GetAllMahasiswaQuery
  ): Prisma.mahasiswaWhereInput {
    const angkatanDigits = query.angkatan?.toString().slice(-2);

    return {
      ...(query.search
        ? {
            OR: [
              { nim: { contains: query.search, mode: 'insensitive' } },
              { nama: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { no_hp: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.nim
        ? { nim: { contains: query.nim, mode: 'insensitive' } }
        : {}),
      ...(query.nama
        ? { nama: { contains: query.nama, mode: 'insensitive' } }
        : {}),
      ...(query.email
        ? { email: { contains: query.email, mode: 'insensitive' } }
        : {}),
      ...(query.no_hp
        ? { no_hp: { contains: query.no_hp, mode: 'insensitive' } }
        : {}),
      ...(query.aktif !== undefined ? { aktif: query.aktif } : {}),
      ...(angkatanDigits ? { nim: { startsWith: `1${angkatanDigits}` } } : {}),
    };
  }

  public static async findAll(query: GetAllMahasiswaQuery) {
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.limit;

    const [mahasiswa, total] = await prisma.$transaction([
      prisma.mahasiswa.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.mahasiswa.count({ where }),
    ]);

    return { mahasiswa, total };
  }

  public static async getStatistics() {
    const [total, aktif, nonaktif, perStatus] = (await prisma.$transaction([
      prisma.mahasiswa.count(),
      prisma.mahasiswa.count({ where: { aktif: true } }),
      prisma.mahasiswa.count({ where: { aktif: false } }),
      prisma.mahasiswa.groupBy({
        by: ['aktif'],
        _count: { _all: true },
      }),
    ])) as [
      number,
      number,
      number,
      { aktif: boolean; _count: { _all: number } }[],
    ];

    const perAngkatan = await prisma.$queryRaw<
      { angkatan: number; total: bigint }[]
    >`
      SELECT CAST('20' || SUBSTRING(nim, 2, 2) AS INTEGER) AS angkatan,
             COUNT(*) AS total
      FROM mahasiswa
      WHERE LENGTH(nim) >= 3
      GROUP BY angkatan
      ORDER BY angkatan DESC
    `;

    return {
      total,
      aktif,
      nonaktif,
      per_status: perStatus.map((item) => ({
        aktif: item.aktif,
        total: item._count._all,
      })),
      per_angkatan: perAngkatan.map((item) => ({
        angkatan: item.angkatan,
        total: Number(item.total),
      })),
    };
  }

  public static async findByEmail(email: string) {
    return prisma.mahasiswa.findUnique({
      where: { email },
    });
  }

  public static async findByNoHp(no_hp: string) {
    return prisma.mahasiswa.findUnique({
      where: { no_hp },
    });
  }

  public static async updateByNim(nim: string, data: UpdateDataSayaType) {
    return prisma.mahasiswa.update({
      where: { nim },
      data: {
        no_hp: data.no_hp,
      },
    });
  }
}
