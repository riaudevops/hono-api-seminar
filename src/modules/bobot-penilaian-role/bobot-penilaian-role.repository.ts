import type { PenilaiRole } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';

export interface UpsertBobotRow {
  id_jenis_seminar: string;
  role: PenilaiRole;
  persentase: number;
}

export default class BobotPenilaianRoleRepository {
  public static async findByJenisSeminar(id_jenis_seminar: string) {
    return prisma.bobot_penilaian_role.findMany({
      where: { id_jenis_seminar },
      orderBy: { role: 'asc' },
    });
  }

  public static async findById(id: string) {
    return prisma.bobot_penilaian_role.findUnique({
      where: { id },
    });
  }

  public static async findByPair(id_jenis_seminar: string, role: PenilaiRole) {
    return prisma.bobot_penilaian_role.findUnique({
      where: {
        id_jenis_seminar_role: {
          id_jenis_seminar,
          role,
        },
      },
    });
  }

  public static async findAll() {
    return prisma.bobot_penilaian_role.findMany({
      orderBy: [{ id_jenis_seminar: 'asc' }, { role: 'asc' }],
      include: {
        jenis_seminar: { select: { id: true, kode: true, nama: true } },
      },
    });
  }

  public static async updatePersentase(id: string, persentase: number) {
    return prisma.bobot_penilaian_role.update({
      where: { id },
      data: { persentase },
    });
  }

  public static async destroy(id: string) {
    return prisma.bobot_penilaian_role.delete({ where: { id } });
  }
}
