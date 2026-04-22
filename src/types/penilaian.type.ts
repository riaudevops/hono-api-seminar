import { PenilaiRole } from '@prisma/client';

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

export interface DetailPenilaianType {
  id: string;
  id_penilaian: string;
  id_komponen: string;
  nilai: number;
}

export interface CreateDetailPenilaianType {
  id_penilaian: string;
  id_komponen: string;
  nilai: number;
}

export interface UpdateDetailPenilaianType {
  nilai: number;
}

export interface KomponenPenilaianType {
  id: string;
  nama: string;
  persentase: number;
  is_aktif: boolean;
  role: PenilaiRole;
}

export interface CreateKomponenPenilaianType {
  nama: string;
  persentase: number;
  is_aktif?: boolean;
  role: PenilaiRole;
}

export interface UpdateKomponenPenilaianType {
  nama?: string;
  persentase?: number;
  is_aktif?: boolean;
  role?: PenilaiRole;
}

export interface PenilaianWithDetail extends PenilaianType {
  dosen?: {
    nip: string;
    nama: string;
    email: string;
    no_hp: string | null;
  };
  detail_penilaian?: Array<{
    id: string;
    id_penilaian: string;
    id_komponen: string;
    nilai: number;
    komponen?: KomponenPenilaianType;
  }>;
}

export interface NilaiAkhirResult {
  totalNilai: number;
  totalPersentase: number;
  nilaiAkhir: number;
}
