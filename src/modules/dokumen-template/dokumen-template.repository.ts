import prisma from '../../infrastructures/db.infrastructure';
import type {
  CreateDokumenTemplateType,
  DokumenTemplateWithJenisSeminar,
  UpdateDokumenTemplateType,
} from './dokumen-template.type';

export default class DokumenTemplateRepository {
  public static async findAllWithJenisSeminar(): Promise<
    DokumenTemplateWithJenisSeminar[]
  > {
    const [templates, requirements, jenisSeminars] = await Promise.all([
      prisma.dokumen_template.findMany({
        orderBy: { kode: 'asc' },
      }),
      prisma.requirement_dokumen.findMany({
        orderBy: { urutan: 'asc' },
      }),
      prisma.jenis_seminar.findMany({
        select: { id: true, nama: true, kode: true },
      }),
    ]);

    const jenisSeminarById = new Map(
      jenisSeminars.map((jenisSeminar) => [jenisSeminar.id, jenisSeminar])
    );
    const requirementsByTemplate = requirements.reduce((acc, requirement) => {
      const jenisSeminar = jenisSeminarById.get(requirement.id_jenis_seminar);
      if (!jenisSeminar) return acc;

      const items = acc.get(requirement.id_dokumen_template) ?? [];
      items.push(jenisSeminar);
      acc.set(requirement.id_dokumen_template, items);
      return acc;
    }, new Map<string, { id: string; nama: string; kode: string }[]>());

    return templates.map((template) => ({
      id: template.id,
      nama: template.nama,
      kode: template.kode,
      deskripsi: template.deskripsi,
      tipe_input: template.tipe_input,
      opsi: template.opsi ? (template.opsi as string[]) : null,
      format_file: template.format_file,
      max_size_mb: template.max_size_mb,
      is_special: template.is_special,
      can_view_dosen: template.can_view_dosen,
      jenis_seminars: requirementsByTemplate.get(template.id) ?? [],
    }));
  }

  public static async findAll(onlyAktif: boolean = false) {
    return prisma.dokumen_template.findMany({
      orderBy: { kode: 'asc' },
    });
  }

  public static async findById(id: string) {
    return prisma.dokumen_template.findUnique({
      where: { id },
    });
  }

  public static async findByKode(kode: string) {
    return prisma.dokumen_template.findUnique({
      where: { kode },
    });
  }

  public static async findByIdWithRequirements(id: string) {
    return prisma.dokumen_template.findUnique({
      where: { id },
      include: {
        requirement_dokumen: {
          include: { jenis_seminar: true },
          orderBy: { urutan: 'asc' },
        },
      },
    });
  }

  public static async create(data: CreateDokumenTemplateType) {
    return prisma.dokumen_template.create({
      data: {
        nama: data.nama,
        kode: data.kode,
        deskripsi: data.deskripsi,
        tipe_input: data.tipe_input,
        opsi: data.opsi ? JSON.stringify(data.opsi) : undefined,
        format_file: data.format_file,
        max_size_mb: data.max_size_mb,
        is_special: data.is_special ?? false,
        can_view_dosen: data.can_view_dosen ?? false,
      },
    });
  }

  public static async update(id: string, data: UpdateDokumenTemplateType) {
    const updateData: Record<string, unknown> = {};

    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.kode !== undefined) updateData.kode = data.kode;
    if (data.deskripsi !== undefined) updateData.deskripsi = data.deskripsi;
    if (data.tipe_input !== undefined) updateData.tipe_input = data.tipe_input;
    if (data.opsi !== undefined)
      updateData.opsi = data.opsi ? JSON.stringify(data.opsi) : null;
    if (data.format_file !== undefined)
      updateData.format_file = data.format_file;
    if (data.max_size_mb !== undefined)
      updateData.max_size_mb = data.max_size_mb;
    if (data.is_special !== undefined) updateData.is_special = data.is_special;
    if (data.can_view_dosen !== undefined)
      updateData.can_view_dosen = data.can_view_dosen;

    return prisma.dokumen_template.update({
      where: { id },
      data: updateData,
    });
  }

  public static async destroy(id: string) {
    return prisma.dokumen_template.delete({
      where: { id },
    });
  }

  public static async countRequirement(id: string) {
    return prisma.requirement_dokumen.count({
      where: { id_dokumen_template: id },
    });
  }
}
