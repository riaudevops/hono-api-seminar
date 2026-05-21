import { LogActorType, PenilaiRole } from '@prisma/client';

export type DetailPenilaianStatus = 'BELUM_DINILAI' | 'SEBAGIAN' | 'LENGKAP';

export interface DetailPenilaianItemInput {
  id_komponen: string;
  nilai: number;
  catatan?: string | null;
}

export interface UpsertDetailPenilaianInput {
  details: DetailPenilaianItemInput[];
}

export interface DetailPenilaianActorContext {
  actor_type: LogActorType;
  actor_id: string;
  role?: string;
  nip?: string;
}

export interface DetailPenilaianSummary {
  id_penilaian: string;
  id_jadwal: string;
  dosen_nip: string;
  role: PenilaiRole;
  status: DetailPenilaianStatus;
  total_nilai_weighted: number;
  details: unknown[];
}
