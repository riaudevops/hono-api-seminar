import DosenRepository from '../repositories/dosen.repository';
import ConstraintDosenRepository from '../repositories/constraint-dosen.repository';
import { APIError } from '../utils/api-error.util';
import { ConstraintType, LogActionType, LogActorType, LogEntityType, Prisma } from '@prisma/client';
import { LogService } from '../modules/log';
import openRouterService from '../infrastructures/openrouter.infrastructure';
import { textMessage } from '../utils/openrouter.util';
import { ParseConstraintOutputSchema, ParsedConstraint } from '../prompts/output/constraint-schema';
import { createLogger } from '../utils/logger.util';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CreateConstraintType {
  type: ConstraintType;
  hari?: number;
  waktu_mulai?: string;
  waktu_selesai?: string;
  keterangan?: string;
  priority?: number;
  raw_data?: Record<string, unknown>;
}

export interface UpdateConstraintType {
  type?: ConstraintType;
  hari?: number | null;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  keterangan?: string | null;
  priority?: number;
  is_active?: boolean;
  raw_data?: Record<string, unknown> | null;
}

const logger = createLogger('ConstraintDosenService');

const PARSE_CONSTRAINT_PROMPT = readFileSync(
  join(process.cwd(), 'src/prompts/tasks/parse-constraint.md'),
  'utf-8'
);

export default class ConstraintDosenService {
  private static async getNipFromEmail(email: string): Promise<string> {
    const dosen = await DosenRepository.findByEmail(email);
    if (!dosen) {
      throw new APIError('Data dosen tidak ditemukan untuk email ini.', 404);
    }
    return dosen.nip;
  }

  public static async getAll(email: string) {
    const nip = await this.getNipFromEmail(email);
    const constraints = await ConstraintDosenRepository.findByNip(nip);

    return {
      response: true,
      message: 'Data constraint berhasil diambil',
      data: constraints,
    };
  }

  public static async get(email: string, id: string) {
    const nip = await this.getNipFromEmail(email);
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
    const nip = await this.getNipFromEmail(email);

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
    const nip = await this.getNipFromEmail(email);

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
    if (data.raw_data !== undefined)
      updateInput.raw_data = data.raw_data as Prisma.InputJsonValue;

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

    return {
      response: true,
      message: 'Constraint berhasil diperbarui',
      data: constraint,
    };
  }

  public static async delete(email: string, id: string) {
    const nip = await this.getNipFromEmail(email);

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

    return {
      response: true,
      message: 'Constraint berhasil dihapus',
    };
  }

  public static async chat(email: string, message: string) {
    const nip = await this.getNipFromEmail(email);

    logger.info('Parsing constraint from chat', { nip, message });

    const response = await openRouterService.chatCompletion({
      messages: [
        textMessage('system', PARSE_CONSTRAINT_PROMPT),
        textMessage('user', message),
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new APIError('AI tidak dapat memproses pesan Anda. Silakan coba lagi.', 502);
    }

    // Extract JSON from AI response (handle markdown code blocks)
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
    const jsonStr = jsonMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error('Failed to parse AI JSON output', { rawContent });
      throw new APIError('AI mengembalikan format yang tidak valid. Silakan coba lagi.', 502);
    }

    // Validate with Zod — support both { constraints: [...] } and direct [...]
    const wrapped = Array.isArray(parsed) ? { constraints: parsed } : parsed;
    const result = ParseConstraintOutputSchema.safeParse(wrapped);

    if (!result.success) {
      logger.error('AI output validation failed', { errors: result.error.issues });
      throw new APIError('AI mengembalikan data yang tidak valid. Silakan coba lagi.', 502);
    }

    // Create all parsed constraints in the database
    const created = await Promise.all(
      result.data.constraints.map((c: ParsedConstraint) =>
        ConstraintDosenRepository.create({
          type: c.type as ConstraintType,
          hari: c.hari ?? undefined,
          waktu_mulai: c.waktu_mulai ? new Date(c.waktu_mulai) : undefined,
          waktu_selesai: c.waktu_selesai ? new Date(c.waktu_selesai) : undefined,
          keterangan: c.keterangan ?? undefined,
          priority: c.priority ?? 1,
          raw_data: { original_message: message } as unknown as Prisma.InputJsonValue,
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

    return {
      response: true,
      message: `${created.length} constraint berhasil ditambahkan`,
      data: {
        pesan: message,
        constraints: created,
      },
    };
  }
}
