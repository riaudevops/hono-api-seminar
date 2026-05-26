import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import { APIError } from '../../utils/api-error.util';
import redisService from '../../infrastructures/redis.infrastructure';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { LogService } from '../log';
import BobotPenilaianRoleRepository from './bobot-penilaian-role.repository';
import type {
  UpdateSingleBobotInput,
  UpsertBobotPenilaianRoleInput,
} from './bobot-penilaian-role.type';

const CACHE_TTL_SECONDS = 1_800;

export default class BobotPenilaianRoleService {
  public static async getAll() {
    return redisService.remember(
      'bobot-penilaian-role:all',
      CACHE_TTL_SECONDS,
      async () => {
        const data = await BobotPenilaianRoleRepository.findAll();
        return {
          response: true,
          message: 'Data bobot penilaian role berhasil diambil.',
          data,
        };
      }
    );
  }

  public static async getByJenisSeminar(id_jenis_seminar: string) {
    return redisService.remember(
      `bobot-penilaian-role:jenis-seminar:${id_jenis_seminar}`,
      CACHE_TTL_SECONDS,
      async () => {
        const jenis = await prisma.jenis_seminar.findUnique({
          where: { id: id_jenis_seminar },
          select: { id: true, kode: true, nama: true },
        });
        if (!jenis) {
          throw new APIError(
            `Jenis seminar dengan id ${id_jenis_seminar} tidak ditemukan.`,
            404
          );
        }
        const data =
          await BobotPenilaianRoleRepository.findByJenisSeminar(
            id_jenis_seminar
          );
        const total = data.reduce((sum, b) => sum + b.persentase, 0);
        return {
          response: true,
          message: 'Bobot penilaian role berhasil diambil.',
          data: {
            jenis_seminar: jenis,
            bobot: data,
            total_persentase: total,
            is_complete: total === 100,
          },
        };
      }
    );
  }

  public static async upsertBatch(
    payload: UpsertBobotPenilaianRoleInput,
    actor?: { actor_type: LogActorType; actor_id: string }
  ) {
    const jenis = await prisma.jenis_seminar.findUnique({
      where: { id: payload.id_jenis_seminar },
    });
    if (!jenis) {
      throw new APIError(
        `Jenis seminar dengan id ${payload.id_jenis_seminar} tidak ditemukan.`,
        404
      );
    }

    const total = payload.bobot.reduce((sum, b) => sum + b.persentase, 0);
    if (total !== 100) {
      throw new APIError(
        `Total persentase harus 100%. Sekarang total = ${total}%.`,
        400
      );
    }

    const existing = await BobotPenilaianRoleRepository.findByJenisSeminar(
      payload.id_jenis_seminar
    );

    const rows = payload.bobot.map((item) => ({
      id_jenis_seminar: payload.id_jenis_seminar,
      role: item.role,
      persentase: item.persentase,
    }));

    const result = await prisma.$transaction(async (tx) => {
      await tx.bobot_penilaian_role.deleteMany({
        where: { id_jenis_seminar: payload.id_jenis_seminar },
      });
      if (rows.length > 0) {
        await tx.bobot_penilaian_role.createMany({ data: rows });
      }
      return tx.bobot_penilaian_role.findMany({
        where: { id_jenis_seminar: payload.id_jenis_seminar },
        orderBy: { role: 'asc' },
      });
    });

    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: actor?.actor_type ?? LogActorType.KOORDINATOR,
      actor_id: actor?.actor_id ?? 'system',
      entity_type: LogEntityType.BOBOT_PENILAIAN_ROLE,
      entity_id: payload.id_jenis_seminar,
      old_values: { bobot: existing },
      new_values: { bobot: result },
    });

    await CacheInvalidation.invalidateBobotPenilaianRole();

    return {
      response: true,
      message: 'Bobot penilaian role berhasil disimpan.',
      data: {
        id_jenis_seminar: payload.id_jenis_seminar,
        bobot: result,
        total_persentase: total,
        is_complete: total === 100,
      },
    };
  }

  public static async updateSingle(
    id: string,
    payload: UpdateSingleBobotInput,
    actor?: { actor_type: LogActorType; actor_id: string }
  ) {
    const existing = await BobotPenilaianRoleRepository.findById(id);
    if (!existing) {
      throw new APIError(
        `Bobot penilaian role dengan id ${id} tidak ditemukan.`,
        404
      );
    }

    const siblings = await BobotPenilaianRoleRepository.findByJenisSeminar(
      existing.id_jenis_seminar
    );
    const newTotal = siblings.reduce(
      (sum, b) => sum + (b.id === id ? payload.persentase : b.persentase),
      0
    );
    if (newTotal > 100) {
      throw new APIError(
        `Total persentase melebihi 100%. Sekarang akan menjadi ${newTotal}%.`,
        400
      );
    }

    const updated = await BobotPenilaianRoleRepository.updatePersentase(
      id,
      payload.persentase
    );

    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: actor?.actor_type ?? LogActorType.KOORDINATOR,
      actor_id: actor?.actor_id ?? 'system',
      entity_type: LogEntityType.BOBOT_PENILAIAN_ROLE,
      entity_id: id,
      old_values: existing,
      new_values: updated,
    });

    await CacheInvalidation.invalidateBobotPenilaianRole();

    return {
      response: true,
      message: 'Persentase bobot role berhasil diperbarui.',
      data: {
        ...updated,
        total_persentase_jenis_seminar: newTotal,
        is_complete: newTotal === 100,
      },
    };
  }

  public static async deleteOne(
    id: string,
    actor?: { actor_type: LogActorType; actor_id: string }
  ) {
    const existing = await BobotPenilaianRoleRepository.findById(id);
    if (!existing) {
      throw new APIError(
        `Bobot penilaian role dengan id ${id} tidak ditemukan.`,
        404
      );
    }

    await BobotPenilaianRoleRepository.destroy(id);

    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: actor?.actor_type ?? LogActorType.KOORDINATOR,
      actor_id: actor?.actor_id ?? 'system',
      entity_type: LogEntityType.BOBOT_PENILAIAN_ROLE,
      entity_id: id,
      old_values: existing,
    });

    await CacheInvalidation.invalidateBobotPenilaianRole();

    return {
      response: true,
      message: 'Bobot penilaian role berhasil dihapus.',
    };
  }
}
