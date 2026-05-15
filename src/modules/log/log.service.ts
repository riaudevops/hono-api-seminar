import {
  LogActionType,
  LogActorType,
  LogEntityType,
  Prisma,
} from '@prisma/client';
import { APIError } from '../../utils/api-error.util';
import LogRepository from './log.repository';
import { CreateLogType, GetLogParams, LogActorContext, LogFilter } from './log.type';

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
  public static getActorContext(user?: {
    id?: string;
    email?: string;
    role?: string;
    nip?: string;
    nim?: string;
  }): LogActorContext {
    const role = user?.role?.toLowerCase();
    const actor_type =
      role === 'dosen'
        ? LogActorType.DOSEN
        : role === 'mahasiswa'
          ? LogActorType.MAHASISWA
          : LogActorType.KOORDINATOR;

    return {
      actor_type,
      actor_id: user?.id ?? user?.nip ?? user?.nim ?? user?.email ?? 'unknown',
    };
  }

  public static async getAll(params: GetLogParams = {}) {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const filters: LogFilter = {
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      actor_id: params.actor_id,
      actor_type: params.actor_type,
      action: params.action,
      start_date: params.start_date ? new Date(params.start_date) : undefined,
      end_date: params.end_date ? new Date(params.end_date) : undefined,
    };
    const [logs, total] = await Promise.all([
      LogRepository.findAll(filters, limit, offset),
      LogRepository.count(filters),
    ]);

    return {
      response: true,
      message: 'Data log berhasil diambil.',
      data: logs,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public static async get(id: string) {
    const log = await LogRepository.findById(id);
    if (!log) throw new APIError('Log tidak ditemukan.', 404);
    return {
      response: true,
      message: 'Detail log berhasil diambil.',
      data: log,
    };
  }

  public static async create(data: CreateLogType) {
    const log = await LogRepository.create(data);
    return {
      response: true,
      message: 'Log berhasil ditambahkan.',
      data: log,
    };
  }

  public static async createEntityLog(data: CreateLogType) {
    return LogRepository.create(data);
  }

  public static async createEntityLogTx(tx: any, data: CreateLogType) {
    return tx.log.create({ data });
  }

  public static async createJadwalLog(data: CreateJadwalLogInput) {
    return this.createEntityLog({
      action: data.action,
      actor_type: data.actor_type,
      actor_id: data.actor_id,
      entity_type: LogEntityType.JADWAL,
      entity_id: data.jadwal_id,
      ...(data.old_values !== undefined ? { old_values: data.old_values } : {}),
      ...(data.new_values !== undefined ? { new_values: data.new_values } : {}),
    });
  }

  public static async createPenilaianLog(data: CreatePenilaianLogInput) {
    return this.createEntityLog({
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

  public static async createPenilaianLogTx(
    tx: any,
    data: CreatePenilaianLogInput
  ) {
    return this.createEntityLogTx(tx, {
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

  public static async delete(id: string) {
    await this.get(id);
    await LogRepository.destroy(id);
    return { response: true, message: 'Log berhasil dihapus.' };
  }
}
