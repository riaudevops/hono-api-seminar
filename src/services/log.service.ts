import {
  LogActionType,
  LogActorType,
  LogEntityType,
  Prisma,
} from '@prisma/client';
import LogRepository, {
  CreateLogInput,
  LogFilter,
} from '../repositories/log.repository';
import { APIError } from '../utils/api-error.util';

export interface CreateJadwalLogInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  jadwal_id: string;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export interface CreatePenilaianLogInput {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  id_jadwal: string;
  id_komponen_penilaian: string;
  old_nilai?: number | null;
  new_nilai?: number | null;
}

export default class LogService {
  public static async getAll(filters?: LogFilter, limit?: number) {
    const logs = filters
      ? await LogRepository.findByFilters(filters, limit)
      : await LogRepository.findAll(limit);

    return {
      response: true,
      message: 'Data log berhasil diambil',
      data: logs,
    };
  }

  public static async get(id: string) {
    const log = await LogRepository.findById(id);
    if (!log) throw new APIError('Log tidak ditemukan', 404);
    return {
      response: true,
      message: 'Detail log berhasil diambil',
      data: log,
    };
  }

  public static async create(data: CreateLogInput) {
    const log = await LogRepository.create(data);
    return {
      response: true,
      message: 'Log berhasil ditambahkan',
      data: log,
    };
  }

  // Helper: log perubahan jadwal
  public static async createJadwalLog(data: CreateJadwalLogInput) {
    return this.create({
      action: data.action,
      actor_type: data.actor_type,
      actor_id: data.actor_id,
      entity_type: LogEntityType.JADWAL,
      entity_id: data.jadwal_id,
      ...(data.old_values !== undefined ? { old_values: data.old_values } : {}),
      ...(data.new_values !== undefined ? { new_values: data.new_values } : {}),
    });
  }

  // Helper: log perubahan penilaian (context = id_komponen_penilaian, old/new values = { nilai })
  public static async createPenilaianLog(data: CreatePenilaianLogInput) {
    return this.create({
      action: data.action,
      actor_type: data.actor_type,
      actor_id: data.actor_id,
      entity_type: LogEntityType.PENILAIAN,
      entity_id: data.id_jadwal,
      context: { id_komponen_penilaian: data.id_komponen_penilaian },
      ...(data.old_nilai !== undefined && data.old_nilai !== null
        ? { old_values: { nilai: data.old_nilai } }
        : {}),
      ...(data.new_nilai !== undefined && data.new_nilai !== null
        ? { new_values: { nilai: data.new_nilai } }
        : {}),
    });
  }

  // Untuk pemakaian di dalam $transaction — memakai client tx yang diberikan
  public static async createPenilaianLogTx(
    tx: any,
    data: CreatePenilaianLogInput
  ) {
    return tx.log.create({
      data: {
        action: data.action,
        actor_type: data.actor_type,
        actor_id: data.actor_id,
        entity_type: LogEntityType.PENILAIAN,
        entity_id: data.id_jadwal,
        context: { id_komponen_penilaian: data.id_komponen_penilaian },
        ...(data.old_nilai !== undefined && data.old_nilai !== null
          ? { old_values: { nilai: data.old_nilai } }
          : {}),
        ...(data.new_nilai !== undefined && data.new_nilai !== null
          ? { new_values: { nilai: data.new_nilai } }
          : {}),
      },
    });
  }

  public static async delete(id: string) {
    await this.get(id);
    await LogRepository.destroy(id);
    return { response: true, message: 'Log berhasil dihapus' };
  }
}
