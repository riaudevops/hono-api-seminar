export interface DosenType {
  nip: string;
  nama: string;
  email: string;
  no_hp: string | null;
}

export interface CreateDosenType {
  nip: string;
  nama: string;
  email: string;
  no_hp?: string;
}

export interface UpdateDosenType {
  nama?: string;
  email?: string;
  no_hp?: string;
}

export interface DosenWithPenilaian extends DosenType {
  penilaian?: Array<{
    id: string;
    id_jadwal: string;
    role: string;
    jadwal?: {
      id: string;
      tanggal: Date;
      jenis: string;
    };
  }>;
}
