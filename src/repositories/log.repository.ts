import prisma from '../infrastructures/db.infrastructure';
import {
  LogActionType,
  LogActorType,
  LogEntityType,
  Prisma,
} from '@prisma/client';

export interface CreateLogInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  entity_type: LogEntityType;
  entity_id: string;
  context?: Prisma.InputJsonValue;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export interface LogFilter {
  entity_type?: LogEntityType;
  entity_id?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
}

export default class LogRepository {
  public static async findAll(limit?: number, offset?: number) {
    return prisma.log.findMany({
      ...(limit && { take: limit }),
      ...(offset && { skip: offset }),
      orderBy: { timestamp: 'desc' },
    });
  }

  public static async findById(id: string) {
    return prisma.log.findUnique({ where: { id } });
  }

  public static async findByFilters(filters: LogFilter, limit?: number) {
    return prisma.log.findMany({
      where: {
        ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
        ...(filters.entity_id ? { entity_id: filters.entity_id } : {}),
        ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
        ...(filters.actor_type ? { actor_type: filters.actor_type } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      orderBy: { timestamp: 'desc' },
      ...(limit && { take: limit }),
    });
  }

  public static async create(data: CreateLogInput) {
    return prisma.log.create({ data });
  }

  public static async destroy(id: string) {
    return prisma.log.delete({ where: { id } });
  }

  public static async deleteOldLogs(olderThan: Date) {
    return prisma.log.deleteMany({
      where: { timestamp: { lt: olderThan } },
    });
  }

  public static async count(filters?: LogFilter) {
    return prisma.log.count({
      where: filters
        ? {
            ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
            ...(filters.entity_id ? { entity_id: filters.entity_id } : {}),
            ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
            ...(filters.actor_type ? { actor_type: filters.actor_type } : {}),
            ...(filters.action ? { action: filters.action } : {}),
          }
        : undefined,
    });
  }
}
