import { TipeInputDokumen } from '@prisma/client';

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
}

export interface CreateDokumenTemplateType {
  nama: string;
  kode: string;
  deskripsi?: string;
  tipe_input: TipeInputDokumen;
  opsi?: string[];
  format_file?: string;
  max_size_mb?: number;
  is_special?: boolean;
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
}
