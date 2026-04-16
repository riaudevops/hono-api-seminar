import prisma from '../infrastructures/db.infrastructure';
import { APIError } from '../utils/api-error.util';
import { PenilaiRole } from '@prisma/client';

export interface CreateKomponenInput {
  id: string;
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
  /**
   * Mengambil semua komponen penilaian, opsional difilter berdasarkan role
   */
  public static async getAll(role?: PenilaiRole) {
    const komponen = await prisma.komponen_penilaian.findMany({
      where: role ? { role } : undefined,
      orderBy: [{ role: 'asc' }, { is_aktif: 'desc' }, { id: 'asc' }],
    });

    return {
      response: true,
      message: 'Data komponen penilaian berhasil diambil',
      data: komponen,
    };
  }

  /**
   * Mengambil daftar komponen penilaian yang sedang aktif untuk suatu role
   */
  public static async getActiveByRole(role: PenilaiRole) {
    const komponen = await prisma.komponen_penilaian.findMany({
      where: { role, is_aktif: true },
      orderBy: { id: 'asc' },
    });

    return {
      response: true,
      message: `Data komponen penilaian aktif untuk role ${role} berhasil diambil`,
      data: komponen,
    };
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
    // Pastikan ID unik
    const existing = await prisma.komponen_penilaian.findUnique({
      where: { id: data.id },
    });
    if (existing) {
      throw new APIError(`Komponen dengan ID ${data.id} sudah ada.`, 400);
    }

    // Jika komponen akan langsung diaktifkan, validasi total persentasenya
    if (data.is_aktif !== false) {
      await this.validatePercentageLimit(data.role, data.persentase);
    }

    const newComponent = await prisma.komponen_penilaian.create({
      data: {
        id: data.id,
        nama: data.nama,
        persentase: data.persentase,
        is_aktif: data.is_aktif ?? true,
        role: data.role,
      },
    });

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
      await this.validatePercentageLimit(roleToAsses, persentaseToAsses, id);
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
      await this.validatePercentageLimit(
        existing.role,
        existing.persentase,
        id
      );
    }

    const updatedComponent = await prisma.komponen_penilaian.update({
      where: { id },
      data: { is_aktif },
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

    return {
      response: true,
      message: 'Status komponen penilaian berhasil diubah',
      data: updatedComponent,
      warning: warningMsg,
    };
  }
}
