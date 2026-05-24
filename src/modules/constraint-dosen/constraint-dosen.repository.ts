import prisma from '../../infrastructures/db.infrastructure';
import { Prisma } from '@prisma/client';
import { UpdateConstraintDosenInput } from './constraint-dosen.type';

export default class ConstraintDosenRepository {
  public static async findByNip(nip: string) {
    return prisma.constraint_dosen.findMany({
      where: { nip },
      orderBy: { created_at: 'desc' },
    });
  }

  public static async findByNips(nips: string[]) {
    if (nips.length === 0) return [];

    return prisma.constraint_dosen.findMany({
      where: { nip: { in: nips }, is_active: true },
      select: {
        nip: true,
        type: true,
        hari: true,
        waktu_mulai: true,
        waktu_selesai: true,
        keterangan: true,
        priority: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  public static async findById(id: string) {
    return prisma.constraint_dosen.findUnique({
      where: { id },
    });
  }

  public static async create(data: Prisma.constraint_dosenCreateInput) {
    return prisma.constraint_dosen.create({
      data,
    });
  }

  public static async update(id: string, data: UpdateConstraintDosenInput) {
    return prisma.constraint_dosen.update({
      where: { id },
      data,
    });
  }

  public static async destroy(id: string) {
    return prisma.constraint_dosen.delete({
      where: { id },
    });
  }
}
