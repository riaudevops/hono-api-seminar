import { describe, test, expect } from 'bun:test';
import {
  stableStringify,
  hashCacheKey,
  normalizeCachePart,
} from '../utils/cache-key.util';

describe('stableStringify', () => {
  test('primitive: string', () => {
    expect(stableStringify('hello')).toBe('"hello"');
  });

  test('primitive: number', () => {
    expect(stableStringify(42)).toBe('42');
  });

  test('primitive: null', () => {
    expect(stableStringify(null)).toBe('null');
  });

  test('primitive: boolean', () => {
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(false)).toBe('false');
  });

  test('Date is serialized as ISO string', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(stableStringify(d)).toBe('"2026-01-01T00:00:00.000Z"');
  });

  test('object keys are sorted', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(
      stableStringify({ a: 2, b: 1 })
    );
  });

  test('undefined values are stripped from objects', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  test('array preserves order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  test('nested object is stable regardless of key order', () => {
    const obj1 = { z: { y: 1, x: 2 }, a: 3 };
    const obj2 = { a: 3, z: { x: 2, y: 1 } };
    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
  });

  test('empty object', () => {
    expect(stableStringify({})).toBe('{}');
  });

  test('empty array', () => {
    expect(stableStringify([])).toBe('[]');
  });
});

describe('hashCacheKey', () => {
  test('returns a 40-char hex SHA-1', () => {
    const hash = hashCacheKey('test');
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
  });

  test('same value always produces same hash', () => {
    expect(hashCacheKey('abc')).toBe(hashCacheKey('abc'));
  });

  test('object with different key order produces same hash', () => {
    expect(hashCacheKey({ a: 1, b: 2 })).toBe(hashCacheKey({ b: 2, a: 1 }));
  });

  test('different inputs produce different hashes', () => {
    expect(hashCacheKey('foo')).not.toBe(hashCacheKey('bar'));
  });

  test('number and string with same text produce different hashes', () => {
    expect(hashCacheKey(1)).not.toBe(hashCacheKey('1'));
  });
});

describe('normalizeCachePart', () => {
  test('lowercases', () => {
    expect(normalizeCachePart('SEMKP')).toBe('semkp');
  });

  test('trims leading and trailing spaces', () => {
    expect(normalizeCachePart('  semkp  ')).toBe('semkp');
  });

  test('replaces single space with hyphen', () => {
    expect(normalizeCachePart('Seminar KP')).toBe('seminar-kp');
  });

  test('collapses multiple spaces into single hyphen', () => {
    expect(normalizeCachePart('a  b   c')).toBe('a-b-c');
  });

  test('already normalized input is unchanged', () => {
    expect(normalizeCachePart('seminar-kp')).toBe('seminar-kp');
  });
});
