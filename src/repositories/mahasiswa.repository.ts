import prisma from '../infrastructures/db.infrastructure';

export interface CreateMahasiswaInput {
  nim: string;
  nama: string;
  email: string;
  aktif?: boolean;
}

export interface UpdateMahasiswaInput {
  nama?: string;
  email?: string;
  aktif?: boolean;
}

export default class MahasiswaRepository {
  public static async findAll(
    skip?: number,
    take?: number,
    sortBy?: 'asc' | 'desc'
  ) {
    return prisma.mahasiswa.findMany({
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
      orderBy: sortBy ? { nama: sortBy } : { nama: 'asc' },
    });
  }

  public static async countAll() {
    return prisma.mahasiswa.count();
  }

  public static async findByNIM(nim: string) {
    return prisma.mahasiswa.findUnique({
      where: { nim },
    });
  }

  public static async findByEmail(email: string) {
    return prisma.mahasiswa.findUnique({
      where: { email },
    });
  }

  public static async create(data: CreateMahasiswaInput) {
    return prisma.mahasiswa.create({
      data,
    });
  }

  public static async update(nim: string, data: UpdateMahasiswaInput) {
    return prisma.mahasiswa.update({
      where: { nim },
      data,
    });
  }

  public static async destroy(nim: string) {
    return prisma.mahasiswa.delete({
      where: { nim },
    });
  }

  public static async search(query?: string, sortBy?: 'asc' | 'desc') {
    if (query) {
      return prisma.mahasiswa.findMany({
        where: {
          OR: [
            { nim: { contains: query, mode: 'insensitive' } },
            { nama: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: sortBy ? { nama: sortBy } : { nama: 'asc' },
      });
    }

    return prisma.mahasiswa.findMany({
      orderBy: sortBy ? { nama: sortBy } : { nama: 'asc' },
    });
  }

  public static async findByAngkatan(
    angkatan: number,
    sortBy?: 'asc' | 'desc'
  ) {
    const angkatanDigits = angkatan.toString().slice(-2);

    const orderClause = sortBy
      ? `ORDER BY nama ${sortBy.toUpperCase()}`
      : 'ORDER BY nama ASC';

    const sqlQuery = `
      SELECT * FROM mahasiswa
      WHERE SUBSTRING(nim, 2, 2) = $1
      ${orderClause}
    `;

    return prisma.$queryRawUnsafe(sqlQuery, angkatanDigits);
  }

  public static async findDistinctAngkatan() {
    const angkatanList = await prisma.$queryRaw<{ angkatan: number }[]>`
      SELECT DISTINCT
        CAST('20' || SUBSTRING(nim, 2, 2) AS INTEGER) AS angkatan
      FROM mahasiswa
      WHERE LENGTH(nim) >= 3
      ORDER BY angkatan DESC
    `;
    return angkatanList.map((item) => item.angkatan);
  }

  public static async findAktif() {
    return prisma.mahasiswa.findMany({
      where: { aktif: true },
      orderBy: { nama: 'asc' },
    });
  }

  public static async getMahasiswaWithJadwal(nim: string) {
    return prisma.mahasiswa.findUnique({
      where: { nim },
      include: {
        jadwal: {
          include: {
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
        },
      },
    });
  }

  public static async findPendaftaranByNIM(nim: string) {
    return prisma.pendaftaran.findMany({
      where: { nim },
      orderBy: { created_at: 'desc' },
    });
  }
}
