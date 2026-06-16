import { describe, expect, test } from 'bun:test';
import { PenilaiRole } from '@prisma/client';
import {
  createKomponenPenilaianSchema,
  getAllKomponenPenilaianQuerySchema,
  getKomponenByRoleQuerySchema,
  updateKomponenPenilaianSchema,
} from '../modules/komponen-penilaian/komponen-penilaian.validator';

describe('komponen penilaian validator — jenis seminar + role', () => {
  test('create wajib menyertakan id_jenis_seminar', () => {
    const result = createKomponenPenilaianSchema.safeParse({
      nama: 'Penguasaan Materi',
      persentase: 40,
      role: PenilaiRole.TA_PENGUJI_1,
    });

    expect(result.success).toBe(false);
  });

  test('create valid dengan role dan id_jenis_seminar', () => {
    const result = createKomponenPenilaianSchema.safeParse({
      nama: 'Penguasaan Materi',
      persentase: 40,
      role: PenilaiRole.TA_PENGUJI_1,
      id_jenis_seminar: 'jenis-seminar-1',
    });

    expect(result.success).toBe(true);
  });

  test('update dapat memindahkan komponen ke jenis seminar lain', () => {
    const result = updateKomponenPenilaianSchema.safeParse({
      id_jenis_seminar: 'jenis-seminar-2',
    });

    expect(result.success).toBe(true);
  });

  test('query list menerima filter jenis_seminar', () => {
    const result = getAllKomponenPenilaianQuerySchema.safeParse({
      role: PenilaiRole.TA_PENGUJI_1,
      jenis_seminar: 'SIDANG_LAPORAN',
      is_aktif: 'true',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_aktif).toBe(true);
    }
  });

  test('query role menerima filter jenis_seminar', () => {
    const result = getKomponenByRoleQuerySchema.safeParse({
      jenis_seminar: 'SIDANG_LAPORAN',
    });

    expect(result.success).toBe(true);
  });
});
