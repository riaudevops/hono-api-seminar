import prisma from '../../infrastructures/db.infrastructure';
import {
  CreateJenisSeminarType,
  UpdateJenisSeminarType,
} from './jenis-seminar.type';

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

  public static async create(data: CreateJenisSeminarType) {
    return prisma.jenis_seminar.create({
      data: {
        kode: data.kode,
        nama: data.nama,
        deskripsi: data.deskripsi,
        is_aktif: data.is_aktif ?? true,
        jumlah_pembimbing: data.jumlah_pembimbing ?? 1,
        jumlah_penguji: data.jumlah_penguji ?? 2,
        ada_ketua_sidang: data.ada_ketua_sidang ?? false,
      },
    });
  }

  public static async update(id: string, data: UpdateJenisSeminarType) {
    return prisma.jenis_seminar.update({
      where: { id },
      data,
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
