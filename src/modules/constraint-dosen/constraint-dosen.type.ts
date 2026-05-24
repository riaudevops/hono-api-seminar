import { ConstraintType, Prisma } from '@prisma/client';

export interface CreateConstraintType {
  type: ConstraintType;
  hari?: number;
  waktu_mulai?: string;
  waktu_selesai?: string;
  keterangan?: string;
  priority?: number;
  raw_data?: Record<string, unknown>;
}

export interface UpdateConstraintType {
  type?: ConstraintType;
  hari?: number | null;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  keterangan?: string | null;
  priority?: number;
  is_active?: boolean;
  raw_data?: Record<string, unknown> | null;
}

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

export type UpdateConstraintDosenInput =
  Prisma.constraint_dosenUncheckedUpdateInput;
