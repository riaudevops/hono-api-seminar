import { describe, test, expect } from 'bun:test';
import JadwalHelper from '../helpers/jadwal.helper';

describe('JadwalHelper.singkatanKode', () => {
  test('SEMKP → KP', () => {
    expect(JadwalHelper.singkatanKode('SEMKP')).toBe('KP');
  });

  test('SEMPRO → TAPRO', () => {
    expect(JadwalHelper.singkatanKode('SEMPRO')).toBe('TAPRO');
  });

  test('SEMHAS_LAPORAN → TAHLP', () => {
    expect(JadwalHelper.singkatanKode('SEMHAS_LAPORAN')).toBe('TAHLP');
  });

  test('SEMHAS_PAPERBASED → TAHPB', () => {
    expect(JadwalHelper.singkatanKode('SEMHAS_PAPERBASED')).toBe('TAHPB');
  });

  test('SIDANG_LAPORAN → TASLP', () => {
    expect(JadwalHelper.singkatanKode('SIDANG_LAPORAN')).toBe('TASLP');
  });

  test('SIDANG_PAPERBASED → TASPB', () => {
    expect(JadwalHelper.singkatanKode('SIDANG_PAPERBASED')).toBe('TASPB');
  });

  test('unknown kode → JNS', () => {
    expect(JadwalHelper.singkatanKode('UNKNOWN')).toBe('JNS');
  });

  test('empty string → JNS', () => {
    expect(JadwalHelper.singkatanKode('')).toBe('JNS');
  });
});

describe('JadwalHelper.formatDateInJakarta', () => {
  test('formats UTC date as Jakarta date (YYYY-MM-DD)', () => {
    // 2026-01-01T00:00:00Z = 2026-01-01T07:00:00+07:00 → 2026-01-01
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(JadwalHelper.formatDateInJakarta(date)).toBe('2026-01-01');
  });

  test('date near midnight UTC shifts correctly to Jakarta', () => {
    // 2026-06-12T18:00:00Z = 2026-06-13T01:00:00+07:00 → 2026-06-13
    const date = new Date('2026-06-12T18:00:00.000Z');
    expect(JadwalHelper.formatDateInJakarta(date)).toBe('2026-06-13');
  });

  test('returns string in YYYY-MM-DD format', () => {
    const date = new Date('2026-03-15T10:00:00.000Z');
    expect(JadwalHelper.formatDateInJakarta(date)).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});

describe('JadwalHelper.formatTimeInJakarta', () => {
  test('formats UTC time as Jakarta time (HH:MM)', () => {
    // 2026-01-01T01:00:00Z = 2026-01-01T08:00:00+07:00 → 08:00
    const date = new Date('2026-01-01T01:00:00.000Z');
    expect(JadwalHelper.formatTimeInJakarta(date)).toBe('08:00');
  });

  test('returns string in HH:MM format', () => {
    const date = new Date('2026-06-13T03:00:00.000Z');
    expect(JadwalHelper.formatTimeInJakarta(date)).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('JadwalHelper.convertToJakartaTimezone', () => {
  test('returns a Date object', () => {
    const date = new Date('2026-06-13T00:00:00.000Z');
    expect(JadwalHelper.convertToJakartaTimezone(date)).toBeInstanceOf(Date);
  });

  test('UTC midnight becomes Jakarta 07:00', () => {
    // 2026-01-01T00:00:00Z → Jakarta 07:00:00 → local representation
    const date = new Date('2026-01-01T00:00:00.000Z');
    const jakarta = JadwalHelper.convertToJakartaTimezone(date);
    // The converted date local hours should reflect +7
    expect(jakarta.getHours()).toBe(7);
  });
});
