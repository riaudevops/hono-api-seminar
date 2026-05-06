import prisma from '../infrastructures/db.infrastructure';

export interface CreatePendaftaranInput {
  id: string;
  nim: string;
  nama: string;
  semester: number;
  id_pengajuan_fst: string;
  no_wa: string;
  jenis_seminar: string;
  judul?: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2?: string;
  nip_penguji_1: string;
  nip_penguji_2: string;
  mata_kuliah_pilihan?: any;
  berkas_syarat_url: string;
  undangan_sebelumnya_url?: string;
  created_at?: Date;
  status_berkas?: string;
  status_proses?: boolean;
}

export default class PendaftaranRepository {
  public static async findAll() {
    return prisma.pendaftaran.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  public static async findById(id: string) {
    return prisma.pendaftaran.findUnique({ where: { id } });
  }

  public static async create(data: CreatePendaftaranInput) {
    return prisma.pendaftaran.create({ data });
  }

  public static async update(id: string, data: any) {
    return prisma.pendaftaran.update({ where: { id }, data });
  }

  public static async findByIdPengajuanFst(id_pengajuan_fst: string) {
    return prisma.pendaftaran.findUnique({
      where: { id_pengajuan_fst },
    });
  }
}
