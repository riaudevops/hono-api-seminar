import { JenisJadwal, PenilaiRole } from '@prisma/client';

export interface CreateJadwalType {
  id: string;
  tanggal: Date;
  judul: string;
  waktu_mulai: Date;
  waktu_selesai: Date;
  jenis: JenisJadwal;
  nim: string;
  kode_ruangan: string;
}

export interface UpdateJadwalType {
  tanggal?: Date;
  judul?: string;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  jenis?: JenisJadwal;
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
  jenis: JenisJadwal;
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
