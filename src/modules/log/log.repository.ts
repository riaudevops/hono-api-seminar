import { Prisma } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import { CreateLogType, LogFilter } from './log.type';

export default class LogRepository {
  private static buildWhere(filters?: LogFilter): Prisma.logWhereInput | undefined {
    if (!filters) return undefined;

    const timestamp = {
      ...(filters.start_date ? { gte: filters.start_date } : {}),
      ...(filters.end_date ? { lte: filters.end_date } : {}),
    };

    return {
      ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
      ...(filters.entity_id ? { entity_id: filters.entity_id } : {}),
      ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
      ...(filters.actor_type ? { actor_type: filters.actor_type } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(Object.keys(timestamp).length > 0 ? { timestamp } : {}),
    };
  }

  public static async findAll(
    filters?: LogFilter,
    limit?: number,
    offset?: number
  ) {
    return prisma.log.findMany({
      where: this.buildWhere(filters),
      ...(limit ? { take: limit } : {}),
      ...(offset ? { skip: offset } : {}),
      orderBy: { timestamp: 'desc' },
    });
  }

  public static async findByFilters(
    filters: LogFilter,
    limit?: number,
    offset?: number
  ) {
    return this.findAll(filters, limit, offset);
  }

  public static async count(filters?: LogFilter) {
    return prisma.log.count({ where: this.buildWhere(filters) });
  }

  public static async findById(id: string) {
    return prisma.log.findUnique({ where: { id } });
  }

  public static async create(data: CreateLogType) {
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
}
