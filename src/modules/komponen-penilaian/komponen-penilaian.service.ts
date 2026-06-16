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
  id_jenis_seminar: string;
}

export interface UpdateKomponenInput {
  nama?: string;
  persentase?: number;
  is_aktif?: boolean;
  role?: PenilaiRole;
  id_jenis_seminar?: string;
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
      ARTIKEL_TA: 'TA-F',
    };

    return prefixMap[role];
  }

  private static async getJenisSeminarOrThrow(id_jenis_seminar: string) {
    const jenis = await prisma.jenis_seminar.findUnique({
      where: { id: id_jenis_seminar },
      select: { id: true, kode: true, nama: true },
    });

    if (!jenis) {
      throw new APIError(
        `Jenis seminar dengan id ${id_jenis_seminar} tidak ditemukan`,
        404
      );
    }

    return jenis;
  }

  private static async resolveJenisSeminarIdByKode(
    kode: string
  ): Promise<string> {
    const jenis = await prisma.jenis_seminar.findUnique({
      where: { kode },
      select: { id: true },
    });

    if (!jenis) {
      throw new APIError(
        `Jenis seminar dengan kode ${kode} tidak ditemukan`,
        404
      );
    }

    return jenis.id;
  }

  private static buildJenisPrefix(kode: string) {
    const explicitPrefix: Record<string, string> = {
      SEMKP: 'SEMKP',
      SEMPRO: 'SEMP',
      SEMHAS_LAPORAN: 'SHL',
      SEMHAS_PAPERBASED: 'SHP',
      SIDANG_LAPORAN: 'SDL',
      SIDANG_PAPERBASED: 'SDP',
    };

    return explicitPrefix[kode] ?? kode.replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  private static async generateKomponenId(
    id_jenis_seminar: string,
    role: PenilaiRole
  ): Promise<string> {
    const jenis =
      await KomponenPenilaianService.getJenisSeminarOrThrow(id_jenis_seminar);
    const prefix = `${KomponenPenilaianService.buildJenisPrefix(
      jenis.kode
    )}-${KomponenPenilaianService.getIdPrefixByRole(role)}`;
    const idPrefix = `${prefix}-`;

    const existingIds = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar,
        role,
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
   * Mengambil semua komponen penilaian, opsional difilter berdasarkan jenis seminar, role, dan status aktif.
   */
  public static async getAll(
    filters: {
      role?: PenilaiRole;
      jenis_seminar?: string;
      is_aktif?: boolean;
    } = {}
  ) {
    let idJenisSeminar: string | undefined;
    if (filters.jenis_seminar) {
      idJenisSeminar =
        await KomponenPenilaianService.resolveJenisSeminarIdByKode(
          filters.jenis_seminar
        );
    }

    const cacheKey = `komponen-penilaian:list:${hashCacheKey({ ...filters, jenis_seminar: filters.jenis_seminar })}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const komponen = await prisma.komponen_penilaian.findMany({
        where: {
          ...(filters.role ? { role: filters.role } : {}),
          ...(idJenisSeminar ? { id_jenis_seminar: idJenisSeminar } : {}),
          ...(filters.is_aktif !== undefined
            ? { is_aktif: filters.is_aktif }
            : {}),
        },
        include: {
          jenis_seminar: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: [
          { id_jenis_seminar: 'asc' },
          { role: 'asc' },
          { is_aktif: 'desc' },
          { id: 'asc' },
        ],
      });

      return {
        response: true,
        message: 'Data komponen penilaian berhasil diambil',
        data: komponen,
      };
    });
  }

  /**
   * Mengambil komponen penilaian berdasarkan role, opsional dipersempit dengan jenis seminar.
   * Default hanya komponen yang aktif; teruskan `is_aktif: false` untuk inklusif.
   */
  public static async getByRole(
    role: PenilaiRole,
    options: { is_aktif?: boolean; jenis_seminar?: string } = {}
  ) {
    let idJenisSeminar: string | undefined;
    if (options.jenis_seminar) {
      idJenisSeminar =
        await KomponenPenilaianService.resolveJenisSeminarIdByKode(
          options.jenis_seminar
        );
    }

    const cacheKey = `komponen-penilaian:by-role:${role}:${hashCacheKey(options)}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const includeAll = options.is_aktif === false;
      const komponen = await prisma.komponen_penilaian.findMany({
        where: {
          role,
          ...(idJenisSeminar ? { id_jenis_seminar: idJenisSeminar } : {}),
          ...(includeAll ? {} : { is_aktif: true }),
        },
        include: {
          jenis_seminar: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: [
          { id_jenis_seminar: 'asc' },
          { is_aktif: 'desc' },
          { id: 'asc' },
        ],
      });

      const totalByJenis = komponen.reduce<Record<string, number>>((acc, k) => {
        if (!k.is_aktif) return acc;
        acc[k.id_jenis_seminar] = (acc[k.id_jenis_seminar] ?? 0) + k.persentase;
        return acc;
      }, {});

      return {
        response: true,
        message: `Data komponen penilaian untuk role ${role} berhasil diambil`,
        data: {
          role,
          jenis_seminar: options.jenis_seminar,
          id_jenis_seminar: idJenisSeminar,
          komponen,
          total_persentase_aktif: idJenisSeminar
            ? (totalByJenis[idJenisSeminar] ?? 0)
            : totalByJenis,
          is_complete: idJenisSeminar
            ? (totalByJenis[idJenisSeminar] ?? 0) === 100
            : Object.values(totalByJenis).every((total) => total === 100),
        },
      };
    });
  }

  /**
   * Mengambil daftar komponen penilaian aktif untuk suatu jenis seminar + role.
   */
  public static async getActiveByJenisAndRole(
    id_jenis_seminar: string,
    role: PenilaiRole
  ) {
    const cacheKey = `komponen-penilaian:active-by-jenis-role:${id_jenis_seminar}:${role}`;
    return redisService.remember(cacheKey, 1_800, async () => {
      const komponen = await prisma.komponen_penilaian.findMany({
        where: { id_jenis_seminar, role, is_aktif: true },
        orderBy: { id: 'asc' },
      });

      return {
        response: true,
        message: `Data komponen penilaian aktif untuk jenis seminar ${id_jenis_seminar} dan role ${role} berhasil diambil`,
        data: komponen,
      };
    });
  }

  /**
   * Validasi persentase komponen penilaian untuk suatu jenis seminar + role.
   * Total persentase dari komponen yang 'is_aktif = true' tidak boleh melebih 100%.
   */
  private static async validatePercentageLimit(
    id_jenis_seminar: string,
    role: PenilaiRole,
    newPersentase: number,
    excludeId?: string
  ) {
    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar,
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
        `Total persentase komponen aktif untuk jenis seminar ${id_jenis_seminar} dan role ${role} melebihi 100%. Saat ini sudah ${currentTotal}%, Anda mencoba menambah/mengubah menjadi ${newPersentase}%. (Total: ${newTotal}%)`,
        400
      );
    }

    return newTotal;
  }

  /**
   * Membuat komponen penilaian baru.
   */
  public static async create(data: CreateKomponenInput) {
    await KomponenPenilaianService.getJenisSeminarOrThrow(
      data.id_jenis_seminar
    );

    if (data.is_aktif !== false) {
      await KomponenPenilaianService.validatePercentageLimit(
        data.id_jenis_seminar,
        data.role,
        data.persentase
      );
    }

    let newComponent: Awaited<
      ReturnType<typeof prisma.komponen_penilaian.create>
    > | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const generatedId = await KomponenPenilaianService.generateKomponenId(
        data.id_jenis_seminar,
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
            id_jenis_seminar: data.id_jenis_seminar,
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
   * Memperbarui komponen penilaian.
   */
  public static async update(id: string, data: UpdateKomponenInput) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

    const idJenisToAssess = data.id_jenis_seminar ?? existing.id_jenis_seminar;
    if (data.id_jenis_seminar) {
      await KomponenPenilaianService.getJenisSeminarOrThrow(
        data.id_jenis_seminar
      );
    }

    const persentaseToAssess = data.persentase ?? existing.persentase;
    const isAktifToAssess = data.is_aktif ?? existing.is_aktif;
    const roleToAssess = data.role ?? existing.role;

    if (isAktifToAssess) {
      await KomponenPenilaianService.validatePercentageLimit(
        idJenisToAssess,
        roleToAssess,
        persentaseToAssess,
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
        id_jenis_seminar: data.id_jenis_seminar,
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
   * Menghapus komponen penilaian.
   */
  public static async delete(id: string) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

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
   * Mengubah status aktif komponen penilaian (Toggle).
   */
  public static async toggleStatus(id: string, is_aktif: boolean) {
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(`Komponen dengan ID ${id} tidak ditemukan`, 404);
    }

    if (is_aktif) {
      await KomponenPenilaianService.validatePercentageLimit(
        existing.id_jenis_seminar,
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

    let warningMsg = null;
    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar: existing.id_jenis_seminar,
        role: existing.role,
        is_aktif: true,
      },
    });
    const currentTotal = activeComponents.reduce(
      (sum, comp) => sum + comp.persentase,
      0
    );

    if (currentTotal < 100) {
      warningMsg = `Total persentase komponen aktif untuk jenis seminar ${existing.id_jenis_seminar} dan role ${existing.role} sekarang adalah ${currentTotal}%. Anda perlu menambah atau mengaktifkan komponen lain agar mencapai 100%.`;
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
