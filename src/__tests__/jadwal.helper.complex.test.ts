/**
 * Complex Unit Tests — JadwalHelper (generateId + timezone round-trips)
 *
 * Tests `generateId` with a mocked JadwalRepository, and verifies
 * timezone conversion functions.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ─── Mock State ──────────────────────────────────────────────────────────────
let mockLastId: string | null = null;
let findLastCalls: string[] = [];

// Mock JadwalRepository
mock.module('../modules/jadwal', () => ({
  JadwalRepository: {
    findLastIdByPrefix: (prefix: string) => {
      findLastCalls.push(prefix);
      return Promise.resolve(mockLastId);
    },
  },
}));

// ─── Import ──────────────────────────────────────────────────────────────────
import JadwalHelper from '../helpers/jadwal.helper';

// =============================================================================
// Tests
// =============================================================================

describe('JadwalHelper.generateId', () => {
  beforeEach(() => {
    mockLastId = null;
    findLastCalls = [];
  });

  test('menghasilkan ID dengan format prefix + 3 digit', async () => {
    const id = await JadwalHelper.generateId('SEMKP');

    // Format: J{singkatan}{tahunAkademik}{3-digit nomor}
    // Contoh: JKP2526001
    expect(id).toMatch(/^JKP\d{7}$/);
  });

  test('memanggil findLastIdByPrefix dengan prefix yang benar', async () => {
    await JadwalHelper.generateId('SEMKP');

    expect(findLastCalls.length).toBe(1);
    expect(findLastCalls[0]).toMatch(/^JKP\d{4}$/);
  });

  test('ketika tidak ada data sebelumnya → nomor mulai 001', async () => {
    mockLastId = null;

    const id = await JadwalHelper.generateId('SEMKP');

    expect(id).toContain('001');
  });

  test('ketika ada data terakhir → nomor berikutnya', async () => {
    mockLastId = 'JKP2526005';

    const id = await JadwalHelper.generateId('SEMKP');

    expect(id).toContain('006');
  });

  test('ID unik untuk setiap panggilan', async () => {
    mockLastId = 'JKP2526010';
    const id1 = await JadwalHelper.generateId('SEMKP');
    mockLastId = null; // reset for second call
    const id2 = await JadwalHelper.generateId('SEMKP');

    expect(id1).not.toBe(id2);
  });

  test('singkatan kode berbeda menghasilkan prefix berbeda', async () => {
    const idKp = await JadwalHelper.generateId('SEMKP');
    const idTapro = await JadwalHelper.generateId('SEMPRO');

    expect(idKp).toContain('KP');
    expect(idTapro).toContain('TAPRO');
  });
});

// =============================================================================
// Timezone Tests
// =============================================================================
describe('JadwalHelper timezone functions', () => {
  test('convertToJakartaTimezone mengubah UTC ke representasi WIB', () => {
    // UTC 03:00 → WIB 10:00 (+7)
    const date = new Date('2026-06-13T03:00:00.000Z');
    const jakarta = JadwalHelper.convertToJakartaTimezone(date);

    expect(jakarta).toBeInstanceOf(Date);
    expect(jakarta.getHours()).toBe(10);
  });

  test('formatDateInJakarta format YYYY-MM-DD', () => {
    const date = new Date('2026-12-25T01:00:00.000Z'); // +7 = 08:00
    expect(JadwalHelper.formatDateInJakarta(date)).toBe('2026-12-25');
  });

  test('formatTimeInJakarta format HH:MM', () => {
    const date = new Date('2026-12-25T01:00:00.000Z'); // +7 = 08:00
    expect(JadwalHelper.formatTimeInJakarta(date)).toBe('08:00');
  });

  test('getCurrentJakartaTime menghasilkan Date', () => {
    const now = JadwalHelper.getCurrentJakartaTime();
    expect(now).toBeInstanceOf(Date);
  });

  test('createDateFromJakartaDate menghasilkan Date', () => {
    const date = JadwalHelper.createDateFromJakartaDate('2026-06-13');
    expect(date).toBeInstanceOf(Date);
  });

  test('createDateFromJakartaDateTime menghasilkan Date', () => {
    const date = JadwalHelper.createDateFromJakartaDateTime(
      '2026-06-13',
      '08:00'
    );
    expect(date).toBeInstanceOf(Date);
  });
});
