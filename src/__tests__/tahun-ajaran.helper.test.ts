import { describe, test, expect } from 'bun:test';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';

describe('TahunAjaranHelper.parseStringNameByCode', () => {
  test('semester 1 (Ganjil)', () => {
    expect(TahunAjaranHelper.parseStringNameByCode('20241')).toBe(
      '2024/2025 Ganjil'
    );
  });

  test('semester 2 (Genap)', () => {
    expect(TahunAjaranHelper.parseStringNameByCode('20242')).toBe(
      '2024/2025 Genap'
    );
  });

  test('different year Ganjil', () => {
    expect(TahunAjaranHelper.parseStringNameByCode('20231')).toBe(
      '2023/2024 Ganjil'
    );
  });

  test('different year Genap', () => {
    expect(TahunAjaranHelper.parseStringNameByCode('20232')).toBe(
      '2023/2024 Genap'
    );
  });

  test('year 2025 Ganjil', () => {
    expect(TahunAjaranHelper.parseStringNameByCode('20251')).toBe(
      '2025/2026 Ganjil'
    );
  });
});

describe('TahunAjaranHelper.findSekarang', () => {
  test('returns a string matching pattern YYYYs where s is 1 or 2', () => {
    const code = TahunAjaranHelper.findSekarang();
    expect(code).toMatch(/^\d{4}[12]$/);
  });

  test('month >= 9 (Oktober) → tahun berjalan + semester 1 (Ganjil)', () => {
    // Mock Date to October 2025
    const OrigDate = globalThis.Date;
    globalThis.Date = class extends OrigDate {
      constructor(...args: any[]) {
        if (args.length === 0)
          super(2025, 9, 1); // October 2025
        else super(...(args as []));
      }
    } as any;

    const code = TahunAjaranHelper.findSekarang();
    expect(code).toBe('20251');

    globalThis.Date = OrigDate;
  });

  test('month < 9 (Maret) → tahun sebelumnya + semester 2 (Genap)', () => {
    const OrigDate = globalThis.Date;
    globalThis.Date = class extends OrigDate {
      constructor(...args: any[]) {
        if (args.length === 0)
          super(2026, 2, 1); // March 2026
        else super(...(args as []));
      }
    } as any;

    const code = TahunAjaranHelper.findSekarang();
    expect(code).toBe('20252');

    globalThis.Date = OrigDate;
  });
});
