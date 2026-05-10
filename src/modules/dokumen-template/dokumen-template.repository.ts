import prisma from '../../infrastructures/db.infrastructure';
import {
  CreateDokumenTemplateType,
  UpdateDokumenTemplateType,
} from './dokumen-template.type';

export default class DokumenTemplateRepository {
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
    if (data.format_file !== undefined) updateData.format_file = data.format_file;
    if (data.max_size_mb !== undefined) updateData.max_size_mb = data.max_size_mb;
    if (data.is_special !== undefined) updateData.is_special = data.is_special;

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
