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

// Map TipeInputDokumen enum to the correct nilai_* column
function mapNilaiByTipe(
  tipe: string,
  value: string | boolean | string[] | null
): {
  nilai_text: string | null;
  nilai_file_url: string | null;
  nilai_boolean: boolean | null;
  nilai_date: Date | null;
  nilai_json: unknown | null;
} {
  switch (tipe) {
    case 'TEXT':
    case 'SELECT':
      return {
        nilai_text: typeof value === 'string' ? value : null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: null,
      };
    case 'FILE_UPLOAD':
    case 'URL':
      return {
        nilai_text: null,
        nilai_file_url: typeof value === 'string' ? value : null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: null,
      };
    case 'BOOLEAN':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: typeof value === 'boolean' ? value : null,
        nilai_date: null,
        nilai_json: null,
      };
    case 'DATE':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date:
          value !== null && typeof value === 'string'
            ? new Date(value)
            : null,
        nilai_json: null,
      };
    case 'MULTI_SELECT':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: Array.isArray(value) ? value : null,
      };
    default:
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: null,
      };
  }
}

export default class PendaftaranRepository {
  public static async findAllWithRelations(): Promise<
    PendaftaranWithDataDokumen[]
  > {
    const [pendaftaranList, jenisSeminars, mahasiswas, dosens] = await Promise.all([
      prisma.pendaftaran.findMany({
        orderBy: { created_at: 'desc' },
      }),
      prisma.jenis_seminar.findMany({
        select: { id: true, nama: true, kode: true },
      }),
      prisma.mahasiswa.findMany({
        select: { nim: true, nama: true, email: true },
      }),
      prisma.dosen.findMany({
        select: { nip: true, nama: true },
      }),
    ]);

    const jenisSeminarById = new Map(
      jenisSeminars.map((jenisSeminar) => [jenisSeminar.id, jenisSeminar])
    );
    const mahasiswaByNim = new Map(
      mahasiswas.map((mahasiswa) => [mahasiswa.nim, mahasiswa])
    );
    const dosenByNip = new Map(dosens.map((dosen) => [dosen.nip, dosen]));

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
        dataPendaftaran.get(p.id) ?? [],
        dosenByNip
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

    const nips = [
      pendaftaran.nip_pembimbing_1,
      pendaftaran.nip_pembimbing_2,
      pendaftaran.nip_penguji_1,
      pendaftaran.nip_penguji_2,
      pendaftaran.nip_ketua_sidang,
    ].filter((nip): nip is string => !!nip);

    const [jenisSeminar, mahasiswa, dataPendaftaran, dosens] = await Promise.all([
      prisma.jenis_seminar.findUnique({
        where: { id: pendaftaran.id_jenis_seminar },
        select: { id: true, nama: true, kode: true },
      }),
      prisma.mahasiswa.findUnique({
        where: { nim: pendaftaran.nim },
        select: { nim: true, nama: true, email: true },
      }),
      this.findDataPendaftaranByIds([id]),
      prisma.dosen.findMany({
        where: { nip: { in: nips } },
        select: { nip: true, nama: true },
      }),
    ]);
    const dosenByNip = new Map(dosens.map((dosen) => [dosen.nip, dosen]));

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
      dataPendaftaran.get(id) ?? [],
      dosenByNip
    );
  }

  public static async findByIdPengajuanFst(id_pengajuan_fst: string) {
    return prisma.pendaftaran.findUnique({
      where: { id_pengajuan_fst },
    });
  }

  public static async findByNimJenisSeminarTahunAjaran(
    nim: string,
    id_jenis_seminar: string,
    tahun_ajaran: string
  ) {
    return prisma.pendaftaran.findFirst({
      where: { nim, id_jenis_seminar, tahun_ajaran },
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
        select: {
          id_dokumen_template: true,
          dokumen_template: {
            select: { kode: true, tipe_input: true },
          },
        },
      });

      if (requirements.length > 0) {
        const dokumenPayload = data.dokumen ?? {};
        await tx.data_pendaftaran.createMany({
          data: requirements.map((requirement) => {
            const tpl = requirement.dokumen_template;
            const value = dokumenPayload[tpl.kode] ?? null;
            const nilai = mapNilaiByTipe(tpl.tipe_input, value);
            return {
              id_pendaftaran: pendaftaran.id,
              id_dokumen_template: requirement.id_dokumen_template,
              ...nilai,
            };
          }),
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
    dataPendaftaran: DataPendaftaranWithTemplate[],
    dosenByNip: Map<string, { nip: string; nama: string | null }> = new Map()
  ): PendaftaranWithDataDokumen {
    return {
      id: pendaftaran.id,
      nim: pendaftaran.nim,
      tahun_ajaran: pendaftaran.tahun_ajaran,
      id_pengajuan_fst: pendaftaran.id_pengajuan_fst,
      id_jenis_seminar: pendaftaran.id_jenis_seminar,
      nip_pembimbing_1: pendaftaran.nip_pembimbing_1,
      nama_pembimbing_1:
        dosenByNip.get(pendaftaran.nip_pembimbing_1)?.nama ?? null,
      nip_pembimbing_2: pendaftaran.nip_pembimbing_2,
      nama_pembimbing_2: pendaftaran.nip_pembimbing_2
        ? dosenByNip.get(pendaftaran.nip_pembimbing_2)?.nama ?? null
        : null,
      nip_penguji_1: pendaftaran.nip_penguji_1,
      nama_penguji_1: pendaftaran.nip_penguji_1
        ? dosenByNip.get(pendaftaran.nip_penguji_1)?.nama ?? null
        : null,
      nip_penguji_2: pendaftaran.nip_penguji_2,
      nama_penguji_2: pendaftaran.nip_penguji_2
        ? dosenByNip.get(pendaftaran.nip_penguji_2)?.nama ?? null
        : null,
      nip_ketua_sidang: pendaftaran.nip_ketua_sidang,
      nama_ketua_sidang: pendaftaran.nip_ketua_sidang
        ? dosenByNip.get(pendaftaran.nip_ketua_sidang)?.nama ?? null
        : null,
      status_berkas: pendaftaran.status_berkas,
      created_at: pendaftaran.created_at,
      jenis_seminar: jenisSeminar,
      mahasiswa,
      data_pendaftaran: dataPendaftaran,
    };
  }
}
