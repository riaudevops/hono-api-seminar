import crypto from 'crypto';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function hashCacheKey(value: unknown): string {
  return crypto.createHash('sha1').update(stableStringify(value)).digest('hex');
}

export function normalizeCachePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}
