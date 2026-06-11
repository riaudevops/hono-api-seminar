import type { StatusBerkas, StatusJadwal } from '@prisma/client';
import type { PaginatedResponse } from '../../modules/global/global.type';

export interface PendaftaranType {
  id: string;
  nim: string;
  kode_tahun_ajaran: string;
  id_pengajuan_fst: string;
  id_jenis_seminar: string;
  nip_pembimbing_1: string;
  nama_pembimbing_1?: string | null;
  nip_pembimbing_2: string | null;
  nama_pembimbing_2?: string | null;
  nip_penguji_1: string | null;
  nama_penguji_1?: string | null;
  nip_penguji_2: string | null;
  nama_penguji_2?: string | null;
  status_berkas: StatusBerkas;
  status_jadwal: StatusJadwal;
  created_at: Date;
  updated_at: Date;
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

export type GetAllPendaftaranResponse = PaginatedResponse<
  Omit<PendaftaranWithDataDokumen, 'data_pendaftaran'> & {
    kode_tahun_ajaran_nama: string;
  }
>;

export type DokumenNilaiPayload = Record<
  string,
  string | boolean | string[] | null
>;

export interface CreatePendaftaranByMahasiswaType {
  id_pengajuan_fst: string;
  id_jenis_seminar: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  dokumen?: DokumenNilaiPayload;
}

// Mahasiswa update — field yang boleh direvisi mahasiswa
export interface UpdatePendaftaranByMahasiswaType {
  id_pengajuan_fst?: string;
  id_jenis_seminar?: string;
  nip_pembimbing_1?: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  dokumen?: DokumenNilaiPayload;
}

export interface DokumenRevisiItem {
  nama_dokumen: string;
  catatan: string;
}

export interface UpdateStatusBerkasType {
  status_berkas: StatusBerkas;
  dokumen_revisi?: DokumenRevisiItem[];
  catatan_umum?: string;
}

// Koordinator update — ganti dosen (skenario dosen berhalangan hadir)
export interface UpdateDosenByKoordinatorType {
  nip_pembimbing_1?: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  alasan_penggantian: string;
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

export interface PendaftaranDashboardData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  revision: number;
  processingRate: number;
  avgProcessingTime: string;
}

export interface PendaftaranDashboardResponse {
  response: boolean;
  message: string;
  data: PendaftaranDashboardData;
}
