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

  public static async findByNIMWithDosenNames(nim: string) {
    return prisma.$queryRaw`
      SELECT
        p.*,
        pb1.nama as nama_pembimbing_1,
        pb2.nama as nama_pembimbing_2,
        pg1.nama as nama_penguji_1,
        pg2.nama as nama_penguji_2
      FROM pendaftaran p
      LEFT JOIN dosen pb1 ON p.nip_pembimbing_1 = pb1.nip
      LEFT JOIN dosen pb2 ON p.nip_pembimbing_2 = pb2.nip
      LEFT JOIN dosen pg1 ON p.nip_penguji_1 = pg1.nip
      LEFT JOIN dosen pg2 ON p.nip_penguji_2 = pg2.nip
      WHERE p.nim = ${nim}
      ORDER BY p.created_at DESC
    `;
  }
}
