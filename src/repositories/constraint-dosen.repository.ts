import prisma from "../infrastructures/db.infrastructure";
import { ConstraintType, Prisma } from "@prisma/client";

export interface CreateConstraintDosenInput {
  nip: string;
  type: ConstraintType;
  hari?: number;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  keterangan?: string;
  priority?: number;
  raw_data?: Prisma.InputJsonValue;
}

export type UpdateConstraintDosenInput = Prisma.constraint_dosenUncheckedUpdateInput;

export default class ConstraintDosenRepository {
  public static async findByNip(nip: string) {
    return prisma.constraint_dosen.findMany({
      where: { nip, is_active: true },
      orderBy: { created_at: "desc" },
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
