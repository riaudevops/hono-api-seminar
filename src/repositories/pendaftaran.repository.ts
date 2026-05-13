import prisma from '../infrastructures/db.infrastructure';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';

export interface CreatePendaftaranInput {
  id: string;
  nim: string;
  tahun_ajaran: string;
  id_pengajuan_fst: string;
  id_jenis_seminar: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  nip_ketua_sidang?: string | null;
  status_berkas?: string;
  created_at?: Date;
}

export default class PendaftaranRepository {
  public static async findAll() {
    return prisma.pendaftaran.findMany({
      include: { jenis_seminar: true },
      orderBy: { created_at: 'desc' },
    });
  }

  public static async findById(id: string) {
    return prisma.pendaftaran.findUnique({
      where: { id },
      include: { jenis_seminar: true },
    });
  }

  public static async create(data: CreatePendaftaranInput) {
    return prisma.pendaftaran.create({ data: data as any });
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
    return prisma.$queryRaw<any[]>`
      SELECT
        p.*,
        js.kode  as jenis_seminar_kode,
        js.nama  as jenis_seminar_nama,
        pb1.nama as nama_pembimbing_1,
        pb2.nama as nama_pembimbing_2,
        pg1.nama as nama_penguji_1,
        pg2.nama as nama_penguji_2
      FROM pendaftaran p
      LEFT JOIN jenis_seminar js  ON p.id_jenis_seminar = js.id
      LEFT JOIN dosen pb1 ON p.nip_pembimbing_1 = pb1.nip
      LEFT JOIN dosen pb2 ON p.nip_pembimbing_2 = pb2.nip
      LEFT JOIN dosen pg1 ON p.nip_penguji_1    = pg1.nip
      LEFT JOIN dosen pg2 ON p.nip_penguji_2    = pg2.nip
      WHERE p.nim = ${nim}
      ORDER BY p.created_at DESC
    `;
  }
}
