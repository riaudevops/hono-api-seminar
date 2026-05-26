import { DosenModuleRepository as DosenRepository } from '../dosen';
import ConstraintDosenRepository from './constraint-dosen.repository';
import { APIError } from '../../utils/api-error.util';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import {
  type ConstraintType,
  LogActionType,
  LogActorType,
  LogEntityType,
  type Prisma,
} from '@prisma/client';
import { LogService } from '../log';
import openRouterService from '../../infrastructures/openrouter.infrastructure';
import { textMessage } from '../../utils/openrouter.util';
import {
  ParseConstraintOutputSchema,
  type ParsedConstraint,
} from '../../prompts/output/constraint-schema';
import { createLogger } from '../../utils/logger.util';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  CreateConstraintType,
  UpdateConstraintType,
} from './constraint-dosen.type';

const logger = createLogger('ConstraintDosenService');

const PARSE_CONSTRAINT_PROMPT = readFileSync(
  join(process.cwd(), 'src/prompts/tasks/parse-constraint.md'),
  'utf-8'
);

type ConstraintChatProgressEmitter = (
  event: string,
  payload: Record<string, unknown>
) => Promise<void> | void;

export default class ConstraintDosenService {
  private static async getNipFromEmail(email: string): Promise<string> {
    const dosen = await DosenRepository.findByEmail(email);
    if (!dosen) {
      throw new APIError('Data dosen tidak ditemukan untuk email ini.', 404);
    }
    return dosen.nip;
  }

  public static async getAll(email: string) {
    const nip = await ConstraintDosenService.getNipFromEmail(email);
    const constraints = await ConstraintDosenRepository.findByNip(nip);

    return {
      response: true,
      message: 'Data constraint berhasil diambil',
      data: constraints,
    };
  }

  public static async get(email: string, id: string) {
    const nip = await ConstraintDosenService.getNipFromEmail(email);
    const constraint = await ConstraintDosenRepository.findById(id);
    if (!constraint) {
      throw new APIError('Constraint tidak ditemukan', 404);
    }
    if (constraint.nip !== nip) {
      throw new APIError('Anda tidak memiliki akses ke constraint ini', 403);
    }

    return {
      response: true,
      message: 'Data constraint berhasil diambil',
      data: constraint,
    };
  }

  public static async create(email: string, data: CreateConstraintType) {
    const nip = await ConstraintDosenService.getNipFromEmail(email);

    const createInput: Prisma.constraint_dosenCreateInput = {
      type: data.type,
      hari: data.hari,
      waktu_mulai: data.waktu_mulai ? new Date(data.waktu_mulai) : undefined,
      waktu_selesai: data.waktu_selesai
        ? new Date(data.waktu_selesai)
        : undefined,
      keterangan: data.keterangan,
      priority: data.priority,
      raw_data: data.raw_data as Prisma.InputJsonValue,
      dosen: { connect: { nip } },
    };

    const constraint = await ConstraintDosenRepository.create(createInput);
    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.DOSEN,
      actor_id: nip,
      entity_type: LogEntityType.CONSTRAINT_DOSEN,
      entity_id: constraint.id,
      new_values: constraint,
    });
    await CacheInvalidation.invalidateConstraint();

    return {
      response: true,
      message: 'Constraint berhasil ditambahkan',
      data: constraint,
    };
  }

  public static async update(
    email: string,
    id: string,
    data: UpdateConstraintType
  ) {
    const nip = await ConstraintDosenService.getNipFromEmail(email);

    const existing = await ConstraintDosenRepository.findById(id);
    if (!existing) {
      throw new APIError('Constraint tidak ditemukan', 404);
    }
    if (existing.nip !== nip) {
      throw new APIError(
        'Anda tidak memiliki akses untuk mengubah constraint ini',
        403
      );
    }

    const updateInput: Prisma.constraint_dosenUncheckedUpdateInput = {};

    if (data.type !== undefined) updateInput.type = data.type;
    if (data.hari !== undefined) updateInput.hari = data.hari;
    if (data.waktu_mulai !== undefined) {
      updateInput.waktu_mulai = data.waktu_mulai
        ? new Date(data.waktu_mulai)
        : null;
    }
    if (data.waktu_selesai !== undefined) {
      updateInput.waktu_selesai = data.waktu_selesai
        ? new Date(data.waktu_selesai)
        : null;
    }
    if (data.keterangan !== undefined) updateInput.keterangan = data.keterangan;
    if (data.priority !== undefined) updateInput.priority = data.priority;
    if (data.is_active !== undefined) updateInput.is_active = data.is_active;
    if (data.raw_data !== undefined) {
      updateInput.raw_data = data.raw_data as Prisma.InputJsonValue;
    }

    const constraint = await ConstraintDosenRepository.update(id, updateInput);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.DOSEN,
      actor_id: nip,
      entity_type: LogEntityType.CONSTRAINT_DOSEN,
      entity_id: id,
      old_values: existing,
      new_values: constraint,
    });
    await CacheInvalidation.invalidateConstraint();

    return {
      response: true,
      message: 'Constraint berhasil diperbarui',
      data: constraint,
    };
  }

  public static async delete(email: string, id: string) {
    const nip = await ConstraintDosenService.getNipFromEmail(email);

    const existing = await ConstraintDosenRepository.findById(id);
    if (!existing) {
      throw new APIError('Constraint tidak ditemukan', 404);
    }
    if (existing.nip !== nip) {
      throw new APIError(
        'Anda tidak memiliki akses untuk menghapus constraint ini',
        403
      );
    }

    await ConstraintDosenRepository.destroy(id);
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.DOSEN,
      actor_id: nip,
      entity_type: LogEntityType.CONSTRAINT_DOSEN,
      entity_id: id,
      old_values: existing,
    });
    await CacheInvalidation.invalidateConstraint();

    return {
      response: true,
      message: 'Constraint berhasil dihapus',
    };
  }

  public static async chat(
    email: string,
    message: string,
    emit?: ConstraintChatProgressEmitter,
    signal?: AbortSignal
  ) {
    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new APIError(
          'Proses chat constraint dibatalkan oleh client',
          499
        );
      }
    };
    const sendProgress = async (
      event: string,
      payload: Record<string, unknown>
    ) => {
      throwIfAborted();
      if (emit) await emit(event, payload);
    };

    const nip = await ConstraintDosenService.getNipFromEmail(email);

    logger.info('Parsing constraint from chat', { nip, message });
    await sendProgress('parsing', {
      message: 'AI sedang memproses pesan constraint',
    });

    const parsed = await ConstraintDosenService.parseMessageWithAI(
      message,
      signal
    );

    await sendProgress('parsed', {
      count: parsed.length,
      message: `${parsed.length} constraint berhasil dipahami dari pesan`,
    });
    await sendProgress('saving', {
      count: parsed.length,
      message: 'Menyimpan constraint',
    });

    const created = await Promise.all(
      parsed.map((c: ParsedConstraint) =>
        ConstraintDosenRepository.create({
          type: c.type as ConstraintType,
          hari: c.hari ?? undefined,
          waktu_mulai: c.waktu_mulai ? new Date(c.waktu_mulai) : undefined,
          waktu_selesai: c.waktu_selesai
            ? new Date(c.waktu_selesai)
            : undefined,
          keterangan: c.keterangan ?? undefined,
          priority: c.priority ?? 1,
          raw_data: {
            original_message: message,
          } as unknown as Prisma.InputJsonValue,
          dosen: { connect: { nip } },
        })
      )
    );

    await Promise.all(
      created.map((constraint) =>
        LogService.createEntityLog({
          action: LogActionType.CREATE,
          actor_type: LogActorType.DOSEN,
          actor_id: nip,
          entity_type: LogEntityType.CONSTRAINT_DOSEN,
          entity_id: constraint.id,
          new_values: constraint,
        })
      )
    );
    await CacheInvalidation.invalidateConstraint();

    const responseData = {
      response: true,
      message: `${created.length} constraint berhasil ditambahkan`,
      data: {
        pesan: message,
        constraints: created,
      },
    };

    await sendProgress('done', responseData);
    return responseData;
  }

  // ===========================================================================
  // Chat-update: parse pesan natural-language, lalu apply hasil parsing
  // pertama sebagai update terhadap constraint dengan id yang diberikan.
  // ===========================================================================
  public static async chatUpdate(
    email: string,
    id: string,
    message: string,
    emit?: ConstraintChatProgressEmitter,
    signal?: AbortSignal
  ) {
    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new APIError(
          'Proses update constraint dibatalkan oleh client',
          499
        );
      }
    };
    const sendProgress = async (
      event: string,
      payload: Record<string, unknown>
    ) => {
      throwIfAborted();
      if (emit) await emit(event, payload);
    };

    const nip = await ConstraintDosenService.getNipFromEmail(email);

    const existing = await ConstraintDosenRepository.findById(id);
    if (!existing) {
      throw new APIError('Constraint tidak ditemukan', 404);
    }
    if (existing.nip !== nip) {
      throw new APIError(
        'Anda tidak memiliki akses untuk mengubah constraint ini',
        403
      );
    }

    logger.info('Parsing constraint update from chat', { nip, id, message });
    await sendProgress('parsing', {
      id,
      message: 'AI sedang memproses pesan update constraint',
    });

    const parsed = await ConstraintDosenService.parseMessageWithAI(
      message,
      signal
    );

    await sendProgress('parsed', {
      count: parsed.length,
      message: `${parsed.length} constraint berhasil dipahami dari pesan`,
    });
    const first = parsed[0];
    if (!first) {
      throw new APIError(
        'AI tidak menemukan perubahan constraint dari pesan Anda. Mohon perjelas pesan.',
        422
      );
    }
    if (parsed.length > 1) {
      logger.warn(
        'AI mengembalikan lebih dari satu constraint untuk update; hanya yang pertama dipakai',
        { id, total: parsed.length }
      );
    }

    // Bangun payload update — hanya field yang non-undefined hasil parsing AI
    // yang akan menimpa nilai existing. Field yang AI kembalikan null di-treat
    // sebagai "reset ke null" (mirror perilaku PUT biasa di method update()).
    const updateInput: Prisma.constraint_dosenUncheckedUpdateInput = {};
    updateInput.type = first.type as ConstraintType;
    updateInput.hari = first.hari;
    updateInput.waktu_mulai = first.waktu_mulai
      ? new Date(first.waktu_mulai)
      : null;
    updateInput.waktu_selesai = first.waktu_selesai
      ? new Date(first.waktu_selesai)
      : null;
    updateInput.keterangan = first.keterangan ?? null;
    if (first.priority !== undefined && first.priority !== null) {
      updateInput.priority = first.priority;
    }
    updateInput.raw_data = {
      original_message: message,
    } as unknown as Prisma.InputJsonValue;

    await sendProgress('saving', {
      id,
      message: 'Menyimpan perubahan constraint',
    });

    const constraint = await ConstraintDosenRepository.update(id, updateInput);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.DOSEN,
      actor_id: nip,
      entity_type: LogEntityType.CONSTRAINT_DOSEN,
      entity_id: id,
      old_values: existing,
      new_values: constraint,
      context: { source: 'chat', original_message: message },
    });
    await CacheInvalidation.invalidateConstraint();

    const responseData = {
      response: true,
      message: 'Constraint berhasil diperbarui dari pesan',
      data: {
        pesan: message,
        constraint,
        ignored_extra: parsed.length > 1 ? parsed.slice(1) : undefined,
      },
    };

    await sendProgress('done', responseData);
    return responseData;
  }

  // ===========================================================================
  // Helper: kirim pesan ke OpenRouter dan kembalikan array ParsedConstraint
  // tervalidasi schema. Dipakai oleh chat() (create batch) dan chatUpdate().
  // ===========================================================================
  private static async parseMessageWithAI(
    message: string,
    signal?: AbortSignal
  ): Promise<ParsedConstraint[]> {
    if (signal?.aborted) {
      throw new APIError('Proses chat constraint dibatalkan oleh client', 499);
    }

    const response = await openRouterService.chatCompletion({
      messages: [
        textMessage('system', PARSE_CONSTRAINT_PROMPT),
        textMessage('user', message),
      ],
      temperature: 0.3,
      maxTokens: 2048,
      provider: { sort: 'latency' },
    });

    if (signal?.aborted) {
      throw new APIError('Proses chat constraint dibatalkan oleh client', 499);
    }

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new APIError(
        'AI tidak dapat memproses pesan Anda. Silakan coba lagi.',
        502
      );
    }

    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      rawContent,
    ];
    const jsonStr = jsonMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error('Failed to parse AI JSON output', { rawContent });
      throw new APIError(
        'AI mengembalikan format yang tidak valid. Silakan coba lagi.',
        502
      );
    }

    const wrapped = Array.isArray(parsed) ? { constraints: parsed } : parsed;
    const result = ParseConstraintOutputSchema.safeParse(wrapped);

    if (!result.success) {
      logger.error('AI output validation failed', {
        errors: result.error.issues,
      });
      throw new APIError(
        'AI mengembalikan data yang tidak valid. Silakan coba lagi.',
        502
      );
    }

    return result.data.constraints;
  }
}
