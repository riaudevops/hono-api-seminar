import type { TipeInputDokumen } from '@prisma/client';
import type { PaginatedResponse } from '../../modules/global/global.type';

export interface DokumenTemplateType {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string | null;
  tipe_input: TipeInputDokumen;
  opsi: string[] | null;
  format_file: string | null;
  max_size_mb: number | null;
  is_special: boolean;
  can_view_dosen: boolean;
}

export interface DokumenTemplateJenisSeminar {
  id: string;
  nama: string;
  kode: string;
}

export interface DokumenTemplateWithJenisSeminar extends DokumenTemplateType {
  jenis_seminars: DokumenTemplateJenisSeminar[];
}

export type GetAllDokumenTemplateResponse =
  PaginatedResponse<DokumenTemplateWithJenisSeminar>;

export interface CreateDokumenTemplateType {
  nama: string;
  kode: string;
  deskripsi?: string;
  tipe_input: TipeInputDokumen;
  opsi?: string[];
  format_file?: string;
  max_size_mb?: number;
  is_special?: boolean;
  can_view_dosen?: boolean;
}

export interface UpdateDokumenTemplateType {
  nama?: string;
  kode?: string;
  deskripsi?: string | null;
  tipe_input?: TipeInputDokumen;
  opsi?: string[] | null;
  format_file?: string | null;
  max_size_mb?: number | null;
  is_special?: boolean;
  can_view_dosen?: boolean;
}
