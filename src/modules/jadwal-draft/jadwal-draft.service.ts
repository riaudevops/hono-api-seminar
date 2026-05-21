import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LogActionType, LogActorType, LogEntityType, StatusJadwalDraft } from '@prisma/client';
import { APIError } from '../../utils/api-error.util';
import { createLogger } from '../../utils/logger.util';
import { textMessage } from '../../utils/openrouter.util';
import openRouterService from '../../infrastructures/openrouter.infrastructure';
import prisma from '../../infrastructures/db.infrastructure';
import { GenerateBatchOutputSchema } from '../../prompts/output/schedule-schema';
import { getScheduleRulesAsText } from '../../prompts/context/schedule-rules';
import JadwalDraftRepository from './jadwal-draft.repository';
import { JadwalRepository, JadwalService } from '../jadwal';
import RuanganRepository from '../ruangan/ruangan.repository';
import ConstraintDosenRepository from '../../repositories/constraint-dosen.repository';
import PenilaianRepository from '../../repositories/penilaian.repository';
import { LogService } from '../../modules/log';
import JadwalHelper from '../../helpers/jadwal.helper';
import JenisSeminarHelper from '../../helpers/jenis-seminar.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import { LogJadwalContext } from '../jadwal';
import {
  CreateJadwalDraftInput,
  UpdateDraftInput,
} from './jadwal-draft.type';

const logger = createLogger('JadwalDraftService');
const GENERATE_CHUNK_SIZE = 10;

type GenerateProgressEmitter = (
  event: string,
  payload: Record<string, unknown>
) => Promise<void> | void;

const PERSONA_PROMPT = readFileSync(
  join(process.cwd(), 'src/prompts/base/scheduler-persona.md'),
  'utf-8'
);

const BATCH_TASK_PROMPT = readFileSync(
  join(process.cwd(), 'src/prompts/tasks/generate-batch-schedule.md'),
  'utf-8'
);

function generateBatchId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(2).toString('hex');
  return `BATCH-${dateStr}-${random}`;
}

export default class JadwalDraftService {
  public static async generate(
    data: {
      tanggal_mulai: Date;
      list_mahasiswa: Array<{
        nim: string;
        kode_jenis: string;
        list_dosen: { nip: string; role: any }[];
      }>;
      tanggal_dikecualikan?: string[];
      catatan_tambahan?: string;
    },
    context: LogJadwalContext,
    emit?: GenerateProgressEmitter,
    signal?: AbortSignal
  ) {
    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new APIError('Generate jadwal dibatalkan oleh client', 499);
      }
    };

    const sendProgress = async (
      event: string,
      payload: Record<string, unknown>
    ) => {
      throwIfAborted();
      if (emit) await emit(event, payload);
    };

    throwIfAborted();
    const batchId = generateBatchId();
    await sendProgress('batch:start', {
      batch_id: batchId,
      message: 'Batch generate jadwal draft dimulai',
    });

    // Resolve kode_jenis → id_jenis_seminar sekali di depan
    await sendProgress('jenis:resolving', {
      message: 'Mencocokkan jenis seminar',
    });
    const kodeSet = new Set<string>();
    for (const mhs of data.list_mahasiswa) kodeSet.add(mhs.kode_jenis);
    const kodeToId = new Map<string, string>();
    for (const kode of kodeSet) {
      kodeToId.set(kode, await JenisSeminarHelper.resolveIdByKode(kode));
    }

    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    // Validate mahasiswa + dosen + cek existing jadwal
    const allNips = new Set<string>();
    for (const [index, mhs] of data.list_mahasiswa.entries()) {
      await sendProgress('validating', {
        current: index + 1,
        total: data.list_mahasiswa.length,
        nim: mhs.nim,
        message: `Memvalidasi mahasiswa ${mhs.nim}`,
      });
      await JadwalService.validateMahasiswa(mhs.nim);

      const idJenis = kodeToId.get(mhs.kode_jenis)!;
      const existing = await JadwalRepository.existsByMahasiswaAndJenis(
        mhs.nim,
        idJenis,
        kode_tahun_ajaran
      );
      if (existing) {
        throw new APIError(
          `Mahasiswa ${mhs.nim} sudah memiliki jadwal untuk jenis ${mhs.kode_jenis}`,
          400
        );
      }

      for (const d of mhs.list_dosen) {
        await JadwalService.validateDosen(d.nip, d.role);
        allNips.add(d.nip);
      }
    }

    const tanggalMulai = new Date(data.tanggal_mulai);
    const endDate = new Date(tanggalMulai);
    endDate.setDate(endDate.getDate() + 30);

    await sendProgress('context:loading', {
      message: 'Mengambil data ruangan, jadwal existing, dan constraint dosen',
    });

    const [ruanganList, existingJadwal] = await Promise.all([
      RuanganRepository.findAktif(),
      JadwalRepository.findBlockingSchedulesForGeneration(tanggalMulai, endDate),
    ]);

    logger.info('Generating batch schedule', {
      batchId,
      mahasiswaCount: data.list_mahasiswa.length,
    });

    const baseBlockingSchedules = this.formatExistingJadwalForAi(
      existingJadwal as any[]
    );
    const sortedMahasiswa = this.sortMahasiswaForScheduling(data.list_mahasiswa);
    const mahasiswaChunks = this.chunkMahasiswa(
      sortedMahasiswa,
      GENERATE_CHUNK_SIZE
    );
    const drafts: CreateJadwalDraftInput[] = [];
    const generatedBlockingSchedules: any[] = [];

    await sendProgress('chunks:start', {
      batch_id: batchId,
      total_chunks: mahasiswaChunks.length,
      chunk_size: GENERATE_CHUNK_SIZE,
      total_mahasiswa: data.list_mahasiswa.length,
      message: `Generate akan diproses dalam ${mahasiswaChunks.length} chunk`,
    });

    for (const [chunkIndex, mahasiswaChunk] of mahasiswaChunks.entries()) {
      const currentChunk = chunkIndex + 1;
      await sendProgress('chunk:start', {
        batch_id: batchId,
        chunk: currentChunk,
        total_chunks: mahasiswaChunks.length,
        mahasiswa_count: mahasiswaChunk.length,
        message: `Memproses chunk ${currentChunk}/${mahasiswaChunks.length}`,
      });

      const chunkNips = new Set<string>();
      for (const mhs of mahasiswaChunk) {
        for (const dosen of mhs.list_dosen) chunkNips.add(dosen.nip);
      }
      const constraintList = await this.getConstraintsForNips([...chunkNips]);
      const contextData = this.buildChunkContextData({
        tanggalMulai,
        mahasiswaChunk,
        ruanganList,
        baseBlockingSchedules,
        generatedBlockingSchedules,
        constraintList,
        tanggalDikecualikan: data.tanggal_dikecualikan,
        catatanTambahan: data.catatan_tambahan,
      });

      await sendProgress('ai:generating', {
        batch_id: batchId,
        chunk: currentChunk,
        total_chunks: mahasiswaChunks.length,
        message: `AI sedang menyusun jadwal draft chunk ${currentChunk}/${mahasiswaChunks.length}`,
      });

      logger.info('AI request started', {
        batchId,
        chunk: currentChunk,
        totalChunks: mahasiswaChunks.length,
      });

      const result = await this.generateChunkSuggestions(
        contextData,
        {
          batchId,
          chunk: currentChunk,
          totalChunks: mahasiswaChunks.length,
        },
        signal
      );

      logger.info('AI response received', {
        batchId,
        chunk: currentChunk,
        totalChunks: mahasiswaChunks.length,
      });

      throwIfAborted();

      await sendProgress('ai:parsing', {
        batch_id: batchId,
        chunk: currentChunk,
        total_chunks: mahasiswaChunks.length,
        message: `Memproses hasil generate AI chunk ${currentChunk}/${mahasiswaChunks.length}`,
      });

      this.validateChunkSuggestionsCoverage(
        result.suggestions,
        mahasiswaChunk
      );
      this.validateExcludedDates(
        result.suggestions,
        data.tanggal_dikecualikan || []
      );

      const chunkDrafts = await this.mapSuggestionsToDrafts({
        suggestions: result.suggestions,
        mahasiswaChunk,
        kodeToId,
        batchId,
      });

      this.validateGeneratedDraftsHardConstraints({
        drafts: chunkDrafts,
        existingBlockingSchedules: [
          ...baseBlockingSchedules,
          ...generatedBlockingSchedules,
        ],
        activeRoomCodes: new Set(ruanganList.map((r: any) => r.kode)),
        excludedDates: data.tanggal_dikecualikan || [],
        tanggalMulai,
        endDate,
      });

      drafts.push(...chunkDrafts);
      generatedBlockingSchedules.push(
        ...chunkDrafts.map((draft) => this.formatGeneratedDraftForAi(draft))
      );

      await sendProgress('chunk:done', {
        batch_id: batchId,
        chunk: currentChunk,
        total_chunks: mahasiswaChunks.length,
        generated_count: chunkDrafts.length,
        total_generated: drafts.length,
        message: `Chunk ${currentChunk}/${mahasiswaChunks.length} selesai`,
      });
    }

    throwIfAborted();

    if (drafts.length === 0) {
      throw new APIError(
        'Tidak ditemukan slot yang tersedia untuk periode yang diminta.',
        404
      );
    }

    this.validateGeneratedDraftsNoObviousConflicts(drafts);

    await sendProgress('saving', {
      count: drafts.length,
      message: 'Menyimpan jadwal draft',
    });

    throwIfAborted();

    await JadwalDraftRepository.createMany(drafts);

    const savedDrafts = await JadwalDraftRepository.findByBatchId(batchId);
    await Promise.all(
      savedDrafts.map((draft) =>
        LogService.createEntityLog({
          action: LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL_DRAFT,
          entity_id: draft.id,
          new_values: draft,
        })
      )
    );

    logger.info('Batch schedule generated', {
      batchId,
      draftCount: savedDrafts.length,
    });

    logger.info('Sending stream done event', {
      batchId,
      draftCount: savedDrafts.length,
    });

    const responseData = {
      response: true,
      message: `${savedDrafts.length} jadwal draft berhasil di-generate`,
      data: {
        batch_id: batchId,
        drafts: savedDrafts.map((d) => this.formatDraftResponse(d)),
      },
    };

    await sendProgress('done', responseData);

    return responseData;
  }

  public static async getDrafts(filters?: {
    batch_id?: string;
    status?: StatusJadwalDraft;
  }) {
    const drafts = await JadwalDraftRepository.findAll(filters);

    return {
      response: true,
      message: 'Data draft jadwal berhasil diambil',
      data: drafts.map((d) => this.formatDraftResponse(d)),
    };
  }

  public static async getDraftsByBatch(batch_id: string) {
    const drafts = await JadwalDraftRepository.findByBatchId(batch_id);
    if (!drafts || drafts.length === 0) {
      throw new APIError('Batch draft tidak ditemukan', 404);
    }

    const mahasiswaList = await prisma.mahasiswa.findMany({
      where: { nim: { in: drafts.map((draft) => draft.nim) } },
      select: { nim: true, nama: true },
    });
    const mahasiswaByNim = new Map(
      mahasiswaList.map((mahasiswa) => [mahasiswa.nim, mahasiswa])
    );

    return {
      response: true,
      message: 'Data draft jadwal berhasil diambil',
      data: drafts.map((d) => {
        const mahasiswa = mahasiswaByNim.get(d.nim) ?? null;
        return this.formatDraftResponse({
          ...d,
          nama: mahasiswa?.nama ?? null,
        });
      }),
    };
  }

  public static async updateDraft(
    id: string,
    data: UpdateDraftInput,
    context: LogJadwalContext
  ) {
    const draft = await JadwalDraftRepository.findById(id);
    if (!draft) {
      throw new APIError('Draft tidak ditemukan', 404);
    }
    if (draft.status !== StatusJadwalDraft.DRAFT) {
      throw new APIError('Draft sudah diproses dan tidak dapat diubah', 400);
    }

    const updateData: any = {};

    if (data.tanggal) {
      updateData.tanggal = JadwalHelper.convertFromJakartaTimezone(
        new Date(data.tanggal)
      );
    }
    if (data.waktu_mulai) {
      updateData.waktu_mulai = JadwalHelper.convertFromJakartaTimezone(
        new Date(data.waktu_mulai)
      );
    }
    if (data.waktu_selesai) {
      updateData.waktu_selesai = JadwalHelper.convertFromJakartaTimezone(
        new Date(data.waktu_selesai)
      );
    }
    if (data.kode_ruangan) {
      await JadwalService.validateRuangan(data.kode_ruangan);
      updateData.kode_ruangan = data.kode_ruangan;
    }

    if (updateData.waktu_mulai || updateData.waktu_selesai) {
      const mulai = updateData.waktu_mulai || draft.waktu_mulai;
      const selesai = updateData.waktu_selesai || draft.waktu_selesai;
      const kodeRuangan = updateData.kode_ruangan || draft.kode_ruangan;

      await RuanganHelper.cekKonflik(kodeRuangan, mulai, selesai);

      const listDosen = draft.list_dosen as { nip: string }[];
      if (listDosen && listDosen.length > 0) {
        await DosenHelper.cekKonflik(
          listDosen.map((d) => d.nip),
          mulai,
          selesai
        );
      }
    }

    const updated = await JadwalDraftRepository.update(id, updateData);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: context.actor_type,
      actor_id: context.actor_id,
      entity_type: LogEntityType.JADWAL_DRAFT,
      entity_id: id,
      old_values: draft,
      new_values: updated,
    });

    return {
      response: true,
      message: 'Draft berhasil diperbarui',
      data: this.formatDraftResponse(updated),
    };
  }

  public static async approveBatch(
    batch_id: string,
    context: LogJadwalContext
  ) {
    const drafts = await JadwalDraftRepository.findByBatchId(
      batch_id,
      StatusJadwalDraft.DRAFT
    );
    if (!drafts || drafts.length === 0) {
      throw new APIError(
        'Tidak ada draft dengan status DRAFT pada batch ini',
        404
      );
    }

    const approved: any[] = [];
    const errors: any[] = [];

    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    await prisma.$transaction(async (tx) => {
      for (const draft of drafts) {
        try {
          await JadwalService.validateMahasiswa(draft.nim);

          const exists = await JadwalRepository.existsByMahasiswaAndJenis(
            draft.nim,
            draft.id_jenis_seminar,
            kode_tahun_ajaran
          );
          if (exists) {
            const kode = await JenisSeminarHelper.resolveKodeById(
              draft.id_jenis_seminar
            );
            errors.push({
              draft_id: draft.id,
              nim: draft.nim,
              error: `Mahasiswa ${draft.nim} sudah memiliki jadwal untuk jenis ${kode}`,
            });
            continue;
          }

          await JadwalService.validateRuangan(draft.kode_ruangan);

          await RuanganHelper.cekKonflik(
            draft.kode_ruangan,
            draft.waktu_mulai,
            draft.waktu_selesai
          );

          const listDosen = draft.list_dosen as { nip: string }[];
          if (listDosen && listDosen.length > 0) {
            await DosenHelper.cekKonflik(
              listDosen.map((d) => d.nip),
              draft.waktu_mulai,
              draft.waktu_selesai
            );
          }

          const kode = await JenisSeminarHelper.resolveKodeById(
            draft.id_jenis_seminar
          );
          const id = await JadwalHelper.generateId(kode);

          const jadwal = await tx.jadwal.create({
            data: {
              id,
              tanggal: draft.tanggal,
              waktu_mulai: draft.waktu_mulai,
              waktu_selesai: draft.waktu_selesai,
              id_jenis_seminar: draft.id_jenis_seminar,
              nim: draft.nim,
              kode_ruangan: draft.kode_ruangan,
              kode_tahun_ajaran,
            },
          });

          if (listDosen && listDosen.length > 0) {
            for (const d of listDosen) {
              await tx.penilaian.create({
                data: {
                  id_jadwal: id,
                  nip: d.nip,
                  role: (d as any).role,
                },
              });
            }
          }

          const jadwalWithTimezone = {
            ...jadwal,
            waktu_mulai: JadwalHelper.convertToJakartaTimezone(
              jadwal.waktu_mulai
            ),
            waktu_selesai: JadwalHelper.convertToJakartaTimezone(
              jadwal.waktu_selesai
            ),
          };

          await tx.log.create({
            data: {
              action: LogActionType.CREATE,
              actor_type: LogActorType.KOORDINATOR,
              actor_id: context.actor_id,
              entity_type: 'JADWAL',
              entity_id: id,
              new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
            },
          });

          const updatedDraft = await tx.jadwal_draft.update({
            where: { id: draft.id },
            data: { status: StatusJadwalDraft.APPROVED },
          });

          await LogService.createEntityLogTx(tx, {
            action: LogActionType.UPDATE,
            actor_type: context.actor_type,
            actor_id: context.actor_id,
            entity_type: LogEntityType.JADWAL_DRAFT,
            entity_id: draft.id,
            old_values: draft,
            new_values: updatedDraft,
          });

          approved.push({
            draft_id: draft.id,
            jadwal_id: id,
            nim: draft.nim,
            id_jenis_seminar: draft.id_jenis_seminar,
          });
        } catch (err: any) {
          errors.push({
            draft_id: draft.id,
            nim: draft.nim,
            error: err.message || 'Validasi gagal',
          });
        }
      }
    });

    return {
      response: true,
      message: `${approved.length} jadwal berhasil di-approve, ${errors.length} gagal`,
      data: { approved, errors },
    };
  }

  public static async rejectBatch(
    batch_id: string,
    context: LogJadwalContext
  ) {
    const drafts = await JadwalDraftRepository.findByBatchId(
      batch_id,
      StatusJadwalDraft.DRAFT
    );
    if (!drafts || drafts.length === 0) {
      throw new APIError(
        'Tidak ada draft dengan status DRAFT pada batch ini',
        404
      );
    }

    await JadwalDraftRepository.updateStatusByBatchId(
      batch_id,
      StatusJadwalDraft.REJECTED
    );

    const rejectedDrafts = await JadwalDraftRepository.findByBatchId(batch_id);
    await Promise.all(
      drafts.map((draft) => {
        const rejectedDraft = rejectedDrafts.find((item) => item.id === draft.id);
        return LogService.createEntityLog({
          action: LogActionType.UPDATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL_DRAFT,
          entity_id: draft.id,
          old_values: draft,
          new_values: rejectedDraft ?? { ...draft, status: StatusJadwalDraft.REJECTED },
        });
      })
    );

    return {
      response: true,
      message: `${drafts.length} draft berhasil ditolak`,
    };
  }

  private static sortMahasiswaForScheduling<T extends {
    list_dosen: { nip: string }[];
  }>(items: T[]): T[] {
    const nipFrequency = new Map<string, number>();
    for (const item of items) {
      for (const dosen of item.list_dosen) {
        nipFrequency.set(dosen.nip, (nipFrequency.get(dosen.nip) || 0) + 1);
      }
    }

    return [...items].sort((a, b) => {
      const aSharedScore = a.list_dosen.reduce(
        (total, dosen) => total + (nipFrequency.get(dosen.nip) || 0),
        0
      );
      const bSharedScore = b.list_dosen.reduce(
        (total, dosen) => total + (nipFrequency.get(dosen.nip) || 0),
        0
      );

      return (
        b.list_dosen.length - a.list_dosen.length ||
        bSharedScore - aSharedScore
      );
    });
  }

  private static chunkMahasiswa<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private static formatExistingJadwalForAi(jadwal: any[]) {
    return jadwal.map((j) => ({
      tanggal: JadwalHelper.formatDateInJakarta(j.tanggal),
      waktu_mulai: JadwalHelper.formatTimeInJakarta(j.waktu_mulai),
      waktu_selesai: JadwalHelper.formatTimeInJakarta(j.waktu_selesai),
      kode_ruangan: j.kode_ruangan,
      dosen_terlibat: j.penilaian?.map((p: any) => p.nip) || [],
    }));
  }

  private static formatGeneratedDraftForAi(draft: CreateJadwalDraftInput) {
    return {
      tanggal: JadwalHelper.formatDateInJakarta(draft.tanggal),
      waktu_mulai: JadwalHelper.formatTimeInJakarta(draft.waktu_mulai),
      waktu_selesai: JadwalHelper.formatTimeInJakarta(draft.waktu_selesai),
      kode_ruangan: draft.kode_ruangan,
      dosen_terlibat: draft.list_dosen.map((d) => d.nip),
    };
  }

  private static buildChunkContextData(params: {
    tanggalMulai: Date;
    mahasiswaChunk: Array<{
      nim: string;
      kode_jenis: string;
      list_dosen: { nip: string; role: any }[];
    }>;
    ruanganList: any[];
    baseBlockingSchedules: any[];
    generatedBlockingSchedules: any[];
    constraintList: any[];
    tanggalDikecualikan?: string[];
    catatanTambahan?: string;
  }) {
    return {
      tanggal_mulai: JadwalHelper.formatDateInJakarta(params.tanggalMulai),
      list_mahasiswa: params.mahasiswaChunk.map((m) => ({
        nim: m.nim,
        jenis: m.kode_jenis,
        list_dosen: m.list_dosen,
      })),
      ruangan_tersedia: params.ruanganList.map((r) => r.kode),
      jadwal_ada: [
        ...params.baseBlockingSchedules,
        ...params.generatedBlockingSchedules,
      ],
      constraint_dosen: params.constraintList,
      tanggal_dikecualikan: params.tanggalDikecualikan || [],
      ...(params.catatanTambahan
        ? { catatan_tambahan: params.catatanTambahan }
        : {}),
    };
  }

  private static async generateChunkSuggestions(
    contextData: Record<string, unknown>,
    meta: { batchId: string; chunk: number; totalChunks: number },
    signal?: AbortSignal
  ) {
    if (signal?.aborted) {
      throw new APIError('Generate jadwal dibatalkan oleh client', 499);
    }

    const response = await openRouterService.chatCompletion({
      messages: [
        textMessage('system', PERSONA_PROMPT),
        textMessage('system', getScheduleRulesAsText()),
        textMessage('system', BATCH_TASK_PROMPT),
        textMessage('user', JSON.stringify(contextData)),
      ],
      temperature: 0.3,
      maxTokens: 8192,
      signal,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new APIError(
        'AI tidak dapat memproses permintaan. Silakan coba lagi.',
        502
      );
    }

    const jsonStr = this.extractJsonFromAiContent(rawContent);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error('Failed to parse AI JSON output', {
        batchId: meta.batchId,
        chunk: meta.chunk,
        totalChunks: meta.totalChunks,
        rawContent,
      });
      throw new APIError(
        'AI mengembalikan format yang tidak valid. Silakan coba lagi.',
        502
      );
    }

    const result = GenerateBatchOutputSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('AI output validation failed', {
        batchId: meta.batchId,
        chunk: meta.chunk,
        totalChunks: meta.totalChunks,
        errors: result.error.issues,
      });
      throw new APIError(
        'AI mengembalikan data yang tidak valid. Silakan coba lagi.',
        502
      );
    }

    return result.data;
  }

  private static extractJsonFromAiContent(content: string) {
    const jsonFenceMatch = content.match(/```json\s*([\s\S]*?)```/i);
    if (jsonFenceMatch?.[1]) return jsonFenceMatch[1].trim();

    const fencedBlocks = [...content.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/g)];
    for (const block of fencedBlocks) {
      const candidate = block[1]?.trim();
      if (candidate?.startsWith('{') || candidate?.startsWith('[')) return candidate;
    }

    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return content.slice(firstBrace, lastBrace + 1).trim();
    }

    return content.trim();
  }

  private static validateChunkSuggestionsCoverage(
    suggestions: { nim: string; jenis: string }[],
    mahasiswaChunk: Array<{ nim: string; kode_jenis: string }>
  ) {
    const expected = new Set(
      mahasiswaChunk.map((m) => `${m.nim}|${m.kode_jenis}`)
    );
    const received = new Set<string>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.nim}|${suggestion.jenis}`;
      if (!expected.has(key) || received.has(key)) {
        throw new APIError(
          'AI mengembalikan jumlah jadwal yang tidak sesuai dengan daftar mahasiswa. Silakan coba lagi.',
          502
        );
      }
      received.add(key);
    }

    if (received.size !== expected.size) {
      throw new APIError(
        'AI mengembalikan jumlah jadwal yang tidak sesuai dengan daftar mahasiswa. Silakan coba lagi.',
        502
      );
    }
  }

  private static validateExcludedDates(
    suggestions: Array<{ tanggal: string }>,
    excludedDates: string[]
  ) {
    if (excludedDates.length === 0) return;

    const excluded = new Set(excludedDates);
    const hasExcludedDate = suggestions.some((s) => excluded.has(s.tanggal));
    if (hasExcludedDate) {
      throw new APIError(
        'AI menghasilkan jadwal pada tanggal yang dikecualikan. Silakan coba lagi.',
        502
      );
    }
  }

  private static async mapSuggestionsToDrafts(params: {
    suggestions: Array<{
      tanggal: string;
      waktu_mulai: string;
      waktu_selesai: string;
      kode_ruangan: string;
      nim: string;
      jenis: string;
      confidence: number;
      reasoning: string;
    }>;
    mahasiswaChunk: Array<{
      nim: string;
      kode_jenis: string;
      list_dosen: { nip: string; role: any }[];
    }>;
    kodeToId: Map<string, string>;
    batchId: string;
  }): Promise<CreateJadwalDraftInput[]> {
    const drafts: CreateJadwalDraftInput[] = [];

    for (const s of params.suggestions) {
      const mhsInput = params.mahasiswaChunk.find(
        (m) => m.nim === s.nim && m.kode_jenis === s.jenis
      );
      const idJenis =
        params.kodeToId.get(s.jenis) ||
        (await JenisSeminarHelper.resolveIdByKode(s.jenis));

      drafts.push({
        batch_id: params.batchId,
        nim: s.nim,
        id_jenis_seminar: idJenis,
        tanggal: JadwalHelper.createDateFromJakartaDate(s.tanggal),
        waktu_mulai: JadwalHelper.createDateFromJakartaDateTime(
          s.tanggal,
          s.waktu_mulai
        ),
        waktu_selesai: JadwalHelper.createDateFromJakartaDateTime(
          s.tanggal,
          s.waktu_selesai
        ),
        kode_ruangan: s.kode_ruangan,
        list_dosen: mhsInput?.list_dosen || [],
        llm_reasoning: { reasoning: s.reasoning },
        confidence: s.confidence,
      });
    }

    return drafts;
  }

  private static validateGeneratedDraftsHardConstraints(params: {
    drafts: CreateJadwalDraftInput[];
    existingBlockingSchedules: Array<{
      tanggal: string;
      waktu_mulai: string;
      waktu_selesai: string;
      kode_ruangan: string;
      dosen_terlibat: string[];
    }>;
    activeRoomCodes: Set<string>;
    excludedDates: string[];
    tanggalMulai: Date;
    endDate: Date;
  }) {
    const excludedDates = new Set(params.excludedDates);
    const minDate = JadwalHelper.formatDateInJakarta(params.tanggalMulai);
    const maxDate = JadwalHelper.formatDateInJakarta(params.endDate);

    for (const draft of params.drafts) {
      const tanggal = JadwalHelper.formatDateInJakarta(draft.tanggal);
      const waktuMulai = JadwalHelper.formatTimeInJakarta(draft.waktu_mulai);
      const waktuSelesai = JadwalHelper.formatTimeInJakarta(draft.waktu_selesai);

      if (!params.activeRoomCodes.has(draft.kode_ruangan)) {
        throw new APIError(
          'AI menghasilkan jadwal pada ruangan yang tidak tersedia. Silakan coba lagi.',
          502
        );
      }
      if (excludedDates.has(tanggal)) {
        throw new APIError(
          'AI menghasilkan jadwal pada tanggal yang dikecualikan. Silakan coba lagi.',
          502
        );
      }
      if (tanggal < minDate || tanggal > maxDate) {
        throw new APIError(
          'AI menghasilkan jadwal di luar rentang tanggal generate. Silakan coba lagi.',
          502
        );
      }
      if (draft.waktu_mulai >= draft.waktu_selesai) {
        throw new APIError(
          'AI menghasilkan jadwal dengan waktu selesai tidak valid. Silakan coba lagi.',
          502
        );
      }
      if (waktuMulai < '08:00' || waktuSelesai > '17:00') {
        throw new APIError(
          'AI menghasilkan jadwal di luar jam kerja. Silakan coba lagi.',
          502
        );
      }

      const day = new Date(`${tanggal}T00:00:00.000+07:00`).getUTCDay();
      if (day === 0 || day === 6) {
        throw new APIError(
          'AI menghasilkan jadwal pada akhir pekan. Silakan coba lagi.',
          502
        );
      }

      for (const schedule of params.existingBlockingSchedules) {
        if (schedule.tanggal !== tanggal) continue;
        if (!this.timeStringsOverlap(
          waktuMulai,
          waktuSelesai,
          schedule.waktu_mulai,
          schedule.waktu_selesai
        )) {
          continue;
        }

        if (schedule.kode_ruangan === draft.kode_ruangan) {
          throw new APIError(
            'AI menghasilkan jadwal dengan konflik ruangan existing. Silakan coba lagi.',
            502
          );
        }

        const draftNips = new Set(draft.list_dosen.map((d) => d.nip));
        if (schedule.dosen_terlibat.some((nip) => draftNips.has(nip))) {
          throw new APIError(
            'AI menghasilkan jadwal dengan konflik dosen existing. Silakan coba lagi.',
            502
          );
        }
      }
    }
  }

  private static validateGeneratedDraftsNoObviousConflicts(
    drafts: CreateJadwalDraftInput[]
  ) {
    const mahasiswaKeys = new Set<string>();
    for (const draft of drafts) {
      const key = `${draft.nim}|${draft.id_jenis_seminar}`;
      if (mahasiswaKeys.has(key)) {
        throw new APIError(
          'AI menghasilkan jadwal duplikat untuk mahasiswa yang sama. Silakan coba lagi.',
          502
        );
      }
      mahasiswaKeys.add(key);
    }

    for (let i = 0; i < drafts.length; i++) {
      for (let j = i + 1; j < drafts.length; j++) {
        const first = drafts[i];
        const second = drafts[j];
        if (
          !this.timeRangesOverlap(
            first.waktu_mulai,
            first.waktu_selesai,
            second.waktu_mulai,
            second.waktu_selesai
          )
        ) {
          continue;
        }

        if (first.kode_ruangan === second.kode_ruangan) {
          throw new APIError(
            'AI menghasilkan jadwal dengan konflik ruangan. Silakan coba lagi.',
            502
          );
        }

        const firstNips = new Set(first.list_dosen.map((d) => d.nip));
        const hasSameDosen = second.list_dosen.some((d) => firstNips.has(d.nip));
        if (hasSameDosen) {
          throw new APIError(
            'AI menghasilkan jadwal dengan konflik dosen. Silakan coba lagi.',
            502
          );
        }
      }
    }
  }

  private static timeRangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date
  ) {
    return startA < endB && startB < endA;
  }

  private static timeStringsOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ) {
    return startA < endB && startB < endA;
  }

  private static async getConstraintsForNips(nips: string[]) {
    const uniqueNips = [...new Set(nips)];
    const constraints = await ConstraintDosenRepository.findByNips(uniqueNips);
    const grouped = new Map<string, any[]>();

    for (const constraint of constraints) {
      const list = grouped.get(constraint.nip) || [];
      list.push({
        type: constraint.type,
        hari: constraint.hari,
        waktu_mulai: constraint.waktu_mulai
          ? JadwalHelper.formatTimeInJakarta(constraint.waktu_mulai)
          : null,
        waktu_selesai: constraint.waktu_selesai
          ? JadwalHelper.formatTimeInJakarta(constraint.waktu_selesai)
          : null,
        priority: constraint.priority,
      });
      grouped.set(constraint.nip, list);
    }

    return uniqueNips.map((nip) => ({
      nip,
      constraints: grouped.get(nip) || [],
    }));
  }

  private static formatDraftResponse(draft: any) {
    return {
      ...draft,
      tanggal: draft.tanggal
        ? JadwalHelper.formatDateInJakarta(new Date(draft.tanggal))
        : null,
      waktu_mulai: draft.waktu_mulai
        ? JadwalHelper.formatTimeInJakarta(new Date(draft.waktu_mulai))
        : null,
      waktu_selesai: draft.waktu_selesai
        ? JadwalHelper.formatTimeInJakarta(new Date(draft.waktu_selesai))
        : null,
    };
  }
}
