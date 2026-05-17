import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LogActionType, LogActorType, StatusJadwalDraft } from '@prisma/client';
import { APIError } from '../../utils/api-error.util';
import { createLogger } from '../../utils/logger.util';
import { textMessage } from '../../utils/openrouter.util';
import openRouterService from '../../infrastructures/openrouter.infrastructure';
import prisma from '../../infrastructures/db.infrastructure';
import { GenerateBatchOutputSchema } from '../../prompts/output/schedule-schema';
import { getScheduleRulesAsText } from '../../prompts/context/schedule-rules';
import JadwalDraftRepository from './jadwal-draft.repository';
import JadwalRepository from '../../repositories/jadwal.repository';
import RuanganRepository from '../ruangan/ruangan.repository';
import ConstraintDosenRepository from '../../repositories/constraint-dosen.repository';
import PenilaianRepository from '../../repositories/penilaian.repository';
import JadwalService from '../../services/jadwal.service';
import { LogService } from '../../modules/log';
import JadwalHelper from '../../helpers/jadwal.helper';
import JenisSeminarHelper from '../../helpers/jenis-seminar.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import { LogJadwalContext } from '../../services/jadwal.service';
import {
  CreateJadwalDraftInput,
  UpdateDraftInput,
} from './jadwal-draft.type';

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
    data: {
      tanggal_mulai: Date;
      list_mahasiswa: Array<{
        nim: string;
        kode_jenis: string;
        list_dosen: { nip: string; role: any }[];
      }>;
      catatan_tambahan?: string;
    },
    context: LogJadwalContext
  ) {
    const batchId = generateBatchId();

    // Resolve kode_jenis → id_jenis_seminar sekali di depan
    const kodeSet = new Set<string>();
    for (const mhs of data.list_mahasiswa) kodeSet.add(mhs.kode_jenis);
    const kodeToId = new Map<string, string>();
    for (const kode of kodeSet) {
      kodeToId.set(kode, await JenisSeminarHelper.resolveIdByKode(kode));
    }

    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    // Validate mahasiswa + dosen + cek existing jadwal
    const allNips = new Set<string>();
    for (const mhs of data.list_mahasiswa) {
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

    const [ruanganList, existingJadwal, constraintList] = await Promise.all([
      RuanganRepository.findAktif(),
      JadwalRepository.findByDateRange(tanggalMulai, endDate),
      this.getConstraintsForNips([...allNips]),
    ]);

    const contextData = {
      tanggal_mulai: tanggalMulai.toISOString().slice(0, 10),
      list_mahasiswa: data.list_mahasiswa.map((m) => ({
        nim: m.nim,
        jenis: m.kode_jenis,
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
      ...(data.catatan_tambahan
        ? { catatan_tambahan: data.catatan_tambahan }
        : {}),
    };

    logger.info('Generating batch schedule', {
      batchId,
      mahasiswaCount: data.list_mahasiswa.length,
    });

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

    const drafts: CreateJadwalDraftInput[] = [];
    for (const s of result.data.suggestions) {
      const tanggalStr = `${s.tanggal}T00:00:00.000Z`;
      const mulaiStr = `${s.tanggal}T${s.waktu_mulai}:00.000Z`;
      const selesaiStr = `${s.tanggal}T${s.waktu_selesai}:00.000Z`;

      const mhsInput = data.list_mahasiswa.find(
        (m) => m.nim === s.nim && m.kode_jenis === s.jenis
      );

      const idJenis =
        kodeToId.get(s.jenis) ||
        (await JenisSeminarHelper.resolveIdByKode(s.jenis));

      drafts.push({
        batch_id: batchId,
        nim: s.nim,
        id_jenis_seminar: idJenis,
        tanggal: JadwalHelper.convertFromJakartaTimezone(new Date(tanggalStr)),
        waktu_mulai: JadwalHelper.convertFromJakartaTimezone(new Date(mulaiStr)),
        waktu_selesai: JadwalHelper.convertFromJakartaTimezone(
          new Date(selesaiStr)
        ),
        kode_ruangan: s.kode_ruangan,
        list_dosen: mhsInput?.list_dosen || [],
        llm_reasoning: { reasoning: s.reasoning },
        confidence: s.confidence,
      });
    }

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

          await tx.jadwal_draft.update({
            where: { id: draft.id },
            data: { status: StatusJadwalDraft.APPROVED },
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
