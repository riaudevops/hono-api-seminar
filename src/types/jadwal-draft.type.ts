import { JenisJadwal, PenilaiRole, StatusJadwalDraft } from '@prisma/client';

export interface DosenAssignmentInput {
  nip: string;
  role: PenilaiRole;
}

export interface MahasiswaScheduleInput {
  nim: string;
  jenis: JenisJadwal;
  judul: string;
  list_dosen: DosenAssignmentInput[];
}

export interface GenerateJadwalInput {
  tanggal_mulai: string;
  list_mahasiswa: MahasiswaScheduleInput[];
}

export interface UpdateDraftInput {
  tanggal?: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  kode_ruangan?: string;
}

export interface CreateJadwalDraftInput {
  batch_id: string;
  nim: string;
  jenis: JenisJadwal;
  judul: string;
  tanggal: Date;
  waktu_mulai: Date;
  waktu_selesai: Date;
  kode_ruangan: string;
  list_dosen: { nip: string; role: PenilaiRole }[];
  llm_reasoning?: Record<string, unknown>;
  confidence?: number;
}

export interface UpdateJadwalDraftInput {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  kode_ruangan?: string;
}
