import prisma from '../../infrastructures/db.infrastructure';
import {
  CreateRequirementDokumenType,
  RequirementDokumenWithRelations,
  UpdateRequirementDokumenType,
} from './requirement-dokumen.type';

export default class RequirementDokumenRepository {
  public static async findAllWithRelations(): Promise<
    RequirementDokumenWithRelations[]
  > {
    const [requirements, jenisSeminars, dokumenTemplates] = await Promise.all([
      prisma.requirement_dokumen.findMany({
        orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
      }),
      prisma.jenis_seminar.findMany({
        select: { id: true, nama: true, kode: true },
      }),
      prisma.dokumen_template.findMany({
        select: { id: true, nama: true, kode: true },
      }),
    ]);

    const jenisSeminarById = new Map(
      jenisSeminars.map((jenisSeminar) => [jenisSeminar.id, jenisSeminar])
    );
    const dokumenTemplateById = new Map(
      dokumenTemplates.map((dokumenTemplate) => [
        dokumenTemplate.id,
        dokumenTemplate,
      ])
    );

    return requirements.reduce<RequirementDokumenWithRelations[]>(
      (acc, requirement) => {
        const jenisSeminar = jenisSeminarById.get(requirement.id_jenis_seminar);
        const dokumenTemplate = dokumenTemplateById.get(
          requirement.id_dokumen_template
        );
        if (!jenisSeminar || !dokumenTemplate) return acc;

        acc.push({
          id: requirement.id,
          id_jenis_seminar: requirement.id_jenis_seminar,
          id_dokumen_template: requirement.id_dokumen_template,
          urutan: requirement.urutan,
          is_wajib: requirement.is_wajib,
          keterangan_tambahan: requirement.keterangan_tambahan,
          jenis_seminar: jenisSeminar,
          dokumen_template: dokumenTemplate,
        });
        return acc;
      },
      []
    );
  }

  public static async findById(id: string) {
    return prisma.requirement_dokumen.findUnique({
      where: { id },
    });
  }

  public static async findByIdWithRelations(id: string) {
    return prisma.requirement_dokumen.findUnique({
      where: { id },
      include: {
        jenis_seminar: {
          select: { id: true, nama: true, kode: true },
        },
        dokumen_template: {
          select: { id: true, nama: true, kode: true },
        },
      },
    });
  }

  public static async findByPair(
    id_jenis_seminar: string,
    id_dokumen_template: string
  ) {
    return prisma.requirement_dokumen.findUnique({
      where: {
        id_jenis_seminar_id_dokumen_template: {
          id_jenis_seminar,
          id_dokumen_template,
        },
      },
    });
  }

  public static async create(data: CreateRequirementDokumenType) {
    return prisma.requirement_dokumen.create({
      data: {
        id_jenis_seminar: data.id_jenis_seminar,
        id_dokumen_template: data.id_dokumen_template,
        urutan: data.urutan ?? 0,
        is_wajib: data.is_wajib ?? true,
        keterangan_tambahan: data.keterangan_tambahan,
      },
    });
  }

  public static async update(id: string, data: UpdateRequirementDokumenType) {
    const updateData: Record<string, unknown> = {};

    if (data.id_jenis_seminar !== undefined)
      updateData.id_jenis_seminar = data.id_jenis_seminar;
    if (data.id_dokumen_template !== undefined)
      updateData.id_dokumen_template = data.id_dokumen_template;
    if (data.urutan !== undefined) updateData.urutan = data.urutan;
    if (data.is_wajib !== undefined) updateData.is_wajib = data.is_wajib;
    if (data.keterangan_tambahan !== undefined)
      updateData.keterangan_tambahan = data.keterangan_tambahan;

    return prisma.requirement_dokumen.update({
      where: { id },
      data: updateData,
    });
  }

  public static async destroy(id: string) {
    return prisma.requirement_dokumen.delete({
      where: { id },
    });
  }

  public static async jenisSeminarExists(id: string) {
    return (
      (await prisma.jenis_seminar.count({ where: { id } })) > 0
    );
  }

  public static async dokumenTemplateExists(id: string) {
    return (
      (await prisma.dokumen_template.count({ where: { id } })) > 0
    );
  }
}
