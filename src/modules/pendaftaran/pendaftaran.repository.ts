import { Prisma } from '@prisma/client';
import type { StatusBerkas, StatusJadwal } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import type {
  CreatePendaftaranByMahasiswaType,
  DataPendaftaranWithTemplate,
  PendaftaranType,
  PendaftaranWithDataDokumen,
  PendaftaranWithRelations,
  UpdateDosenByKoordinatorType,
  UpdatePendaftaranByMahasiswaType,
  UpdateStatusBerkasType,
} from './pendaftaran.type';

interface CreatePendaftaranInput extends CreatePendaftaranByMahasiswaType {
  id: string;
  nim: string;
  kode_tahun_ajaran: string;
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
  nilai_json: Prisma.InputJsonValue | typeof Prisma.JsonNull;
} {
  switch (tipe) {
    case 'TEXT':
    case 'SELECT':
      return {
        nilai_text: typeof value === 'string' ? value : null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: Prisma.JsonNull,
      };
    case 'FILE_UPLOAD':
    case 'URL':
      return {
        nilai_text: null,
        nilai_file_url: typeof value === 'string' ? value : null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: Prisma.JsonNull,
      };
    case 'BOOLEAN':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: typeof value === 'boolean' ? value : null,
        nilai_date: null,
        nilai_json: Prisma.JsonNull,
      };
    case 'DATE':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date:
          value !== null && typeof value === 'string' ? new Date(value) : null,
        nilai_json: Prisma.JsonNull,
      };
    case 'MULTI_SELECT':
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: Array.isArray(value) ? value : Prisma.JsonNull,
      };
    default:
      return {
        nilai_text: null,
        nilai_file_url: null,
        nilai_boolean: null,
        nilai_date: null,
        nilai_json: Prisma.JsonNull,
      };
  }
}

export default class PendaftaranRepository {
  public static async findAllWithRelations(): Promise<
    PendaftaranWithDataDokumen[]
  > {
    const [pendaftaranList, jenisSeminars, mahasiswas, dosens] =
      await Promise.all([
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

    const dataPendaftaran =
      await PendaftaranRepository.findDataPendaftaranByIds(
        pendaftaranList.map((p) => p.id)
      );

    return pendaftaranList.map((p) => {
      const mahasiswa = mahasiswaByNim.get(p.nim);
      return PendaftaranRepository.mapWithRelations(
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
    const all = await PendaftaranRepository.findAllWithRelations();
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
    ].filter((nip): nip is string => !!nip);

    const [jenisSeminar, mahasiswa, dataPendaftaran, dosens] =
      await Promise.all([
        prisma.jenis_seminar.findUnique({
          where: { id: pendaftaran.id_jenis_seminar },
          select: { id: true, nama: true, kode: true },
        }),
        prisma.mahasiswa.findUnique({
          where: { nim: pendaftaran.nim },
          select: { nim: true, nama: true, email: true },
        }),
        PendaftaranRepository.findDataPendaftaranByIds([id]),
        prisma.dosen.findMany({
          where: { nip: { in: nips } },
          select: { nip: true, nama: true },
        }),
      ]);
    const dosenByNip = new Map(dosens.map((dosen) => [dosen.nip, dosen]));

    return PendaftaranRepository.mapWithRelations(
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
    kode_tahun_ajaran: string
  ) {
    return prisma.pendaftaran.findFirst({
      where: { nim, id_jenis_seminar, kode_tahun_ajaran },
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
          kode_tahun_ajaran: data.kode_tahun_ajaran,
          id_pengajuan_fst: data.id_pengajuan_fst,
          id_jenis_seminar: data.id_jenis_seminar,
          nip_pembimbing_1: data.nip_pembimbing_1,
          nip_pembimbing_2: data.nip_pembimbing_2 ?? null,
          nip_penguji_1: data.nip_penguji_1 ?? null,
          nip_penguji_2: data.nip_penguji_2 ?? null,
          status_berkas: 'PENDING',
          updated_at: new Date(),
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
    return prisma.$transaction(async (tx) => {
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

      const pendaftaran = await tx.pendaftaran.update({
        where: { id },
        data: updateData,
      });

      if (data.dokumen) {
        const templates = await tx.dokumen_template.findMany({
          where: { kode: { in: Object.keys(data.dokumen) } },
          select: { id: true, kode: true, tipe_input: true },
        });

        for (const template of templates) {
          const nilai = mapNilaiByTipe(
            template.tipe_input,
            data.dokumen[template.kode]
          );
          await tx.data_pendaftaran.upsert({
            where: {
              id_pendaftaran_id_dokumen_template: {
                id_pendaftaran: id,
                id_dokumen_template: template.id,
              },
            },
            update: nilai as Prisma.data_pendaftaranUpdateInput,
            create: {
              id_pendaftaran: id,
              id_dokumen_template: template.id,
              ...nilai,
            },
          });
        }
      }

      return pendaftaran;
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

  public static async updateStatusJadwalByJadwalData(
    nim: string,
    id_jenis_seminar: string,
    kode_tahun_ajaran: string,
    status_jadwal: StatusJadwal,
    client: any = prisma
  ) {
    return client.pendaftaran.updateMany({
      where: {
        nim,
        id_jenis_seminar,
        kode_tahun_ajaran,
      },
      data: { status_jadwal },
    });
  }

  public static async updateDosenByKoordinator(
    id: string,
    data: UpdateDosenByKoordinatorType
  ) {
    return prisma.pendaftaran.update({
      where: { id },
      data: {
        ...(data.nip_pembimbing_1 !== undefined && {
          nip_pembimbing_1: data.nip_pembimbing_1,
        }),
        ...(data.nip_pembimbing_2 !== undefined && {
          nip_pembimbing_2: data.nip_pembimbing_2,
        }),
        ...(data.nip_penguji_1 !== undefined && {
          nip_penguji_1: data.nip_penguji_1,
        }),
        ...(data.nip_penguji_2 !== undefined && {
          nip_penguji_2: data.nip_penguji_2,
        }),
      },
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

  public static async findJenisSeminarById(id: string) {
    return prisma.jenis_seminar.findUnique({
      where: { id },
      select: { id: true, ada_ketua_sidang: true },
    });
  }

  public static async getStatsByStatus(where?: {
    kode_tahun_ajaran?: string;
  }): Promise<Record<StatusBerkas, number>> {
    const rows = await prisma.pendaftaran.findMany({
      where,
      select: { status_berkas: true },
    });
    return rows.reduce(
      (acc, row) => {
        acc[row.status_berkas] += 1;
        return acc;
      },
      {
        PENDING: 0,
        REVISI: 0,
        APPROVED: 0,
        REJECTED: 0,
        UPLOAD_ULANG: 0,
      } as Record<StatusBerkas, number>
    );
  }

  public static async getAvgProcessingTime(where?: {
    kode_tahun_ajaran?: string;
  }): Promise<number | null> {
    const result = await prisma.pendaftaran.findMany({
      where: {
        ...where,
        status_berkas: { in: ['APPROVED', 'REJECTED'] },
      },
      select: {
        created_at: true,
        updated_at: true,
      },
    });

    if (result.length === 0) return null;

    const totalMs = result.reduce((sum, p) => {
      const diff = p.updated_at.getTime() - p.created_at.getTime();
      return sum + diff;
    }, 0);

    return totalMs / result.length;
  }

  public static async dosenExists(nip: string) {
    return (await prisma.dosen.count({ where: { nip } })) > 0;
  }

  private static async findDataPendaftaranByIds(ids: string[]) {
    if (ids.length === 0)
      return new Map<string, DataPendaftaranWithTemplate[]>();

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
      kode_tahun_ajaran: pendaftaran.kode_tahun_ajaran,
      id_pengajuan_fst: pendaftaran.id_pengajuan_fst,
      id_jenis_seminar: pendaftaran.id_jenis_seminar,
      nip_pembimbing_1: pendaftaran.nip_pembimbing_1,
      nama_pembimbing_1:
        dosenByNip.get(pendaftaran.nip_pembimbing_1)?.nama ?? null,
      nip_pembimbing_2: pendaftaran.nip_pembimbing_2,
      nama_pembimbing_2: pendaftaran.nip_pembimbing_2
        ? (dosenByNip.get(pendaftaran.nip_pembimbing_2)?.nama ?? null)
        : null,
      nip_penguji_1: pendaftaran.nip_penguji_1,
      nama_penguji_1: pendaftaran.nip_penguji_1
        ? (dosenByNip.get(pendaftaran.nip_penguji_1)?.nama ?? null)
        : null,
      nip_penguji_2: pendaftaran.nip_penguji_2,
      nama_penguji_2: pendaftaran.nip_penguji_2
        ? (dosenByNip.get(pendaftaran.nip_penguji_2)?.nama ?? null)
        : null,
      status_berkas: pendaftaran.status_berkas,
      status_jadwal: pendaftaran.status_jadwal,
      created_at: pendaftaran.created_at,
      updated_at: pendaftaran.updated_at,
      jenis_seminar: jenisSeminar,
      mahasiswa,
      data_pendaftaran: dataPendaftaran,
    };
  }
}
