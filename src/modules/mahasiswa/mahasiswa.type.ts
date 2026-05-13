export interface MahasiswaType {
  nim: string;
  nama: string;
  email: string;
  aktif: boolean;
  no_hp: string | null;
}

export interface UpdateDataSayaType {
  no_hp: string | null;
}
