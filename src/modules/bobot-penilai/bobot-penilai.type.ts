import type { PenilaiRole } from '@prisma/client';

export interface BobotPenilaiType {
  id: string;
  id_jenis_seminar: string;
  role: PenilaiRole;
  persentase: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertBobotItem {
  role: PenilaiRole;
  persentase: number;
}

export interface UpsertBobotPenilaiInput {
  id_jenis_seminar: string;
  bobot: UpsertBobotItem[];
}

export interface UpdateSingleBobotInput {
  persentase: number;
}

export interface GetBobotByJenisSeminarParams {
  id_jenis_seminar: string;
}
