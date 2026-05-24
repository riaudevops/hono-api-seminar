export interface TahunAjaranItem {
  kode: string;
  nama: string;
}

export interface TahunAjaranListResponse {
  response: boolean;
  message: string;
  data: TahunAjaranItem[];
}
