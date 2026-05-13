import prisma from '../infrastructures/db.infrastructure';

export default class TahunAjaranRepository {
  /**
   * Get distinct years from jadwal tanggal
   */
  public static async findAllYears() {
    const years = await prisma.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM tanggal) as year
      FROM jadwal
      ORDER BY year DESC
    `;

    return years.map((item) => item.year);
  }

  /**
   * Get jadwal count by year
   */
  public static async countByYear(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    return prisma.jadwal.count({
      where: {
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  /**
   * Get jadwal statistics by year
   */
  public static async getStatisticsByYear(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const stats = await prisma.jadwal.groupBy({
      by: ['id_jenis_seminar'],
      where: {
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return stats.map((item: any) => ({
      id_jenis_seminar: item.id_jenis_seminar,
      count: item._count.id,
    }));
  }
}
