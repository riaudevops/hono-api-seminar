export interface JenisSeminarType {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  is_aktif: boolean;
  jumlah_pembimbing: number;
  jumlah_penguji: number;
  ada_ketua_sidang: boolean;
}

export interface CreateJenisSeminarType {
  kode: string;
  nama: string;
  deskripsi?: string;
  is_aktif?: boolean;
  jumlah_pembimbing?: number;
  jumlah_penguji?: number;
  ada_ketua_sidang?: boolean;
}

export interface UpdateJenisSeminarType {
  kode?: string;
  nama?: string;
  deskripsi?: string | null;
  is_aktif?: boolean;
  jumlah_pembimbing?: number;
  jumlah_penguji?: number;
  ada_ketua_sidang?: boolean;
}
