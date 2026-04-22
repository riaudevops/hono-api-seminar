export interface KeahlianDosenType {
  id: string;
  nip: string;
  id_bidang_keahlian: string;
}

export interface CreateKeahlianDosenType {
  nip: string;
  id_bidang_keahlian: string;
}

export interface UpdateKeahlianDosenType {
  nip?: string;
  id_bidang_keahlian?: string;
}

export interface KeahlianDosenFilterType {
  nip?: string;
  id_bidang_keahlian?: string;
  bidang?: string;
}

export interface KeahlianDosenWithRelation extends KeahlianDosenType {
  dosen?: {
    nip: string;
    nama: string;
    email: string;
    no_hp: string | null;
  };
  bidang_keahlian?: {
    id: string;
    nama: string;
  };
}
