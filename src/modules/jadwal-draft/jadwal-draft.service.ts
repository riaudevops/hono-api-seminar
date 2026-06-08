import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  LogActionType,
  LogActorType,
  LogEntityType,
  StatusJadwalDraft,
} from '@prisma/client';
import { APIError } from '../../utils/api-error.util';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { hashCacheKey } from '../../utils/cache-key.util';
import { createLogger } from '../../utils/logger.util';
import { textMessage } from '../../utils/openrouter.util';
import openRouterService from '../../infrastructures/openrouter.infrastructure';
import prisma from '../../infrastructures/db.infrastructure';
import redisService from '../../infrastructures/redis.infrastructure';
import { GenerateBatchOutputSchema } from '../../prompts/output/schedule-schema';
import {
  BREAK_TIME,
  getScheduleRulesAsText,
  SEMINAR_DURATION_MINUTES,
} from '../../prompts/context/schedule-rules';
import JadwalDraftRepository from './jadwal-draft.repository';
import { JadwalRepository, JadwalService } from '../jadwal';
import RuanganRepository from '../ruangan/ruangan.repository';
import { ConstraintDosenRepository } from '../constraint-dosen';
import { LogService } from '../../modules/log';
import JadwalHelper from '../../helpers/jadwal.helper';
import JenisSeminarHelper from '../../helpers/jenis-seminar.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import type { LogJadwalContext } from '../jadwal';
import type {
  CreateJadwalDraftInput,
  UpdateDraftInput,
} from './jadwal-draft.type';

const logger = createLogger('JadwalDraftService');
// Chunking 8 mahasiswa/request: trade-off antara context size dan global awareness.
// - Context per request kecil (≈10-15KB) sehingga AI lebih reliable, output ≤2-4KB,
//   parse failure rate turun, latency per chunk ≈15-30 detik vs 2-4 menit.
// - Antar-chunk awareness dijaga oleh `generatedBlockingSchedules` yang di-update
//   setelah tiap chunk valid, lalu di-feed ke `buildChunkContextData` chunk berikutnya
//   sebagai entry `jadwal_ada` (lihat loop di generate()). Jadi chunk N+1 tahu slot
//   yang sudah terpakai chunk N.
// - Constraint dosen sudah otomatis terfilter per chunk lewat
//   `getConstraintsForNipsCached([...chunkNips])` (line ~241).
const GENERATE_CHUNK_SIZE = 8;

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
    // Resolve kode_jenis → id_jenis_seminar paralel agar tidak serial-await
    // tiap kode ke DB.
    await sendProgress('jenis:resolving', {
      message: 'Mencocokkan jenis seminar',
    });
    const kodeSet = new Set<string>();
    for (const mhs of data.list_mahasiswa) kodeSet.add(mhs.kode_jenis);
    const kodeToId = new Map<string, string>();
    const kodeArr = [...kodeSet];
    const idArr = await Promise.all(
      kodeArr.map((kode) => JenisSeminarHelper.resolveIdByKode(kode))
    );
    kodeArr.forEach((kode, i) => kodeToId.set(kode, idArr[i]));

    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    // Validate mahasiswa + dosen + cek existing jadwal secara paralel.
    // Sebelumnya: serial await per mahasiswa = N round-trip DB sebelum AI dimulai.
    // Sekarang: emit progress 'validating:start', kemudian semua tugas validasi
    // berjalan bersamaan; progress per-item dipancarkan saat tiap tugas selesai.
    const allNips = new Set<string>();
    const totalMhs = data.list_mahasiswa.length;
    await sendProgress('validating:start', {
      total: totalMhs,
      message: `Memvalidasi ${totalMhs} mahasiswa`,
    });

    let validatedCount = 0;
    await Promise.all(
      data.list_mahasiswa.map(async (mhs) => {
        const idJenis = kodeToId.get(mhs.kode_jenis)!;

        const [, existing] = await Promise.all([
          JadwalService.validateMahasiswa(mhs.nim),
          JadwalRepository.existsByMahasiswaAndJenis(
            mhs.nim,
            idJenis,
            kode_tahun_ajaran
          ),
        ]);
        if (existing) {
          throw new APIError(
            `Mahasiswa ${mhs.nim} sudah memiliki jadwal untuk jenis ${mhs.kode_jenis}`,
            400
          );
        }

        await Promise.all(
          mhs.list_dosen.map((d) => JadwalService.validateDosen(d.nip, d.role))
        );
        for (const d of mhs.list_dosen) allNips.add(d.nip);

        validatedCount += 1;
        await sendProgress('validating', {
          current: validatedCount,
          total: totalMhs,
          nim: mhs.nim,
          message: `Memvalidasi mahasiswa ${mhs.nim}`,
        });
      })
    );

    const tanggalMulai = new Date(data.tanggal_mulai);
    const endDate = new Date(tanggalMulai);
    endDate.setDate(endDate.getDate() + 30);

    logger.info('Generate batch context', {
      batchId,
      tanggalMulai: JadwalHelper.formatDateInJakarta(tanggalMulai),
      endDate: JadwalHelper.formatDateInJakarta(endDate),
      mahasiswaCount: data.list_mahasiswa.length,
      jenisCount: kodeSet.size,
      tanggalDikecualikan: data.tanggal_dikecualikan ?? [],
      catatanTambahan: data.catatan_tambahan ?? null,
    });

    await sendProgress('context:loading', {
      message: 'Mengambil data ruangan, jadwal existing, dan constraint dosen',
    });

    const [ruanganList, existingJadwal] = await Promise.all([
      redisService.remember('ai:jadwal-context:ruangan', 3_600, () =>
        RuanganRepository.findAktif()
      ),
      redisService.remember(
        `ai:jadwal-context:blocking:${JadwalHelper.formatDateInJakarta(tanggalMulai)}:${JadwalHelper.formatDateInJakarta(endDate)}`,
        120,
        () =>
          JadwalRepository.findBlockingSchedulesForGeneration(
            tanggalMulai,
            endDate
          )
      ),
    ]);

    logger.info('Generating batch schedule', {
      batchId,
      mahasiswaCount: data.list_mahasiswa.length,
    });

    const baseBlockingSchedules = JadwalDraftService.formatExistingJadwalForAi(
      existingJadwal as any[]
    );
    const sortedMahasiswa = JadwalDraftService.sortMahasiswaForScheduling(
      data.list_mahasiswa
    );
    const mahasiswaChunks = JadwalDraftService.chunkMahasiswa(
      sortedMahasiswa,
      GENERATE_CHUNK_SIZE
    );
    const drafts: CreateJadwalDraftInput[] = [];
    const generatedBlockingSchedules: any[] = [];

    logger.info('Batch chunks prepared', {
      batchId,
      ruanganCount: ruanganList.length,
      existingJadwalCount: baseBlockingSchedules.length,
      chunkSize: GENERATE_CHUNK_SIZE,
      totalChunks: mahasiswaChunks.length,
    });

    await sendProgress('chunks:start', {
      batch_id: batchId,
      total_chunks: mahasiswaChunks.length,
      chunk_size: GENERATE_CHUNK_SIZE,
      total_mahasiswa: data.list_mahasiswa.length,
      message: `Generate akan diproses dalam ${mahasiswaChunks.length} chunk`,
    });

    for (const [chunkIndex, mahasiswaChunk] of mahasiswaChunks.entries()) {
      const currentChunk = chunkIndex + 1;
      const chunkStartedAt = Date.now();
      logger.info('Chunk start', {
        batchId,
        chunk: currentChunk,
        totalChunks: mahasiswaChunks.length,
        mahasiswa: mahasiswaChunk.map((m) => ({
          nim: m.nim,
          jenis: m.kode_jenis,
          dosenCount: m.list_dosen.length,
        })),
      });
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
      const constraintList =
        await JadwalDraftService.getConstraintsForNipsCached([...chunkNips]);
      const contextData = JadwalDraftService.buildChunkContextData({
        tanggalMulai,
        mahasiswaChunk,
        ruanganList,
        baseBlockingSchedules,
        generatedBlockingSchedules,
        constraintList,
        tanggalDikecualikan: data.tanggal_dikecualikan,
        catatanTambahan: data.catatan_tambahan,
      });

      logger.info('Chunk context built', {
        batchId,
        chunk: currentChunk,
        totalChunks: mahasiswaChunks.length,
        dosenCount: chunkNips.size,
        constraintCount: constraintList.length,
        blockingFromBase: baseBlockingSchedules.length,
        blockingFromGenerated: generatedBlockingSchedules.length,
        contextSizeBytes: JSON.stringify(contextData).length,
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

      const result = await JadwalDraftService.generateChunkSuggestions(
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
        durationMs: Date.now() - chunkStartedAt,
        suggestionCount: result.suggestions.length,
        sampleSuggestion: result.suggestions[0]
          ? {
              nim: result.suggestions[0].nim,
              jenis: result.suggestions[0].jenis,
              tanggal: result.suggestions[0].tanggal,
              waktu_mulai: result.suggestions[0].waktu_mulai,
              waktu_selesai: result.suggestions[0].waktu_selesai,
              kode_ruangan: result.suggestions[0].kode_ruangan,
              confidence: result.suggestions[0].confidence,
            }
          : null,
      });

      throwIfAborted();

      await sendProgress('ai:parsing', {
        batch_id: batchId,
        chunk: currentChunk,
        total_chunks: mahasiswaChunks.length,
        message: `Memproses hasil generate AI chunk ${currentChunk}/${mahasiswaChunks.length}`,
      });

      JadwalDraftService.validateChunkSuggestionsCoverage(
        result.suggestions,
        mahasiswaChunk
      );
      JadwalDraftService.validateExcludedDates(
        result.suggestions,
        data.tanggal_dikecualikan || []
      );

      const chunkDrafts = await JadwalDraftService.mapSuggestionsToDrafts({
        suggestions: result.suggestions,
        mahasiswaChunk,
        kodeToId,
        batchId,
      });

      JadwalDraftService.repairGeneratedDraftsHardConstraints({
        drafts: chunkDrafts,
        existingBlockingSchedules: [
          ...baseBlockingSchedules,
          ...generatedBlockingSchedules,
        ],
        activeRoomCodes: ruanganList.map((r: any) => r.kode),
        excludedDates: data.tanggal_dikecualikan || [],
        tanggalMulai,
        endDate,
        constraintList,
      });

      JadwalDraftService.validateGeneratedDraftsHardConstraints({
        drafts: chunkDrafts,
        existingBlockingSchedules: [
          ...baseBlockingSchedules,
          ...generatedBlockingSchedules,
        ],
        activeRoomCodes: new Set(ruanganList.map((r: any) => r.kode)),
        excludedDates: data.tanggal_dikecualikan || [],
        tanggalMulai,
        endDate,
        constraintList,
      });

      drafts.push(...chunkDrafts);
      generatedBlockingSchedules.push(
        ...chunkDrafts.map((draft) =>
          JadwalDraftService.formatGeneratedDraftForAi(draft)
        )
      );

      logger.info('Chunk done', {
        batchId,
        chunk: currentChunk,
        totalChunks: mahasiswaChunks.length,
        durationMs: Date.now() - chunkStartedAt,
        chunkDraftCount: chunkDrafts.length,
        totalDraftCount: drafts.length,
      });

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

    JadwalDraftService.validateGeneratedDraftsNoObviousConflicts(drafts);

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
        drafts: savedDrafts.map((d) =>
          JadwalDraftService.formatDraftResponse(d)
        ),
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
      data: drafts.map((d) => JadwalDraftService.formatDraftResponse(d)),
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
        return JadwalDraftService.formatDraftResponse({
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
      data: JadwalDraftService.formatDraftResponse(updated),
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
          const id = await JadwalHelper.generateId(kode, tx);

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

    if (approved.length > 0) {
      await CacheInvalidation.invalidateJadwal();
      await CacheInvalidation.invalidatePendaftaran();
    }

    return {
      response: true,
      message: `${approved.length} jadwal berhasil di-approve, ${errors.length} gagal`,
      data: { approved, errors },
    };
  }

  public static async rejectBatch(batch_id: string, context: LogJadwalContext) {
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
        const rejectedDraft = rejectedDrafts.find(
          (item) => item.id === draft.id
        );
        return LogService.createEntityLog({
          action: LogActionType.UPDATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL_DRAFT,
          entity_id: draft.id,
          old_values: draft,
          new_values: rejectedDraft ?? {
            ...draft,
            status: StatusJadwalDraft.REJECTED,
          },
        });
      })
    );

    return {
      response: true,
      message: `${drafts.length} draft berhasil ditolak`,
    };
  }

  private static sortMahasiswaForScheduling<
    T extends {
      list_dosen: { nip: string }[];
    },
  >(items: T[]): T[] {
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
        b.list_dosen.length - a.list_dosen.length || bSharedScore - aSharedScore
      );
    });
  }

  private static chunkMahasiswa<T>(items: T[], size: number): T[][] {
    if (!Number.isFinite(size) || size <= 0 || size >= items.length) {
      return items.length === 0 ? [] : [items];
    }
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
      // Chunk size 8 mahasiswa: output JSON 8 suggestion ~2-4KB, 8192 token jelas muat.
      maxTokens: 8192,
      // Structured output: mengurangi parse failure (rawContent kosong / non-JSON /
      // markdown fence). extractJsonFromAiContent tetap dipertahankan sebagai fallback.
      response_format: { type: 'json_object' },
      provider: { sort: 'latency' },
      signal,
      // 90 detik per chunk: chunk kecil + structured output cukup ~15-30 detik;
      // 90 detik beri safety margin tanpa bikin user nunggu lama saat retry.
      timeoutMs: 90_000,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw JadwalDraftService.buildAIError(
        'AI tidak dapat memproses permintaan. Silakan coba lagi.',
        `chunk ${meta.chunk}/${meta.totalChunks}, response kosong`,
        {
          reason: 'empty_ai_response',
          batchId: meta.batchId,
          chunkIndex: meta.chunk,
          totalChunks: meta.totalChunks,
        }
      );
    }

    const jsonStr = JadwalDraftService.extractJsonFromAiContent(rawContent);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      const parseMessage =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      logger.error('Failed to parse AI JSON output', {
        batchId: meta.batchId,
        chunk: meta.chunk,
        totalChunks: meta.totalChunks,
        rawContent,
      });
      throw JadwalDraftService.buildAIError(
        'AI mengembalikan format yang tidak valid. Silakan coba lagi.',
        `chunk ${meta.chunk}/${meta.totalChunks}, length ${rawContent.length}, parse error: ${parseMessage}`,
        {
          reason: 'invalid_json',
          batchId: meta.batchId,
          chunkIndex: meta.chunk,
          totalChunks: meta.totalChunks,
          rawContentLength: rawContent.length,
          parseError: parseMessage,
        }
      );
    }

    const result = GenerateBatchOutputSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.slice(0, 3).map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      const issueText = issues
        .map((it) => `${it.path || '<root>'}: ${it.message}`)
        .join('; ');
      logger.error('AI output validation failed', {
        batchId: meta.batchId,
        chunk: meta.chunk,
        totalChunks: meta.totalChunks,
        errors: result.error.issues,
      });
      throw JadwalDraftService.buildAIError(
        'AI mengembalikan data yang tidak valid. Silakan coba lagi.',
        `chunk ${meta.chunk}/${meta.totalChunks}, ${issueText}`,
        {
          reason: 'schema_validation_failed',
          batchId: meta.batchId,
          chunkIndex: meta.chunk,
          totalChunks: meta.totalChunks,
          issues,
        }
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
      if (candidate?.startsWith('{') || candidate?.startsWith('['))
        return candidate;
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
      if (!expected.has(key)) {
        throw JadwalDraftService.buildAIError(
          'AI mengembalikan jumlah jadwal yang tidak sesuai dengan daftar mahasiswa. Silakan coba lagi.',
          `unexpected entry NIM ${suggestion.nim} jenis ${suggestion.jenis} (tidak ada di daftar mahasiswa)`,
          {
            reason: 'unexpected_suggestion',
            unexpected: { nim: suggestion.nim, jenis: suggestion.jenis },
            expectedCount: expected.size,
          }
        );
      }
      if (received.has(key)) {
        throw JadwalDraftService.buildAIError(
          'AI mengembalikan jumlah jadwal yang tidak sesuai dengan daftar mahasiswa. Silakan coba lagi.',
          `duplicate entry NIM ${suggestion.nim} jenis ${suggestion.jenis}`,
          {
            reason: 'duplicate_suggestion',
            duplicate: { nim: suggestion.nim, jenis: suggestion.jenis },
          }
        );
      }
      received.add(key);
    }

    if (received.size !== expected.size) {
      const missing = [...expected].filter((k) => !received.has(k));
      throw JadwalDraftService.buildAIError(
        'AI mengembalikan jumlah jadwal yang tidak sesuai dengan daftar mahasiswa. Silakan coba lagi.',
        `expected ${expected.size}, received ${received.size}, missing ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `, +${missing.length - 5} lainnya` : ''}`,
        {
          reason: 'coverage_mismatch',
          expectedCount: expected.size,
          receivedCount: received.size,
          missing,
        }
      );
    }
  }

  private static validateExcludedDates(
    suggestions: Array<{ tanggal: string }>,
    excludedDates: string[]
  ) {
    if (excludedDates.length === 0) return;

    const excluded = new Set(excludedDates);
    const hitDates = suggestions
      .map((s) => s.tanggal)
      .filter((t) => excluded.has(t));
    if (hitDates.length > 0) {
      throw JadwalDraftService.buildAIError(
        'AI menghasilkan jadwal pada tanggal yang dikecualikan. Silakan coba lagi.',
        `tanggal ${[...new Set(hitDates)].join(', ')} termasuk daftar dikecualikan`,
        {
          reason: 'excluded_date_in_suggestions',
          hitDates: [...new Set(hitDates)],
          excludedDates,
        }
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
        llm_reasoning: {
          reasoning: s.reasoning,
          jenis: s.jenis,
        },
        confidence: s.confidence,
      });
    }

    return drafts;
  }

  private static repairGeneratedDraftsHardConstraints(params: {
    drafts: CreateJadwalDraftInput[];
    existingBlockingSchedules: Array<{
      tanggal: string;
      waktu_mulai: string;
      waktu_selesai: string;
      kode_ruangan: string;
      dosen_terlibat: string[];
    }>;
    activeRoomCodes: string[];
    excludedDates: string[];
    tanggalMulai: Date;
    endDate: Date;
    constraintList: any[];
  }) {
    const blockingSchedules = [...params.existingBlockingSchedules];

    for (const draft of params.drafts) {
      const original = JadwalDraftService.summarizeDraftForLog(draft);
      const durationMinutes = JadwalDraftService.getDraftDurationMinutes(draft);

      const repaired = JadwalDraftService.findFirstValidSlot({
        draft,
        durationMinutes,
        blockingSchedules,
        activeRoomCodes: params.activeRoomCodes,
        excludedDates: params.excludedDates,
        tanggalMulai: params.tanggalMulai,
        endDate: params.endDate,
        constraintList: params.constraintList,
      });

      if (!repaired) {
        logger.error('Unable to repair AI schedule draft', { draft: original });
        continue;
      }

      draft.tanggal = JadwalHelper.createDateFromJakartaDate(repaired.tanggal);
      draft.waktu_mulai = JadwalHelper.createDateFromJakartaDateTime(
        repaired.tanggal,
        repaired.waktu_mulai
      );
      draft.waktu_selesai = JadwalHelper.createDateFromJakartaDateTime(
        repaired.tanggal,
        repaired.waktu_selesai
      );
      draft.kode_ruangan = repaired.kode_ruangan;

      const updated = JadwalDraftService.summarizeDraftForLog(draft);
      if (JSON.stringify(original) !== JSON.stringify(updated)) {
        logger.warn('AI schedule draft repaired before validation', {
          original,
          repaired: updated,
          durationMinutes,
        });
        draft.llm_reasoning = {
          ...(draft.llm_reasoning ?? {}),
          repaired_by_backend: true,
          original_slot: original,
          repair_reason:
            'Slot AI melanggar hard constraint; backend memindahkan ke slot valid pertama.',
        };
      }

      blockingSchedules.push(
        JadwalDraftService.formatGeneratedDraftForAi(draft)
      );
    }
  }

  private static findFirstValidSlot(params: {
    draft: CreateJadwalDraftInput;
    durationMinutes: number;
    blockingSchedules: Array<{
      tanggal: string;
      waktu_mulai: string;
      waktu_selesai: string;
      kode_ruangan: string;
      dosen_terlibat: string[];
    }>;
    activeRoomCodes: string[];
    excludedDates: string[];
    tanggalMulai: Date;
    endDate: Date;
    constraintList: any[];
  }) {
    const excludedDates = new Set(params.excludedDates);
    const minDate = JadwalHelper.formatDateInJakarta(params.tanggalMulai);
    const maxDate = JadwalHelper.formatDateInJakarta(params.endDate);
    const draftNips = new Set(params.draft.list_dosen.map((d) => d.nip));

    for (const tanggal of JadwalDraftService.enumerateDateStrings(
      minDate,
      maxDate
    )) {
      if (excludedDates.has(tanggal)) continue;
      const day = new Date(`${tanggal}T00:00:00.000Z`).getUTCDay();
      if (day === 0 || day === 6) continue;

      for (const waktuMulai of JadwalDraftService.enumerateStartTimes(
        params.durationMinutes
      )) {
        const waktuSelesai = JadwalDraftService.addMinutesToTime(
          waktuMulai,
          params.durationMinutes
        );
        if (JadwalDraftService.overlapsBreakTime(waktuMulai, waktuSelesai)) {
          continue;
        }

        for (const kodeRuangan of params.activeRoomCodes) {
          const hasConflict = params.blockingSchedules.some((schedule) => {
            if (schedule.tanggal !== tanggal) return false;
            if (
              !JadwalDraftService.timeStringsOverlap(
                waktuMulai,
                waktuSelesai,
                schedule.waktu_mulai,
                schedule.waktu_selesai
              )
            ) {
              return false;
            }

            if (schedule.kode_ruangan === kodeRuangan) return true;
            return schedule.dosen_terlibat.some((nip) => draftNips.has(nip));
          });

          if (hasConflict) continue;
          if (
            !JadwalDraftService.satisfiesDosenConstraints({
              nips: [...draftNips],
              tanggal,
              waktuMulai,
              waktuSelesai,
              constraintList: params.constraintList,
            })
          ) {
            continue;
          }

          return {
            tanggal,
            waktu_mulai: waktuMulai,
            waktu_selesai: waktuSelesai,
            kode_ruangan: kodeRuangan,
          };
        }
      }
    }

    return null;
  }

  private static enumerateDateStrings(minDate: string, maxDate: string) {
    const dates: string[] = [];
    const current = new Date(`${minDate}T00:00:00.000Z`);
    const end = new Date(`${maxDate}T00:00:00.000Z`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  private static enumerateStartTimes(durationMinutes: number) {
    const startMinutes = 8 * 60;
    const endMinutes = 17 * 60;
    const latestStart = endMinutes - durationMinutes;
    const times: string[] = [];

    for (let minutes = startMinutes; minutes <= latestStart; minutes += 60) {
      times.push(JadwalDraftService.minutesToTime(minutes));
    }

    return times;
  }

  private static overlapsBreakTime(waktuMulai: string, waktuSelesai: string) {
    return JadwalDraftService.timeStringsOverlap(
      waktuMulai,
      waktuSelesai,
      BREAK_TIME.start,
      BREAK_TIME.end
    );
  }

  private static addMinutesToTime(time: string, minutesToAdd: number) {
    const [hours, minutes] = time.split(':').map(Number);
    return JadwalDraftService.minutesToTime(
      hours * 60 + minutes + minutesToAdd
    );
  }

  private static diffTimeMinutes(waktuMulai: string, waktuSelesai: string) {
    const [startHours, startMinutes] = waktuMulai.split(':').map(Number);
    const [endHours, endMinutes] = waktuSelesai.split(':').map(Number);
    return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  }

  private static minutesToTime(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private static satisfiesDosenConstraints(params: {
    nips: string[];
    tanggal: string;
    waktuMulai: string;
    waktuSelesai: string;
    constraintList: any[];
  }) {
    const day = new Date(`${params.tanggal}T00:00:00.000Z`).getUTCDay();
    const activeConstraints = params.constraintList.filter((item) =>
      params.nips.includes(item.nip)
    );

    for (const item of activeConstraints) {
      const constraints: any[] = Array.isArray(item.constraints)
        ? item.constraints
        : [];
      const available = constraints.filter(
        (constraint) =>
          constraint.type === 'AVAILABLE_TIME' &&
          (constraint.hari == null || constraint.hari === day)
      );

      if (
        available.length > 0 &&
        !available.some((constraint) =>
          JadwalDraftService.constraintCoversSlot(
            constraint,
            params.waktuMulai,
            params.waktuSelesai
          )
        )
      ) {
        return false;
      }

      const unavailable = constraints.filter(
        (constraint) =>
          constraint.type === 'UNAVAILABLE_TIME' &&
          (constraint.hari == null || constraint.hari === day)
      );
      if (
        unavailable.some((constraint) =>
          JadwalDraftService.constraintOverlapsSlot(
            constraint,
            params.waktuMulai,
            params.waktuSelesai
          )
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private static constraintCoversSlot(
    constraint: any,
    waktuMulai: string,
    waktuSelesai: string
  ) {
    if (!constraint.waktu_mulai || !constraint.waktu_selesai) return true;
    return (
      constraint.waktu_mulai <= waktuMulai &&
      constraint.waktu_selesai >= waktuSelesai
    );
  }

  private static constraintOverlapsSlot(
    constraint: any,
    waktuMulai: string,
    waktuSelesai: string
  ) {
    if (!constraint.waktu_mulai || !constraint.waktu_selesai) return true;
    return JadwalDraftService.timeStringsOverlap(
      waktuMulai,
      waktuSelesai,
      constraint.waktu_mulai,
      constraint.waktu_selesai
    );
  }

  private static getDraftDurationMinutes(draft: CreateJadwalDraftInput) {
    const jenis =
      typeof draft.llm_reasoning?.jenis === 'string'
        ? draft.llm_reasoning.jenis
        : null;

    return jenis && SEMINAR_DURATION_MINUTES[jenis]
      ? SEMINAR_DURATION_MINUTES[jenis]
      : Math.max(
          60,
          Math.round(
            (draft.waktu_selesai.getTime() - draft.waktu_mulai.getTime()) /
              60_000
          )
        );
  }

  private static summarizeDraftForLog(draft: CreateJadwalDraftInput) {
    return {
      nim: draft.nim,
      tanggal: JadwalHelper.formatDateInJakarta(draft.tanggal),
      waktu_mulai: JadwalHelper.formatTimeInJakarta(draft.waktu_mulai),
      waktu_selesai: JadwalHelper.formatTimeInJakarta(draft.waktu_selesai),
      kode_ruangan: draft.kode_ruangan,
    };
  }

  // ===========================================================================
  // Helper: bangun APIError dengan suffix "[Detail: <text>]" pada message dan
  // field structured `details` agar log Worker / response API langsung memuat
  // konteks kegagalan AI tanpa perlu cross-reference dua baris log.
  // ===========================================================================
  private static buildAIError(
    message: string,
    detailText: string,
    details: Record<string, unknown>,
    statusCode = 502
  ): APIError {
    const fullMessage = detailText
      ? `${message} [Detail: ${detailText}]`
      : message;
    return new APIError(fullMessage, statusCode, details);
  }

  private static formatDraftDetail(summary: {
    nim: string;
    tanggal: string;
    waktu_mulai: string;
    waktu_selesai: string;
    kode_ruangan: string;
  }): string {
    return `NIM ${summary.nim}, ${summary.tanggal} ${summary.waktu_mulai}-${summary.waktu_selesai}, ruangan ${summary.kode_ruangan}`;
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
    constraintList: any[];
  }) {
    const excludedDates = new Set(params.excludedDates);
    const minDate = JadwalHelper.formatDateInJakarta(params.tanggalMulai);
    const maxDate = JadwalHelper.formatDateInJakarta(params.endDate);

    for (const draft of params.drafts) {
      const tanggal = JadwalHelper.formatDateInJakarta(draft.tanggal);
      const waktuMulai = JadwalHelper.formatTimeInJakarta(draft.waktu_mulai);
      const waktuSelesai = JadwalHelper.formatTimeInJakarta(
        draft.waktu_selesai
      );

      const draftSummary = {
        nim: draft.nim,
        tanggal,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        kode_ruangan: draft.kode_ruangan,
      };

      if (!params.activeRoomCodes.has(draft.kode_ruangan)) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal pada ruangan yang tidak tersedia. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, ruangan tidak aktif`,
          {
            reason: 'inactive_room',
            draft: draftSummary,
            activeRoomCodes: [...params.activeRoomCodes],
          }
        );
      }
      if (excludedDates.has(tanggal)) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal pada tanggal yang dikecualikan. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, tanggal dikecualikan`,
          {
            reason: 'excluded_date',
            draft: draftSummary,
            excludedDates: [...excludedDates],
          }
        );
      }
      if (tanggal < minDate || tanggal > maxDate) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal di luar rentang tanggal generate. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, di luar ${minDate}..${maxDate}`,
          {
            reason: 'out_of_range_date',
            draft: draftSummary,
            minDate,
            maxDate,
          }
        );
      }
      if (draft.waktu_mulai >= draft.waktu_selesai) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal dengan waktu selesai tidak valid. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, waktu mulai >= selesai`,
          {
            reason: 'invalid_time_range',
            draft: draftSummary,
          }
        );
      }
      if (waktuMulai < '08:00' || waktuSelesai > '17:00') {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal di luar jam kerja. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, di luar 08:00-17:00 WIB`,
          {
            reason: 'outside_working_hours',
            draft: draftSummary,
            batas: '08:00–17:00 WIB',
          }
        );
      }

      const expectedDuration =
        JadwalDraftService.getDraftDurationMinutes(draft);
      const actualDuration = JadwalDraftService.diffTimeMinutes(
        waktuMulai,
        waktuSelesai
      );
      if (actualDuration !== expectedDuration) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan durasi jadwal yang tidak sesuai jenis seminar. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, durasi ${actualDuration} menit (harus ${expectedDuration} menit)`,
          {
            reason: 'wrong_duration',
            draft: draftSummary,
            expectedDuration,
            actualDuration,
          }
        );
      }

      if (JadwalDraftService.overlapsBreakTime(waktuMulai, waktuSelesai)) {
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal pada jam istirahat. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, overlap istirahat ${BREAK_TIME.start}-${BREAK_TIME.end} WIB`,
          {
            reason: 'break_time_overlap',
            draft: draftSummary,
            breakTime: `${BREAK_TIME.start}–${BREAK_TIME.end} WIB`,
          }
        );
      }

      const draftNips = new Set(draft.list_dosen.map((d) => d.nip));
      if (
        !JadwalDraftService.satisfiesDosenConstraints({
          nips: [...draftNips],
          tanggal,
          waktuMulai,
          waktuSelesai,
          constraintList: params.constraintList,
        })
      ) {
        const nipsArr = [...draftNips];
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal yang melanggar constraint dosen. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, dosen ${nipsArr.join(', ')}`,
          {
            reason: 'dosen_constraint_violation',
            draft: draftSummary,
            nips: nipsArr,
          }
        );
      }

      const day = new Date(`${tanggal}T00:00:00.000Z`).getUTCDay();
      if (day === 0 || day === 6) {
        const dayNames = [
          'Minggu',
          'Senin',
          'Selasa',
          'Rabu',
          'Kamis',
          'Jumat',
          'Sabtu',
        ];
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal pada akhir pekan. Silakan coba lagi.',
          `${JadwalDraftService.formatDraftDetail(draftSummary)}, hari ${dayNames[day]}`,
          {
            reason: 'weekend',
            draft: draftSummary,
            dayName: dayNames[day],
          }
        );
      }

      for (const schedule of params.existingBlockingSchedules) {
        if (schedule.tanggal !== tanggal) continue;
        if (
          !JadwalDraftService.timeStringsOverlap(
            waktuMulai,
            waktuSelesai,
            schedule.waktu_mulai,
            schedule.waktu_selesai
          )
        ) {
          continue;
        }

        if (schedule.kode_ruangan === draft.kode_ruangan) {
          throw JadwalDraftService.buildAIError(
            'AI menghasilkan jadwal dengan konflik ruangan existing. Silakan coba lagi.',
            `${JadwalDraftService.formatDraftDetail(draftSummary)}, bentrok dengan jadwal existing ${schedule.tanggal} ${schedule.waktu_mulai}-${schedule.waktu_selesai} ruangan ${schedule.kode_ruangan}`,
            {
              reason: 'existing_room_conflict',
              draft: draftSummary,
              existingSchedule: {
                tanggal: schedule.tanggal,
                waktu_mulai: schedule.waktu_mulai,
                waktu_selesai: schedule.waktu_selesai,
                kode_ruangan: schedule.kode_ruangan,
                dosen_terlibat: schedule.dosen_terlibat,
              },
            }
          );
        }

        const conflictingNips = schedule.dosen_terlibat.filter((nip) =>
          draftNips.has(nip)
        );
        if (conflictingNips.length > 0) {
          throw JadwalDraftService.buildAIError(
            'AI menghasilkan jadwal dengan konflik dosen existing. Silakan coba lagi.',
            `${JadwalDraftService.formatDraftDetail(draftSummary)}, bentrok dosen ${conflictingNips.join(', ')} dengan jadwal existing ${schedule.tanggal} ${schedule.waktu_mulai}-${schedule.waktu_selesai}`,
            {
              reason: 'existing_dosen_conflict',
              draft: draftSummary,
              existingSchedule: {
                tanggal: schedule.tanggal,
                waktu_mulai: schedule.waktu_mulai,
                waktu_selesai: schedule.waktu_selesai,
                kode_ruangan: schedule.kode_ruangan,
                dosen_terlibat: schedule.dosen_terlibat,
              },
              conflictingNips,
            }
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
        const summary = JadwalDraftService.summarizeDraftForLog(draft);
        throw JadwalDraftService.buildAIError(
          'AI menghasilkan jadwal duplikat untuk mahasiswa yang sama. Silakan coba lagi.',
          `NIM ${draft.nim} muncul lebih dari sekali untuk jenis ${draft.id_jenis_seminar}`,
          {
            reason: 'duplicate_mahasiswa',
            duplicate: summary,
            id_jenis_seminar: draft.id_jenis_seminar,
          }
        );
      }
      mahasiswaKeys.add(key);
    }

    for (let i = 0; i < drafts.length; i++) {
      for (let j = i + 1; j < drafts.length; j++) {
        const first = drafts[i];
        const second = drafts[j];
        if (
          !JadwalDraftService.timeRangesOverlap(
            first.waktu_mulai,
            first.waktu_selesai,
            second.waktu_mulai,
            second.waktu_selesai
          )
        ) {
          continue;
        }

        const firstSummary = JadwalDraftService.summarizeDraftForLog(first);
        const secondSummary = JadwalDraftService.summarizeDraftForLog(second);

        if (first.kode_ruangan === second.kode_ruangan) {
          throw JadwalDraftService.buildAIError(
            'AI menghasilkan jadwal dengan konflik ruangan. Silakan coba lagi.',
            `${JadwalDraftService.formatDraftDetail(firstSummary)} bentrok dengan ${JadwalDraftService.formatDraftDetail(secondSummary)}`,
            {
              reason: 'room_conflict',
              first: firstSummary,
              second: secondSummary,
            }
          );
        }

        const firstNips = new Set(first.list_dosen.map((d) => d.nip));
        const sharedNips = second.list_dosen
          .map((d) => d.nip)
          .filter((nip) => firstNips.has(nip));
        if (sharedNips.length > 0) {
          throw JadwalDraftService.buildAIError(
            'AI menghasilkan jadwal dengan konflik dosen. Silakan coba lagi.',
            `${JadwalDraftService.formatDraftDetail(firstSummary)} bentrok dosen ${sharedNips.join(', ')} dengan ${JadwalDraftService.formatDraftDetail(secondSummary)}`,
            {
              reason: 'dosen_conflict',
              first: firstSummary,
              second: secondSummary,
              sharedNips,
            }
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

  private static async getConstraintsForNipsCached(nips: string[]) {
    const uniqueNips = [...new Set(nips)].sort();
    return redisService.remember(
      `ai:constraints:${hashCacheKey(uniqueNips)}`,
      300,
      () => JadwalDraftService.getConstraintsForNips(uniqueNips)
    );
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
        keterangan: constraint.keterangan,
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
