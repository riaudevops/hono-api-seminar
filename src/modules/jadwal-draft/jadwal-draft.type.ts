import { PenilaiRole, StatusJadwalDraft } from '@prisma/client';
import type { JenisJadwalKode } from '../../types/jadwal.type';

export interface DosenAssignmentInput {
  nip: string;
  role: PenilaiRole;
}

export interface MahasiswaScheduleInput {
  nim: string;
  kode_jenis: JenisJadwalKode;
  list_dosen: DosenAssignmentInput[];
}

export interface GenerateJadwalInput {
  tanggal_mulai: string;
  list_mahasiswa: MahasiswaScheduleInput[];
  tanggal_dikecualikan?: string[];
  catatan_tambahan?: string;
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
  id_jenis_seminar: string;
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
