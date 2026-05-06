import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { JenisJadwal, LogActionType, LogActorType, StatusJadwalDraft } from '@prisma/client';
import { APIError } from '../utils/api-error.util';
import { createLogger } from '../utils/logger.util';
import { textMessage } from '../utils/openrouter.util';
import openRouterService from '../infrastructures/openrouter.infrastructure';
import prisma from '../infrastructures/db.infrastructure';
import { GenerateBatchOutputSchema } from '../prompts/output/schedule-schema';
import { getScheduleRulesAsText } from '../prompts/context/schedule-rules';
import JadwalDraftRepository from '../repositories/jadwal-draft.repository';
import JadwalRepository from '../repositories/jadwal.repository';
import RuanganRepository from '../repositories/ruangan.repository';
import ConstraintDosenRepository from '../repositories/constraint-dosen.repository';
import PenilaianRepository from '../repositories/penilaian.repository';
import JadwalService from './jadwal.service';
import JadwalHelper from '../helpers/jadwal.helper';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';
import RuanganHelper from '../helpers/ruangan.helper';
import DosenHelper from '../helpers/dosen.helper';
import { LogJadwalContext } from './jadwal.service';
import { CreateJadwalDraftInput, UpdateDraftInput } from '../types/jadwal-draft.type';

const logger = createLogger('JadwalDraftService');

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
    data: { tanggal_mulai: Date; list_mahasiswa: any[]; catatan_tambahan?: string },
    context: LogJadwalContext
  ) {
    const batchId = generateBatchId();

    // Validate all mahasiswa and dosen
    const allNips = new Set<string>();
    for (const mhs of data.list_mahasiswa) {
      await JadwalService.validateMahasiswa(mhs.nim);

      const existing = await JadwalRepository.existsByMahasiswaAndJenis(mhs.nim, mhs.jenis);
      if (existing) {
        throw new APIError(
          `Mahasiswa ${mhs.nim} sudah memiliki jadwal untuk jenis ${mhs.jenis}`,
          400
        );
      }

      for (const d of mhs.list_dosen) {
        await JadwalService.validateDosen(d.nip, d.role);
        allNips.add(d.nip);
      }
    }

    // Gather LLM context
    const tanggalMulai = new Date(data.tanggal_mulai);
    const endDate = new Date(tanggalMulai);
    endDate.setDate(endDate.getDate() + 30);

    const [ruanganList, existingJadwal, constraintList] = await Promise.all([
      RuanganRepository.findAktif(),
      JadwalRepository.findByDateRange(tanggalMulai, endDate),
      this.getConstraintsForNips([...allNips]),
    ]);

    const contextData = {
      tanggal_mulai: tanggalMulai.toISOString().slice(0, 10),
      list_mahasiswa: data.list_mahasiswa.map((m: any) => ({
        nim: m.nim,
        jenis: m.jenis,
        list_dosen: m.list_dosen,
      })),
      ruangan_tersedia: ruanganList.map((r) => ({
        kode: r.kode,
        nama: r.nama,
      })),
      jadwal_ada: (existingJadwal as any[]).map((j) => ({
        tanggal: JadwalHelper.convertToJakartaTimezone(j.tanggal)
          .toISOString()
          .slice(0, 10),
        waktu_mulai: JadwalHelper.convertToJakartaTimezone(j.waktu_mulai)
          .toISOString()
          .slice(11, 16),
        waktu_selesai: JadwalHelper.convertToJakartaTimezone(j.waktu_selesai)
          .toISOString()
          .slice(11, 16),
        kode_ruangan: j.kode_ruangan,
        dosen_terlibat: j.penilaian?.map((p: any) => p.nip) || [],
      })),
      constraint_dosen: constraintList,
      ...(data.catatan_tambahan ? { catatan_tambahan: data.catatan_tambahan } : {}),
    };

    logger.info('Generating batch schedule', {
      batchId,
      mahasiswaCount: data.list_mahasiswa.length,
    });

    // Call LLM
    const response = await openRouterService.chatCompletion({
      messages: [
        textMessage('system', PERSONA_PROMPT),
        textMessage('system', getScheduleRulesAsText()),
        textMessage('system', BATCH_TASK_PROMPT),
        textMessage('user', JSON.stringify(contextData, null, 2)),
      ],
      temperature: 0.3,
      maxTokens: 4096,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new APIError(
        'AI tidak dapat memproses permintaan. Silakan coba lagi.',
        502
      );
    }

    // Parse JSON from AI response
    const jsonMatch =
      rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
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

    const result = GenerateBatchOutputSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('AI output validation failed', {
        errors: result.error.issues,
      });
      throw new APIError(
        'AI mengembalikan data yang tidak valid. Silakan coba lagi.',
        502
      );
    }

    // Map suggestions to jadwal_draft records
    const drafts: CreateJadwalDraftInput[] = result.data.suggestions.map(
      (s) => {
        const tanggalStr = `${s.tanggal}T00:00:00.000Z`;
        const mulaiStr = `${s.tanggal}T${s.waktu_mulai}:00.000Z`;
        const selesaiStr = `${s.tanggal}T${s.waktu_selesai}:00.000Z`;

        const mhsInput = data.list_mahasiswa.find(
          (m: any) => m.nim === s.nim && m.jenis === s.jenis
        );

        return {
          batch_id: batchId,
          nim: s.nim,
          jenis: s.jenis as JenisJadwal,
          judul: '',
          tanggal: JadwalHelper.convertFromJakartaTimezone(new Date(tanggalStr)),
          waktu_mulai: JadwalHelper.convertFromJakartaTimezone(new Date(mulaiStr)),
          waktu_selesai: JadwalHelper.convertFromJakartaTimezone(new Date(selesaiStr)),
          kode_ruangan: s.kode_ruangan,
          list_dosen: mhsInput?.list_dosen || [],
          llm_reasoning: { reasoning: s.reasoning },
          confidence: s.confidence,
        };
      }
    );

    if (drafts.length === 0) {
      throw new APIError(
        'Tidak ditemukan slot yang tersedia untuk periode yang diminta.',
        404
      );
    }

    await JadwalDraftRepository.createMany(drafts);

    const savedDrafts = await JadwalDraftRepository.findByBatchId(batchId);

    logger.info('Batch schedule generated', {
      batchId,
      draftCount: savedDrafts.length,
    });

    return {
      response: true,
      message: `${savedDrafts.length} jadwal draft berhasil di-generate`,
      data: {
        batch_id: batchId,
        drafts: savedDrafts.map((d) => this.formatDraftResponse(d)),
      },
    };
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

    return {
      response: true,
      message: 'Data draft jadwal berhasil diambil',
      data: drafts.map((d) => this.formatDraftResponse(d)),
    };
  }

  public static async updateDraft(id: string, data: UpdateDraftInput) {
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

    // Validate time conflicts if time fields changed
    if (updateData.waktu_mulai || updateData.waktu_selesai) {
      const mulai =
        updateData.waktu_mulai || draft.waktu_mulai;
      const selesai =
        updateData.waktu_selesai || draft.waktu_selesai;
      const kodeRuangan =
        updateData.kode_ruangan || draft.kode_ruangan;

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

    await prisma.$transaction(async (tx) => {
      for (const draft of drafts) {
        try {
          // Re-validate mahasiswa
          await JadwalService.validateMahasiswa(draft.nim);

          // Re-check no existing jadwal for this jenis
          const exists = await JadwalRepository.existsByMahasiswaAndJenis(
            draft.nim,
            draft.jenis
          );
          if (exists) {
            errors.push({
              draft_id: draft.id,
              nim: draft.nim,
              error: `Mahasiswa ${draft.nim} sudah memiliki jadwal untuk jenis ${draft.jenis}`,
            });
            continue;
          }

          // Validate ruangan
          await JadwalService.validateRuangan(draft.kode_ruangan);

          // Check conflicts
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

          // Create jadwal
          const id = await JadwalHelper.generateId(draft.jenis);
          const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

          const jadwal = await tx.jadwal.create({
            data: {
              id,
              tanggal: draft.tanggal,
              judul: draft.judul,
              waktu_mulai: draft.waktu_mulai,
              waktu_selesai: draft.waktu_selesai,
              jenis: draft.jenis,
              nim: draft.nim,
              kode_ruangan: draft.kode_ruangan,
              kode_tahun_ajaran,
            },
          });

          // Create penilaian records
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

          // Create log_jadwal
          const jadwalWithTimezone = {
            ...jadwal,
            waktu_mulai: JadwalHelper.convertToJakartaTimezone(
              jadwal.waktu_mulai
            ),
            waktu_selesai: JadwalHelper.convertToJakartaTimezone(
              jadwal.waktu_selesai
            ),
          };

          await tx.log_jadwal.create({
            data: {
              action: LogActionType.CREATE,
              actor_type: LogActorType.KOORDINATOR,
              actor_id: context.actor_id,
              jadwal_id: id,
              new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
            },
          });

          // Update draft status
          await tx.jadwal_draft.update({
            where: { id: draft.id },
            data: { status: StatusJadwalDraft.APPROVED },
          });

          approved.push({
            draft_id: draft.id,
            jadwal_id: id,
            nim: draft.nim,
            jenis: draft.jenis,
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

  public static async rejectBatch(batch_id: string) {
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

    return {
      response: true,
      message: `${drafts.length} draft berhasil ditolak`,
    };
  }

  private static async getConstraintsForNips(nips: string[]) {
    const result: {
      nip: string;
      constraints: any[];
    }[] = [];

    for (const nip of nips) {
      const constraints = await ConstraintDosenRepository.findByNip(nip);
      result.push({
        nip,
        constraints: constraints.map((c) => ({
          type: c.type,
          hari: c.hari,
          keterangan: c.keterangan,
          priority: c.priority,
        })),
      });
    }

    return result;
  }

  private static formatDraftResponse(draft: any) {
    return {
      ...draft,
      tanggal: draft.tanggal
        ? JadwalHelper.convertToJakartaTimezone(new Date(draft.tanggal))
        : null,
      waktu_mulai: draft.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(new Date(draft.waktu_mulai))
        : null,
      waktu_selesai: draft.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(new Date(draft.waktu_selesai))
        : null,
    };
  }
}
