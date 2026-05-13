import { PenilaiRole } from '@prisma/client';

// Jenis seminar sekarang dinamis — referensinya adalah `jenis_seminar.kode`.
// Tipe union dipertahankan untuk kode yang sudah ter-deploy (enum-like value).
export type JenisJadwalKode =
  | 'SEMKP'
  | 'SEMPRO'
  | 'SEMHAS_LAPORAN'
  | 'SEMHAS_PAPERBASED'
  | 'SIDANG_LAPORAN'
  | 'SIDANG_PAPERBASED';

export const JENIS_JADWAL_KODE: Record<JenisJadwalKode, JenisJadwalKode> = {
  SEMKP: 'SEMKP',
  SEMPRO: 'SEMPRO',
  SEMHAS_LAPORAN: 'SEMHAS_LAPORAN',
  SEMHAS_PAPERBASED: 'SEMHAS_PAPERBASED',
  SIDANG_LAPORAN: 'SIDANG_LAPORAN',
  SIDANG_PAPERBASED: 'SIDANG_PAPERBASED',
};

export interface CreateJadwalType {
  id: string;
  tanggal: Date;
  judul: string;
  waktu_mulai: Date;
  waktu_selesai: Date;
  id_jenis_seminar: string;
  nim: string;
  kode_ruangan: string;
}

export interface UpdateJadwalType {
  tanggal?: Date;
  judul?: string;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  id_jenis_seminar?: string;
  nim?: string;
  kode_ruangan?: string;
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

export interface JadwalWithRelations {
  id: string;
  tanggal: Date;
  judul: string;
  waktu_mulai: Date;
  waktu_selesai: Date;
  id_jenis_seminar: string;
  jenis_seminar?: {
    id: string;
    kode: string;
    nama: string;
  };
  nim: string;
  kode_ruangan: string;
  mahasiswa?: {
    nim: string;
    nama: string;
    email: string;
    aktif: boolean;
  };
  ruangan?: {
    kode: string;
    nama: string;
    status: boolean;
  };
  penilaian?: Array<{
    id: string;
    id_jadwal: string;
    nip: string;
    role: PenilaiRole;
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
      komponen?: {
        id: string;
        nama: string;
        persentase: number;
        is_aktif: boolean;
        role: PenilaiRole;
      };
    }>;
  }>;
}
