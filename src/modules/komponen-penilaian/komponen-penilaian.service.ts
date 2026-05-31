import prisma from '../../infrastructures/db.infrastructure';
import { APIError } from '../../utils/api-error.util';
import redisService from '../../infrastructures/redis.infrastructure';
import CacheInvalidation from '../../utils/cache-invalidation.util';
import { hashCacheKey } from '../../utils/cache-key.util';
import {
  LogActionType,
  LogActorType,
  LogEntityType,
  type PenilaiRole,
  Prisma,
} from '@prisma/client';
import { LogService } from '../log';

export interface CreateKomponenInput {
  nama: string;
  persentase: number;
  is_aktif?: boolean;
  role: PenilaiRole;
}

export interface UpdateKomponenInput {
  nama?: string;
  persentase?: number;
  is_aktif?: boolean;
  role?: PenilaiRole;
}

export default class KomponenPenilaianService {
  private static getIdPrefixByRole(role: PenilaiRole): string {
    const prefixMap: Record<PenilaiRole, string> = {
      KP_PEMBIMBING: 'KP-A',
      KP_PENGUJI: 'KP-B',
      KP_INSTANSI: 'KP-C',
      TA_PEMBIMBING_1: 'TA-A',
      TA_PEMBIMBING_2: 'TA-B',
      TA_PENGUJI_1: 'TA-C',
      TA_PENGUJI_2: 'TA-D',
      TA_KETUA_SIDANG: 'TA-E',
    };

    return prefixMap[role];
  }

  private static async generateKomponenId(role: PenilaiRole): Promise<string> {
    const prefix = KomponenPenilaianService.getIdPrefixByRole(role);
    const idPrefix = `${prefix}-`;

    const existingIds = await prisma.komponen_penilaian.findMany({
      where: {
        id: {
          startsWith: idPrefix,
        },
      },
      select: {
        id: true,
      },
    });

    const maxSequence = existingIds.reduce((max, item) => {
      const sequenceRaw = item.id.split('-').at(-1);
      const sequence = Number(sequenceRaw);

      if (Number.isNaN(sequence)) {
        return max;
      }

      return Math.max(max, sequence);
    }, 0);

    const nextSequence = String(maxSequence + 1).padStart(2, '0');
    return `${prefix}-${nextSequence}`;
  }

  /**
   * Mengambil semua komponen penilaian, opsional difilter berdasarkan role dan status aktif
   */
  public static async getAll(
    filters: {
      role?: PenilaiRole;
      is_aktif?: boolean;
    } = {}
  ) {
    const cacheKey = `komponen-penilaian:list:${hashCacheKey(filters)}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const komponen = await prisma.komponen_penilaian.findMany({
        where: {
          ...(filters.role ? { role: filters.role } : {}),
          ...(filters.is_aktif !== undefined
            ? { is_aktif: filters.is_aktif }
            : {}),
        },
        orderBy: [{ role: 'asc' }, { is_aktif: 'desc' }, { id: 'asc' }],
      });

      return {
        response: true,
        message: 'Data komponen penilaian berhasil diambil',
        data: komponen,
      };
    });
  }

  /**
   * Mengambil komponen penilaian berdasarkan role.
   * Default hanya komponen yang aktif; teruskan `is_aktif: false` untuk inklusif.
   */
  public static async getByRole(
    role: PenilaiRole,
    options: { is_aktif?: boolean } = {}
  ) {
    const cacheKey = `komponen-penilaian:by-role:${role}:${hashCacheKey(options)}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const includeAll = options.is_aktif === false;
      const komponen = await prisma.komponen_penilaian.findMany({
        where: {
          role,
          ...(includeAll ? {} : { is_aktif: true }),
        },
        orderBy: [{ is_aktif: 'desc' }, { id: 'asc' }],
      });

      const total = komponen
        .filter((k) => k.is_aktif)
        .reduce((sum, k) => sum + k.persentase, 0);

      return {
        response: true,
        message: `Data komponen penilaian untuk role ${role} berhasil diambil`,
        data: {
          role,
          komponen,
          total_persentase_aktif: total,
          is_complete: total === 100,
        },
      };
    });
  }

  /**
   * Mengambil daftar komponen penilaian yang sedang aktif untuk suatu role
   */
  public static async getActiveByRole(role: PenilaiRole) {
    const cacheKey = `komponen-penilaian:active-by-role:${role}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const komponen = await prisma.komponen_penilaian.findMany({
        where: { role, is_aktif: true },
        orderBy: { id: 'asc' },
      });

      return {
        response: true,
        message: `Data komponen penilaian aktif untuk role ${role} berhasil diambil`,
        data: komponen,
      };
    });
  }

  /**
   * Validasi persentase komponen penilaian untuk suatu role.
   * Total persentase dari komponen yang 'is_aktif = true' tidak boleh melebih 100%.
   */
  private static async validatePercentageLimit(
    role: PenilaiRole,
    newPersentase: number,
    excludeId?: string
  ) {
    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        role,
        is_aktif: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    const currentTotal = activeComponents.reduce(
      (sum, comp) => sum + comp.persentase,
      0
    );
    const newTotal = currentTotal + newPersentase;

    if (newTotal > 100) {
      throw new APIError(
        `Total persentase komponen aktif untuk role ${role} melebihi 100%. Saat ini sudah ${currentTotal}%, Anda mencoba menambah/mengubah menjadi ${newPersentase}%. (Total: ${newTotal}%)`,
        400
      );
    }

    return newTotal;
  }

  /**
   * Membuat komponen penilaian baru
   */
  public static async create(data: CreateKomponenInput) {
    // Jika komponen akan langsung diaktifkan, validasi total persentasenya
    if (data.is_aktif !== false) {
      await KomponenPenilaianService.validatePercentageLimit(
        data.role,
        data.persentase
      );
    }

    let newComponent: Awaited<
      ReturnType<typeof prisma.komponen_penilaian.create>
    > | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const generatedId = await KomponenPenilaianService.generateKomponenId(
        data.role
      );

      try {
        newComponent = await prisma.komponen_penilaian.create({
          data: {
            id: generatedId,
            nama: data.nama,
            persentase: data.persentase,
            is_aktif: data.is_aktif ?? true,
            role: data.role,
          },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!newComponent) {
      throw new APIError('Gagal membuat ID komponen penilaian unik', 500);
    }

    await LogService.createEntityLog({
      action: LogActionType.CREATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KOMPONEN_PENILAIAN,
      entity_id: newComponent.id,
      new_values: newComponent,
    });

    await CacheInvalidation.invalidateKomponenPenilaian();

    return {
      response: true,
      message: 'Komponen penilaian berhasil dibuat',
      data: newComponent,
    };
  }

  /**
   * Memperbarui komponen penilaian
   */
  public static async update(id: string, data: UpdateKomponenInput) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

    const persentaseToAsses = data.persentase ?? existing.persentase;
    const isAktifToAsses = data.is_aktif ?? existing.is_aktif;
    const roleToAsses = data.role ?? existing.role;

    // Jika komponen akan berakhir dalam status aktif, validasi total persentasenya
    if (isAktifToAsses) {
      await KomponenPenilaianService.validatePercentageLimit(
        roleToAsses,
        persentaseToAsses,
        id
      );
    }

    const updatedComponent = await prisma.komponen_penilaian.update({
      where: { id },
      data: {
        nama: data.nama,
        persentase: data.persentase,
        is_aktif: data.is_aktif,
        role: data.role,
      },
    });
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KOMPONEN_PENILAIAN,
      entity_id: id,
      old_values: existing,
      new_values: updatedComponent,
    });

    await CacheInvalidation.invalidateKomponenPenilaian();

    return {
      response: true,
      message: 'Komponen penilaian berhasil diperbarui',
      data: updatedComponent,
    };
  }

  /**
   * Menghapus komponen penilaian
   */
  public static async delete(id: string) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

    // Check if it's already used in detail_penilaian
    const usage = await prisma.detail_penilaian.findFirst({
      where: { id_komponen: id },
    });

    if (usage) {
      throw new APIError(
        `Komponen dengan ID ${id} tidak dapat dihapus karena sudah ada data penilaian yang menggunakannya. Nonaktifkan saja komponen ini.`,
        400
      );
    }

    await prisma.komponen_penilaian.delete({
      where: { id },
    });
    await LogService.createEntityLog({
      action: LogActionType.DELETE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KOMPONEN_PENILAIAN,
      entity_id: id,
      old_values: existing,
    });

    await CacheInvalidation.invalidateKomponenPenilaian();

    return {
      response: true,
      message: 'Komponen penilaian berhasil dihapus',
    };
  }

  /**
   * Mengubah status aktif komponen penilaian (Toggle)
   */
  public static async toggleStatus(id: string, is_aktif: boolean) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

    // Jika diaktifkan, pastikan totalnya tidak lebih dari 100%
    if (is_aktif) {
      await KomponenPenilaianService.validatePercentageLimit(
        existing.role,
        existing.persentase,
        id
      );
    }

    const updatedComponent = await prisma.komponen_penilaian.update({
      where: { id },
      data: { is_aktif },
    });
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.KOORDINATOR,
      actor_id: 'system',
      entity_type: LogEntityType.KOMPONEN_PENILAIAN,
      entity_id: id,
      old_values: existing,
      new_values: updatedComponent,
    });

    // Validasi apakah setelah toggle, totalnya menjadi kurang dari 100%
    // (Peringatan saja, karena secara fungsional boleh dinonaktifkan sementara)
    let warningMsg = null;
    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: { role: existing.role, is_aktif: true },
    });
    const currentTotal = activeComponents.reduce(
      (sum, comp) => sum + comp.persentase,
      0
    );

    if (currentTotal < 100) {
      warningMsg = `Total persentase komponen aktif untuk role ${existing.role} sekarang adalah ${currentTotal}%. Anda perlu menambah atau mengaktifkan komponen lain agar mencapai 100%.`;
    }

    await CacheInvalidation.invalidateKomponenPenilaian();

    return {
      response: true,
      message: 'Status komponen penilaian berhasil diubah',
      data: updatedComponent,
      warning: warningMsg,
    };
  }
}
