import { LogActionType, LogActorType, Prisma } from '@prisma/client';
import LogJadwalRepository from '../repositories/log-jadwal.repository';
import { APIError } from '../utils/api-error.util';

export interface LogJadwalFilter {
  jadwal_id?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
}

export interface CreateLogJadwalInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  jadwal_id: string;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export interface UpdateLogJadwalInput {
  action?: LogActionType;
  actor_type?: LogActorType;
  actor_id?: string;
  jadwal_id?: string;
  old_values?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  new_values?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export default class LogJadwalService {
  public static async getAll(filters?: LogJadwalFilter) {
    const logs = filters
      ? await LogJadwalRepository.findByFilters(filters)
      : await LogJadwalRepository.findAll();

    return {
      response: true,
      message: 'Data log jadwal berhasil diambil',
      data: logs,
    };
  }

  public static async get(id: string) {
    const log = await LogJadwalRepository.findById(id);
    if (!log) {
      throw new APIError('Log jadwal tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Detail log jadwal berhasil diambil',
      data: log,
    };
  }

  public static async create(data: CreateLogJadwalInput) {
    const log = await LogJadwalRepository.create(data);

    return {
      response: true,
      message: 'Log jadwal berhasil ditambahkan',
      data: log,
    };
  }

  public static async update(id: string, data: UpdateLogJadwalInput) {
    await this.get(id);

    const normalizedData = {
      ...data,
      ...(data.old_values === null ? { old_values: Prisma.JsonNull } : {}),
      ...(data.new_values === null ? { new_values: Prisma.JsonNull } : {}),
    };

    const updated = await LogJadwalRepository.update(id, normalizedData);

    return {
      response: true,
      message: 'Log jadwal berhasil diperbarui',
      data: updated,
    };
  }

  public static async delete(id: string) {
    await this.get(id);

    await LogJadwalRepository.destroy(id);

    return {
      response: true,
      message: 'Log jadwal berhasil dihapus',
    };
  }
}
