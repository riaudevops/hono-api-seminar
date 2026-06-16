import { describe, expect, test } from 'bun:test';
import { getKomponenPenilaianSayaQuerySchema } from '../modules/dosen-seminar/dosen-seminar.validator';

describe('dosen seminar validator', () => {
  test('query komponen penilaian saya valid jika id_jenis_seminar dan jadwal_id ada', () => {
    const result = getKomponenPenilaianSayaQuerySchema.safeParse({
      id_jenis_seminar: 'jenis-seminar-1',
      jadwal_id: 'jadwal-1',
    });

    expect(result.success).toBe(true);
  });

  test('query komponen penilaian saya invalid jika id_jenis_seminar tidak ada', () => {
    const result = getKomponenPenilaianSayaQuerySchema.safeParse({
      jadwal_id: 'jadwal-1',
    });

    expect(result.success).toBe(false);
  });

  test('query komponen penilaian saya invalid jika jadwal_id tidak ada', () => {
    const result = getKomponenPenilaianSayaQuerySchema.safeParse({
      id_jenis_seminar: 'jenis-seminar-1',
    });

    expect(result.success).toBe(false);
  });
});
