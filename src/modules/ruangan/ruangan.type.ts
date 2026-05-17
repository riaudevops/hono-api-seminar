export interface RuanganType {
  kode: string;
  nama: string;
  status: boolean;
}

export interface CreateRuanganType {
  kode: string;
  nama: string;
  status?: boolean;
}

export interface UpdateRuanganType {
  nama?: string;
  status?: boolean;
}

export interface RuanganWithJadwal extends RuanganType {
  jadwal?: Array<{
    id: string;
    tanggal: Date;
    waktu_mulai: Date;
    waktu_selesai: Date;
    jenis: string;
    nim: string;
  }>;
}
