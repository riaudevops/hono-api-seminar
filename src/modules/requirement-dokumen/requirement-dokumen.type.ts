import type { PaginatedResponse } from '../../types/global.type';

export interface RequirementDokumenType {
  id: string;
  id_jenis_seminar: string;
  id_dokumen_template: string;
  urutan: number;
  is_wajib: boolean;
  keterangan_tambahan: string | null;
}

export interface RequirementDokumenWithRelations extends RequirementDokumenType {
  jenis_seminar: {
    id: string;
    nama: string;
    kode: string;
  };
  dokumen_template: {
    id: string;
    nama: string;
    kode: string;
  };
}

export type GetAllRequirementDokumenResponse =
  PaginatedResponse<RequirementDokumenWithRelations>;

export interface CreateRequirementDokumenType {
  id_jenis_seminar: string;
  id_dokumen_template: string;
  urutan?: number;
  is_wajib?: boolean;
  keterangan_tambahan?: string | null;
}

export interface UpdateRequirementDokumenType {
  id_jenis_seminar?: string;
  id_dokumen_template?: string;
  urutan?: number;
  is_wajib?: boolean;
  keterangan_tambahan?: string | null;
}
