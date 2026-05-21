export interface MahasiswaType {
  nim: string;
  nama: string;
  email: string;
  aktif: boolean;
  no_hp: string | null;
}

export interface GetAllMahasiswaQuery {
  page: number;
  limit: number;
  search?: string;
  nim?: string;
  nama?: string;
  email?: string;
  no_hp?: string;
  aktif?: boolean;
  angkatan?: number;
  sortBy: 'nim' | 'nama' | 'email' | 'aktif';
  sortOrder: 'asc' | 'desc';
}

export interface UpdateDataSayaType {
  no_hp: string | null;
}
