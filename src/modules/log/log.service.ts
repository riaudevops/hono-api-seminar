import Fuse from 'fuse.js';
import {
  LogActionType,
  LogActorType,
  LogEntityType,
  type Prisma,
} from '@prisma/client';
import { APIError } from '../../utils/api-error.util';
import LogRepository from './log.repository';
import type {
  CreateLogType,
  GetLogParams,
  LogActorContext,
  LogFilter,
} from './log.type';

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
    const page =
      params.page && params.page > 0
        ? params.page
        : params.offset !== undefined
          ? Math.floor(params.offset / limit) + 1
          : 1;
    const offset = (page - 1) * limit;

    const filters: LogFilter = {
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      actor_id: params.actor_id,
      actor_type: params.actor_type,
      action: params.action,
      start_date: params.start_date ? new Date(params.start_date) : undefined,
      end_date: params.end_date ? new Date(params.end_date) : undefined,
    };

    const q = params.q?.trim();

    // Metadata query params — dikembalikan di response getAll sebagai
    // referensi opsi filter untuk konsumer (UI dropdown, dll).
    const queryParamsMeta = {
      filters: {
        entity_type: Object.values(LogEntityType),
        actor_type: Object.values(LogActorType),
        action: Object.values(LogActionType),
      },
      text_filters: {
        entity_id: 'string (id entity terkait, mis. id pendaftaran)',
        actor_id: 'string (NIP / NIM / email pelaku aksi)',
        q: 'string (fuzzy search via Fuse.js: actor_id, entity_id, action, entity_type, actor_type, old_values, new_values, context)',
        start_date: 'ISO 8601 datetime (inclusive)',
        end_date: 'ISO 8601 datetime (inclusive)',
      },
      pagination: {
        page: 'integer >= 1 (default: 1)',
        limit: 'integer 1..100 (default: 50)',
        offset: 'integer >= 0 (legacy, dipakai bila page tidak diisi)',
      },
    };

    // Fast path: tanpa fuzzy search — paginasi di level DB
    if (!q) {
      const [logs, total] = await Promise.all([
        LogRepository.findAll(filters, limit, offset),
        LogRepository.count(filters),
      ]);

      return {
        response: true,
        message: 'Data log berhasil diambil.',
        data: logs,
        pagination: {
          page,
          limit,
          offset,
          total,
          totalPages: Math.ceil(total / limit),
        },
        query_params: queryParamsMeta,
      };
    }

    // Search path: ambil semua yang lolos filter, lalu Fuse.js + slice
    const candidates = await LogRepository.findAll(filters);
    const fuse = new Fuse(candidates, {
      keys: [
        { name: 'actor_id', weight: 0.3 },
        { name: 'entity_id', weight: 0.3 },
        { name: 'action', weight: 0.1 },
        { name: 'entity_type', weight: 0.1 },
        { name: 'actor_type', weight: 0.05 },
        {
          name: 'old_values',
          weight: 0.075,
          getFn: (item) =>
            item.old_values ? JSON.stringify(item.old_values) : '',
        },
        {
          name: 'new_values',
          weight: 0.075,
          getFn: (item) =>
            item.new_values ? JSON.stringify(item.new_values) : '',
        },
        {
          name: 'context',
          weight: 0.05,
          getFn: (item) => (item.context ? JSON.stringify(item.context) : ''),
        },
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: true,
      findAllMatches: true,
    });

    const matched = fuse.search(q).map((r) => r.item);
    const total = matched.length;
    const data = matched.slice(offset, offset + limit);

    return {
      response: true,
      message: 'Data log berhasil diambil.',
      data,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages: Math.ceil(total / limit),
      },
      query_params: queryParamsMeta,
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
    return LogService.createEntityLog({
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
    return LogService.createEntityLog({
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
    return LogService.createEntityLogTx(tx, {
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
    await LogService.get(id);
    await LogRepository.destroy(id);
    return { response: true, message: 'Log berhasil dihapus.' };
  }
}
