import prisma from '../infrastructures/db.infrastructure';
import { LogActionType, LogActorType } from '@prisma/client';

export interface CreateLogPenilaianInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  id_jadwal: string;
  id_komponen_penilaian: string;
  old_nilai?: number | null;
  new_nilai?: number | null;
}

export interface UpdateLogPenilaianInput {
  action?: LogActionType;
  actor_type?: LogActorType;
  actor_id?: string;
  id_jadwal?: string;
  id_komponen_penilaian?: string;
  old_nilai?: number | null;
  new_nilai?: number | null;
}

export interface LogPenilaianFilter {
  id_jadwal?: string;
  id_komponen_penilaian?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
}

export default class LogPenilaianRepository {
  public static async findAll(limit?: number, offset?: number) {
    return prisma.log_penilaian.findMany({
      ...(limit && { take: limit }),
      ...(offset && { skip: offset }),
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findById(id: string) {
    return prisma.log_penilaian.findUnique({
      where: { id },
    });
  }

  public static async findByFilters(filters: LogPenilaianFilter) {
    return prisma.log_penilaian.findMany({
      where: {
        ...(filters.id_jadwal ? { id_jadwal: filters.id_jadwal } : {}),
        ...(filters.id_komponen_penilaian
          ? { id_komponen_penilaian: filters.id_komponen_penilaian }
          : {}),
        ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
        ...(filters.actor_type ? { actor_type: filters.actor_type } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByJadwalId(id_jadwal: string) {
    return prisma.log_penilaian.findMany({
      where: { id_jadwal },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByKomponenId(id_komponen_penilaian: string) {
    return prisma.log_penilaian.findMany({
      where: { id_komponen_penilaian },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByActorId(actor_id: string) {
    return prisma.log_penilaian.findMany({
      where: { actor_id },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByActorType(actor_type: LogActorType) {
    return prisma.log_penilaian.findMany({
      where: { actor_type },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByAction(action: LogActionType) {
    return prisma.log_penilaian.findMany({
      where: { action },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByDateRange(startDate: Date, endDate: Date) {
    return prisma.log_penilaian.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async create(data: CreateLogPenilaianInput) {
    return prisma.log_penilaian.create({
      data: {
        action: data.action,
        actor_type: data.actor_type,
        actor_id: data.actor_id,
        id_jadwal: data.id_jadwal,
        id_komponen_penilaian: data.id_komponen_penilaian,
        old_nilai: data.old_nilai,
        new_nilai: data.new_nilai,
      },
    });
  }

  public static async update(id: string, data: UpdateLogPenilaianInput) {
    return prisma.log_penilaian.update({
      where: { id },
      data,
    });
  }

  public static async destroy(id: string) {
    return prisma.log_penilaian.delete({
      where: { id },
    });
  }

  public static async count() {
    return prisma.log_penilaian.count();
  }

  public static async countByJadwalId(id_jadwal: string) {
    return prisma.log_penilaian.count({
      where: { id_jadwal },
    });
  }

  public static async countByActorId(actor_id: string) {
    return prisma.log_penilaian.count({
      where: { actor_id },
    });
  }

  public static async deleteOldLogs(olderThan: Date) {
    return prisma.log_penilaian.deleteMany({
      where: {
        timestamp: {
          lt: olderThan,
        },
      },
    });
  }

  public static async getLogsByJadwalAndKomponen(
    id_jadwal: string,
    id_komponen_penilaian: string
  ) {
    return prisma.log_penilaian.findMany({
      where: {
        id_jadwal,
        id_komponen_penilaian,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }
}
