import { describe, test, expect } from 'bun:test';
import {
  SEMINAR_DURATION_MINUTES,
  OPERATING_HOURS,
  BREAK_TIME,
  WORK_DAYS,
  DAY_NAMES,
  getScheduleRulesAsText,
} from '../prompts/context/schedule-rules';

describe('SEMINAR_DURATION_MINUTES', () => {
  test('SEMKP berdurasi 60 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SEMKP']).toBe(60);
  });

  test('SEMPRO berdurasi 120 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SEMPRO']).toBe(120);
  });

  test('SEMHAS_LAPORAN berdurasi 120 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SEMHAS_LAPORAN']).toBe(120);
  });

  test('SEMHAS_PAPERBASED berdurasi 120 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SEMHAS_PAPERBASED']).toBe(120);
  });

  test('SIDANG_LAPORAN berdurasi 120 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SIDANG_LAPORAN']).toBe(120);
  });

  test('SIDANG_PAPERBASED berdurasi 120 menit', () => {
    expect(SEMINAR_DURATION_MINUTES['SIDANG_PAPERBASED']).toBe(120);
  });

  test('kode tidak dikenal menghasilkan undefined', () => {
    expect(SEMINAR_DURATION_MINUTES['UNKNOWN']).toBeUndefined();
  });
});

describe('OPERATING_HOURS', () => {
  test('jam mulai adalah 08:00', () => {
    expect(OPERATING_HOURS.start).toBe('08:00');
  });

  test('jam selesai adalah 17:00', () => {
    expect(OPERATING_HOURS.end).toBe('17:00');
  });
});

describe('BREAK_TIME', () => {
  test('jam istirahat mulai 12:00', () => {
    expect(BREAK_TIME.start).toBe('12:00');
  });

  test('jam istirahat selesai 13:00', () => {
    expect(BREAK_TIME.end).toBe('13:00');
  });

  test('durasi istirahat adalah 60 menit', () => {
    const [startH, startM] = BREAK_TIME.start.split(':').map(Number);
    const [endH, endM] = BREAK_TIME.end.split(':').map(Number);
    const durationMinutes = endH * 60 + endM - (startH * 60 + startM);
    expect(durationMinutes).toBe(60);
  });
});

describe('WORK_DAYS', () => {
  test('berisi 5 hari kerja', () => {
    expect(WORK_DAYS.length).toBe(5);
  });

  test('dimulai dari Senin (1)', () => {
    expect(WORK_DAYS[0]).toBe(1);
  });

  test('diakhiri Jumat (5)', () => {
    expect(WORK_DAYS[WORK_DAYS.length - 1]).toBe(5);
  });

  test('tidak mengandung Sabtu (6) atau Minggu (0)', () => {
    expect(WORK_DAYS).not.toContain(6);
    expect(WORK_DAYS).not.toContain(0);
  });
});

describe('DAY_NAMES', () => {
  test('hari 1 adalah Senin', () => {
    expect(DAY_NAMES[1]).toBe('Senin');
  });

  test('hari 5 adalah Jumat', () => {
    expect(DAY_NAMES[5]).toBe('Jumat');
  });

  test('semua hari kerja punya nama', () => {
    for (const day of WORK_DAYS) {
      expect(DAY_NAMES[day]).toBeTruthy();
    }
  });
});

describe('getScheduleRulesAsText', () => {
  test('mengembalikan string non-kosong', () => {
    const text = getScheduleRulesAsText();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('mengandung jam operasional', () => {
    const text = getScheduleRulesAsText();
    expect(text).toContain(OPERATING_HOURS.start);
    expect(text).toContain(OPERATING_HOURS.end);
  });

  test('mengandung jam istirahat', () => {
    const text = getScheduleRulesAsText();
    expect(text).toContain(BREAK_TIME.start);
    expect(text).toContain(BREAK_TIME.end);
  });

  test('mengandung semua jenis seminar', () => {
    const text = getScheduleRulesAsText();
    for (const kode of Object.keys(SEMINAR_DURATION_MINUTES)) {
      expect(text).toContain(kode);
    }
  });
});
