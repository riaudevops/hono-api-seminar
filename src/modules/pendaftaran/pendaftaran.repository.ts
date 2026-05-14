import prisma from '../../infrastructures/db.infrastructure';
import {
  CreatePendaftaranByMahasiswaType,
  DataPendaftaranWithTemplate,
  PendaftaranType,
  PendaftaranWithDataDokumen,
  PendaftaranWithRelations,
  UpdatePendaftaranByMahasiswaType,
  UpdateStatusBerkasType,
} from './pendaftaran.type';

interface CreatePendaftaranInput extends CreatePendaftaranByMahasiswaType {
  id: string;
  nim: string;
  tahun_ajaran: string;
}

export default class PendaftaranRepository {
  public static async findAllWithRelations(): Promise<
    PendaftaranWithDataDokumen[]
  > {
    const [pendaftaranList, jenisSeminars, mahasiswas] = await Promise.all([
      prisma.pendaftaran.findMany({
        orderBy: { created_at: 'desc' },
      }),
      prisma.jenis_seminar.findMany({
        select: { id: true, nama: true, kode: true },
      }),
      prisma.mahasiswa.findMany({
        select: { nim: true, nama: true, email: true },
      }),
    ]);

    const jenisSeminarById = new Map(
      jenisSeminars.map((jenisSeminar) => [jenisSeminar.id, jenisSeminar])
    );
    const mahasiswaByNim = new Map(
      mahasiswas.map((mahasiswa) => [mahasiswa.nim, mahasiswa])
    );

    const dataPendaftaran = await this.findDataPendaftaranByIds(
      pendaftaranList.map((p) => p.id)
    );

    return pendaftaranList.map((p) => {
      const mahasiswa = mahasiswaByNim.get(p.nim);
      return this.mapWithRelations(
        p,
        jenisSeminarById.get(p.id_jenis_seminar) ?? null,
        mahasiswa
          ? {
              nim: mahasiswa.nim,
              nama: mahasiswa.nama,
              email: mahasiswa.email,
            }
          : null,
        dataPendaftaran.get(p.id) ?? []
      );
    });
  }

  public static async findAllByNimWithRelations(
    nim: string
  ): Promise<PendaftaranWithDataDokumen[]> {
    const all = await this.findAllWithRelations();
    return all.filter((p) => p.nim === nim);
  }

  public static async findById(id: string) {
    return prisma.pendaftaran.findUnique({
      where: { id },
    });
  }

  public static async findByIdWithRelations(
    id: string
  ): Promise<PendaftaranWithDataDokumen | null> {
    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id },
    });
    if (!pendaftaran) return null;

    const [jenisSeminar, mahasiswa, dataPendaftaran] = await Promise.all([
      prisma.jenis_seminar.findUnique({
        where: { id: pendaftaran.id_jenis_seminar },
        select: { id: true, nama: true, kode: true },
      }),
      prisma.mahasiswa.findUnique({
        where: { nim: pendaftaran.nim },
        select: { nim: true, nama: true, email: true },
      }),
      this.findDataPendaftaranByIds([id]),
    ]);

    return this.mapWithRelations(
      pendaftaran,
      jenisSeminar ?? null,
      mahasiswa
        ? {
            nim: mahasiswa.nim,
            nama: mahasiswa.nama,
            email: mahasiswa.email,
          }
        : null,
      dataPendaftaran.get(id) ?? []
    );
  }

  public static async findByIdPengajuanFst(id_pengajuan_fst: string) {
    return prisma.pendaftaran.findUnique({
      where: { id_pengajuan_fst },
    });
  }

  public static async findMahasiswaByEmail(email: string) {
    return prisma.mahasiswa.findUnique({ where: { email } });
  }

  public static async createWithDataDokumen(data: CreatePendaftaranInput) {
    return prisma.$transaction(async (tx) => {
      const pendaftaran = await tx.pendaftaran.create({
        data: {
          id: data.id,
          nim: data.nim,
          tahun_ajaran: data.tahun_ajaran,
          id_pengajuan_fst: data.id_pengajuan_fst,
          id_jenis_seminar: data.id_jenis_seminar,
          nip_pembimbing_1: data.nip_pembimbing_1,
          nip_pembimbing_2: data.nip_pembimbing_2 ?? null,
          nip_penguji_1: data.nip_penguji_1 ?? null,
          nip_penguji_2: data.nip_penguji_2 ?? null,
          nip_ketua_sidang: data.nip_ketua_sidang ?? null,
          status_berkas: 'PENDING',
        },
      });

      const requirements = await tx.requirement_dokumen.findMany({
        where: { id_jenis_seminar: data.id_jenis_seminar },
        select: { id_dokumen_template: true },
      });

      if (requirements.length > 0) {
        await tx.data_pendaftaran.createMany({
          data: requirements.map((requirement) => ({
            id_pendaftaran: pendaftaran.id,
            id_dokumen_template: requirement.id_dokumen_template,
          })),
        });
      }

      return pendaftaran;
    });
  }

  public static async update(
    id: string,
    data: UpdatePendaftaranByMahasiswaType
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.id_pengajuan_fst !== undefined)
      updateData.id_pengajuan_fst = data.id_pengajuan_fst;
    if (data.id_jenis_seminar !== undefined)
      updateData.id_jenis_seminar = data.id_jenis_seminar;
    if (data.nip_pembimbing_1 !== undefined)
      updateData.nip_pembimbing_1 = data.nip_pembimbing_1;
    if (data.nip_pembimbing_2 !== undefined)
      updateData.nip_pembimbing_2 = data.nip_pembimbing_2;
    if (data.nip_penguji_1 !== undefined)
      updateData.nip_penguji_1 = data.nip_penguji_1;
    if (data.nip_penguji_2 !== undefined)
      updateData.nip_penguji_2 = data.nip_penguji_2;
    if (data.nip_ketua_sidang !== undefined)
      updateData.nip_ketua_sidang = data.nip_ketua_sidang;

    return prisma.pendaftaran.update({
      where: { id },
      data: updateData,
    });
  }

  public static async updateStatusBerkas(
    id: string,
    data: UpdateStatusBerkasType
  ) {
    return prisma.pendaftaran.update({
      where: { id },
      data: { status_berkas: data.status_berkas },
    });
  }

  public static async destroy(id: string) {
    return prisma.pendaftaran.delete({
      where: { id },
    });
  }

  public static async jenisSeminarExists(id: string) {
    return (await prisma.jenis_seminar.count({ where: { id } })) > 0;
  }

  public static async dosenExists(nip: string) {
    return (await prisma.dosen.count({ where: { nip } })) > 0;
  }

  private static async findDataPendaftaranByIds(ids: string[]) {
    if (ids.length === 0) return new Map<string, DataPendaftaranWithTemplate[]>();

    const rows = await prisma.data_pendaftaran.findMany({
      where: { id_pendaftaran: { in: ids } },
      include: {
        dokumen_template: {
          select: {
            id: true,
            nama: true,
            kode: true,
            tipe_input: true,
            format_file: true,
            max_size_mb: true,
            is_special: true,
          },
        },
      },
      orderBy: { id_dokumen_template: 'asc' },
    });

    return rows.reduce((acc, row) => {
      const items = acc.get(row.id_pendaftaran) ?? [];
      items.push(row as DataPendaftaranWithTemplate);
      acc.set(row.id_pendaftaran, items);
      return acc;
    }, new Map<string, DataPendaftaranWithTemplate[]>());
  }

  private static mapWithRelations(
    pendaftaran: PendaftaranType,
    jenisSeminar: PendaftaranWithRelations['jenis_seminar'],
    mahasiswa: PendaftaranWithRelations['mahasiswa'],
    dataPendaftaran: DataPendaftaranWithTemplate[]
  ): PendaftaranWithDataDokumen {
    return {
      id: pendaftaran.id,
      nim: pendaftaran.nim,
      tahun_ajaran: pendaftaran.tahun_ajaran,
      id_pengajuan_fst: pendaftaran.id_pengajuan_fst,
      id_jenis_seminar: pendaftaran.id_jenis_seminar,
      nip_pembimbing_1: pendaftaran.nip_pembimbing_1,
      nip_pembimbing_2: pendaftaran.nip_pembimbing_2,
      nip_penguji_1: pendaftaran.nip_penguji_1,
      nip_penguji_2: pendaftaran.nip_penguji_2,
      nip_ketua_sidang: pendaftaran.nip_ketua_sidang,
      status_berkas: pendaftaran.status_berkas,
      created_at: pendaftaran.created_at,
      jenis_seminar: jenisSeminar,
      mahasiswa,
      data_pendaftaran: dataPendaftaran,
    };
  }
}
