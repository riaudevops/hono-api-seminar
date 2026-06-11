import type { PenilaiRole } from '@prisma/client';

export interface PenilaianType {
  id: string;
  id_jadwal: string;
  nip: string;
  role: PenilaiRole;
}

export interface CreatePenilaianType {
  id_jadwal: string;
  nip: string;
  role: PenilaiRole;
}

export interface CreateDetailPenilaianType {
  id_penilaian: string;
  id_komponen: string;
  nilai: number;
}
