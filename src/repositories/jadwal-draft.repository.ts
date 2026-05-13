import prisma from '../infrastructures/db.infrastructure';
import { StatusJadwalDraft } from '@prisma/client';
import { CreateJadwalDraftInput, UpdateJadwalDraftInput } from '../types/jadwal-draft.type';

export default class JadwalDraftRepository {
  public static async findAll(filters?: {
    batch_id?: string;
    status?: StatusJadwalDraft;
  }) {
    return prisma.jadwal_draft.findMany({
      where: {
        ...(filters?.batch_id && { batch_id: filters.batch_id }),
        ...(filters?.status && { status: filters.status }),
      },
      include: { jenis_seminar: true },
      orderBy: { created_at: 'desc' },
    });
  }

  public static async findById(id: string) {
    return prisma.jadwal_draft.findUnique({
      where: { id },
      include: { jenis_seminar: true },
    });
  }

  public static async findByBatchId(
    batch_id: string,
    status?: StatusJadwalDraft
  ) {
    return prisma.jadwal_draft.findMany({
      where: {
        batch_id,
        ...(status && { status }),
      },
      include: { jenis_seminar: true },
      orderBy: { created_at: 'asc' },
    });
  }

  public static async createMany(data: CreateJadwalDraftInput[]) {
    return prisma.jadwal_draft.createMany({
      data: data.map((d) => ({
        batch_id: d.batch_id,
        nim: d.nim,
        id_jenis_seminar: d.id_jenis_seminar,
        judul: d.judul,
        tanggal: d.tanggal,
        waktu_mulai: d.waktu_mulai,
        waktu_selesai: d.waktu_selesai,
        kode_ruangan: d.kode_ruangan,
        list_dosen: d.list_dosen as any,
        llm_reasoning: d.llm_reasoning as any,
        confidence: d.confidence,
      })),
    });
  }

  public static async update(id: string, data: UpdateJadwalDraftInput) {
    return prisma.jadwal_draft.update({
      where: { id },
      data,
    });
  }

  public static async updateStatusByBatchId(
    batch_id: string,
    status: StatusJadwalDraft
  ) {
    return prisma.jadwal_draft.updateMany({
      where: {
        batch_id,
        status: StatusJadwalDraft.DRAFT,
      },
      data: { status },
    });
  }

  public static async countByBatchId(batch_id: string) {
    return prisma.jadwal_draft.count({
      where: { batch_id },
    });
  }
}
