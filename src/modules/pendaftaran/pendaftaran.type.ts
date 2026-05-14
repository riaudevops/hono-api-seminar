import { StatusBerkas } from '@prisma/client';
import type { PaginatedResponse } from '../../types/global.type';

export interface PendaftaranType {
  id: string;
  nim: string;
  tahun_ajaran: string;
  id_pengajuan_fst: string;
  id_jenis_seminar: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2: string | null;
  nip_penguji_1: string | null;
  nip_penguji_2: string | null;
  nip_ketua_sidang: string | null;
  status_berkas: StatusBerkas;
  created_at: Date;
}

export interface PendaftaranJenisSeminar {
  id: string;
  nama: string;
  kode: string;
}

export interface PendaftaranMahasiswa {
  nim: string;
  nama: string | null;
  email: string | null;
}

export interface PendaftaranWithRelations extends PendaftaranType {
  jenis_seminar: PendaftaranJenisSeminar | null;
  mahasiswa: PendaftaranMahasiswa | null;
}

export type GetAllPendaftaranResponse = PaginatedResponse<PendaftaranWithDataDokumen>;

// Mahasiswa create — NIM ditentukan dari JWT, bukan dari body
export interface CreatePendaftaranByMahasiswaType {
  id_pengajuan_fst: string;
  id_jenis_seminar: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  nip_ketua_sidang?: string | null;
}

// Mahasiswa update — field yang boleh direvisi mahasiswa
export interface UpdatePendaftaranByMahasiswaType {
  id_pengajuan_fst?: string;
  id_jenis_seminar?: string;
  nip_pembimbing_1?: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  nip_ketua_sidang?: string | null;
}

export interface UpdateStatusBerkasType {
  status_berkas: StatusBerkas;
}

export interface DataPendaftaranType {
  id: string;
  id_pendaftaran: string;
  id_dokumen_template: string;
  nilai_text: string | null;
  nilai_file_url: string | null;
  nilai_boolean: boolean | null;
  nilai_date: Date | null;
  nilai_json: unknown | null;
}

export interface DataPendaftaranWithTemplate extends DataPendaftaranType {
  dokumen_template: {
    id: string;
    nama: string;
    kode: string;
    tipe_input: string;
    format_file: string | null;
    max_size_mb: number | null;
    is_special: boolean;
  };
}

export interface PendaftaranWithDataDokumen extends PendaftaranType {
  jenis_seminar: PendaftaranJenisSeminar | null;
  mahasiswa: PendaftaranMahasiswa | null;
  data_pendaftaran: DataPendaftaranWithTemplate[];
}
