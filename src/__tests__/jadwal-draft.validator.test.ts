import { describe, test, expect } from 'bun:test';
import { generateJadwalSchema } from '../modules/jadwal-draft/jadwal-draft.validator';

const baseMahasiswa = {
  nim: '12250111234',
  kode_jenis: 'SEMKP',
  list_dosen: [{ nip: '197001012000031001', role: 'KP_PEMBIMBING' }],
};

const basePayload = {
  tanggal_mulai: '2026-06-20T00:00:00.000Z',
  list_mahasiswa: [baseMahasiswa],
};

describe('generateJadwalSchema — field dasar', () => {
  test('payload minimal valid', () => {
    const result = generateJadwalSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  test('tanggal_mulai bukan ISO ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      tanggal_mulai: '20-06-2026',
    });
    expect(result.success).toBe(false);
  });

  test('list_mahasiswa kosong ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      list_mahasiswa: [],
    });
    expect(result.success).toBe(false);
  });

  test('kode_jenis mengandung spasi ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      list_mahasiswa: [{ ...baseMahasiswa, kode_jenis: 'SEM KP' }],
    });
    expect(result.success).toBe(false);
  });

  test('kode_jenis huruf kecil ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      list_mahasiswa: [{ ...baseMahasiswa, kode_jenis: 'semkp' }],
    });
    expect(result.success).toBe(false);
  });

  test('list_dosen kosong ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      list_mahasiswa: [{ ...baseMahasiswa, list_dosen: [] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('generateJadwalSchema — field mode', () => {
  test('mode default adalah semua', () => {
    const result = generateJadwalSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe('semua');
  });

  test('mode semua valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'semua',
    });
    expect(result.success).toBe(true);
  });

  test('mode hanya_kp valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'hanya_kp',
    });
    expect(result.success).toBe(true);
  });

  test('mode hanya_ta valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'hanya_ta',
    });
    expect(result.success).toBe(true);
  });

  test('mode tanpa_constraint tidak lagi valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'tanpa_constraint',
    });
    expect(result.success).toBe(false);
  });

  test('mode tidak dikenal ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('generateJadwalSchema — field dengan_constraint', () => {
  test('dengan_constraint default adalah true', () => {
    const result = generateJadwalSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dengan_constraint).toBe(true);
  });

  test('dengan_constraint false valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      dengan_constraint: false,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dengan_constraint).toBe(false);
  });

  test('dengan_constraint true eksplisit valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      dengan_constraint: true,
    });
    expect(result.success).toBe(true);
  });

  test('dengan_constraint string ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      dengan_constraint: 'yes',
    });
    expect(result.success).toBe(false);
  });

  test('mode hanya_kp + dengan_constraint false valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      mode: 'hanya_kp',
      dengan_constraint: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('generateJadwalSchema — tanggal_mulai tidak boleh di masa lalu', () => {
  test('tanggal di masa lalu ditolak', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      tanggal_mulai: '2020-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  test('tanggal di masa depan valid', () => {
    const result = generateJadwalSchema.safeParse({
      ...basePayload,
      tanggal_mulai: '2030-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});
