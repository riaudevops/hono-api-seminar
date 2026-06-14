import type {
  LogActorType,
  PenilaiRole,
  StatusKelulusan,
} from '@prisma/client';

export type JenisJadwalKode = string;

export interface CreateJadwalType {
  id: string;
  tanggal: Date;
  waktu_mulai: Date;
  waktu_selesai: Date;
  id_jenis_seminar: string;
  nim: string;
  kode_ruangan: string;
}

export interface UpdateJadwalType {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  id_jenis_seminar?: string;
  nim?: string;
  kode_ruangan?: string;
  status_kelulusan?: StatusKelulusan;
}

export interface UpdateStatusKelulusanJadwalType {
  status_kelulusan: StatusKelulusan;
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
  waktu_mulai: Date;
  waktu_selesai: Date;
  status_kelulusan: StatusKelulusan;
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

export interface LogJadwalContext {
  actor_id: string;
  actor_type: LogActorType;
}

export interface DosenAssignment {
  nip: string;
  role: PenilaiRole;
}
