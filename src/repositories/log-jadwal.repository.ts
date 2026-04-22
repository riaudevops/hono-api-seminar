import prisma from '../infrastructures/db.infrastructure';
import { LogActionType, LogActorType, Prisma } from '@prisma/client';

export interface CreateLogJadwalInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  jadwal_id: string;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export type UpdateLogJadwalInput = Prisma.log_jadwalUncheckedUpdateInput;

export interface LogJadwalFilter {
  jadwal_id?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
}

export default class LogJadwalRepository {
  public static async findAll(limit?: number, offset?: number) {
    return prisma.log_jadwal.findMany({
      ...(limit && { take: limit }),
      ...(offset && { skip: offset }),
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findById(id: string) {
    return prisma.log_jadwal.findUnique({
      where: { id },
    });
  }

  public static async findByFilters(filters: LogJadwalFilter) {
    return prisma.log_jadwal.findMany({
      where: {
        ...(filters.jadwal_id ? { jadwal_id: filters.jadwal_id } : {}),
        ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
        ...(filters.actor_type ? { actor_type: filters.actor_type } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByJadwalId(jadwal_id: string) {
    return prisma.log_jadwal.findMany({
      where: { jadwal_id },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByActorId(actor_id: string) {
    return prisma.log_jadwal.findMany({
      where: { actor_id },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByActorType(actor_type: LogActorType) {
    return prisma.log_jadwal.findMany({
      where: { actor_type },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByAction(action: LogActionType) {
    return prisma.log_jadwal.findMany({
      where: { action },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  public static async findByDateRange(startDate: Date, endDate: Date) {
    return prisma.log_jadwal.findMany({
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

  public static async create(data: CreateLogJadwalInput) {
    return prisma.log_jadwal.create({
      data: {
        action: data.action,
        actor_type: data.actor_type,
        actor_id: data.actor_id,
        jadwal_id: data.jadwal_id,
        old_values: data.old_values,
        new_values: data.new_values,
      },
    });
  }

  public static async update(id: string, data: UpdateLogJadwalInput) {
    return prisma.log_jadwal.update({
      where: { id },
      data,
    });
  }

  public static async destroy(id: string) {
    return prisma.log_jadwal.delete({
      where: { id },
    });
  }

  public static async count() {
    return prisma.log_jadwal.count();
  }

  public static async countByJadwalId(jadwal_id: string) {
    return prisma.log_jadwal.count({
      where: { jadwal_id },
    });
  }

  public static async countByActorId(actor_id: string) {
    return prisma.log_jadwal.count({
      where: { actor_id },
    });
  }

  public static async deleteOldLogs(olderThan: Date) {
    return prisma.log_jadwal.deleteMany({
      where: {
        timestamp: {
          lt: olderThan,
        },
      },
    });
  }
}
