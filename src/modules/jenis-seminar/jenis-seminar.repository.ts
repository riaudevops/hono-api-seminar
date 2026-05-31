import prisma from '../../infrastructures/db.infrastructure';
import type { UpsertJenisSeminarType } from './jenis-seminar.type';

export default class JenisSeminarRepository {
  public static async findAll(onlyAktif: boolean = false) {
    return prisma.jenis_seminar.findMany({
      where: onlyAktif ? { is_aktif: true } : undefined,
      orderBy: { kode: 'asc' },
    });
  }

  public static async findById(id: string) {
    return prisma.jenis_seminar.findUnique({
      where: { id },
    });
  }

  public static async findByKode(kode: string) {
    return prisma.jenis_seminar.findUnique({
      where: { kode },
    });
  }

  public static async findByIdWithRequirements(id: string) {
    return prisma.jenis_seminar.findUnique({
      where: { id },
      include: {
        requirement_dokumen: {
          include: { dokumen_template: true },
          orderBy: { urutan: 'asc' },
        },
      },
    });
  }

  public static async findByKodeWithRequirements(kode: string) {
    return prisma.jenis_seminar.findUnique({
      where: { kode },
      include: {
        requirement_dokumen: {
          include: { dokumen_template: true },
          orderBy: { urutan: 'asc' },
        },
      },
    });
  }

  public static async upsert(data: UpsertJenisSeminarType) {
    return prisma.jenis_seminar.upsert({
      where: { kode: data.kode },
      create: {
        kode: data.kode,
        nama: data.nama,
        deskripsi: data.deskripsi,
        is_aktif: data.is_aktif ?? true,
        wajib_pembimbing: data.wajib_pembimbing ?? 1,
        wajib_penguji: data.wajib_penguji ?? 2,
        ada_ketua_sidang: data.ada_ketua_sidang ?? false,
      },
      update: {
        nama: data.nama,
        deskripsi: data.deskripsi,
        is_aktif: data.is_aktif,
        wajib_pembimbing: data.wajib_pembimbing,
        wajib_penguji: data.wajib_penguji,
        ada_ketua_sidang: data.ada_ketua_sidang,
      },
    });
  }

  public static async destroy(id: string) {
    return prisma.jenis_seminar.delete({
      where: { id },
    });
  }

  public static async countPendaftaran(id: string) {
    return prisma.pendaftaran.count({
      where: { id_jenis_seminar: id },
    });
  }
}
