import { LogActionType, LogActorType, Prisma } from '@prisma/client';
import LogPenilaianRepository from '../repositories/log-penilaian.repository';
import { APIError } from '../utils/api-error.util';

export interface LogPenilaianFilter {
  id_jadwal?: string;
  id_komponen_penilaian?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
}

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

export default class LogPenilaianService {
  public static async getAll(filters?: LogPenilaianFilter) {
    const logs = filters
      ? await LogPenilaianRepository.findByFilters(filters)
      : await LogPenilaianRepository.findAll();

    return {
      response: true,
      message: 'Data log penilaian berhasil diambil',
      data: logs,
    };
  }

  public static async get(id: string) {
    const log = await LogPenilaianRepository.findById(id);
    if (!log) {
      throw new APIError('Log penilaian tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Detail log penilaian berhasil diambil',
      data: log,
    };
  }

  public static async create(data: CreateLogPenilaianInput) {
    const log = await LogPenilaianRepository.create(data);

    return {
      response: true,
      message: 'Log penilaian berhasil ditambahkan',
      data: log,
    };
  }

  public static async createWithTransaction(
    tx: any,
    data: CreateLogPenilaianInput
  ) {
    return tx.log_penilaian.create({
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
    await this.get(id);

    const updated = await LogPenilaianRepository.update(id, data);

    return {
      response: true,
      message: 'Log penilaian berhasil diperbarui',
      data: updated,
    };
  }

  public static async delete(id: string) {
    await this.get(id);

    await LogPenilaianRepository.destroy(id);

    return {
      response: true,
      message: 'Log penilaian berhasil dihapus',
    };
  }
}
