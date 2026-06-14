#!/usr/bin/env bun
/// <reference types="bun" />

import Redis from 'ioredis';

const args = new Set(process.argv.slice(2));

function printHelp() {
  console.log(`Reset data Redis.

Usage:
  bun run redis:reset
  bun scripts/reset-redis.ts

Opsi:
  --prefix-only        Hapus hanya key dengan prefix aplikasi REDIS_KEY_PREFIX, default: seminar-tif
  --all-databases     Hapus semua database Redis dengan FLUSHALL, bukan hanya database aktif
  --allow-production  Izinkan reset ketika APP_ENV=production
  -h, --help          Tampilkan bantuan

Default:
  - Script menjalankan FLUSHDB untuk menghapus semua key pada database Redis aktif.
  - Script ditolak jika APP_ENV=production kecuali memakai --allow-production.

Environment:
  REDIS_URL atau REDIS_HOST wajib diset.
  REDIS_PORT default 6379.
  REDIS_PASSWORD opsional.
  REDIS_KEY_PREFIX default seminar-tif, dipakai hanya untuk --prefix-only.
`);
}

function normalizeEnv(value: string | undefined) {
  return (value || 'development').split('#')[0].trim().toLowerCase();
}

function buildRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST;
  if (!host) return null;

  const port = process.env.REDIS_PORT || '6379';
  return `redis://${host}:${port}`;
}

function sanitizeRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

async function deleteByPrefix(client: Redis, keyPrefix: string) {
  const normalizedPrefix = keyPrefix.replace(/:+$/, '');
  const pattern = `${normalizedPrefix}:*`;
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await client.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      500
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) return 0;

  const chunkSize = 500;
  for (let i = 0; i < keys.length; i += chunkSize) {
    await client.del(...keys.slice(i, i + chunkSize));
  }

  return keys.length;
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    printHelp();
    return;
  }

  const appEnv = normalizeEnv(process.env.APP_ENV);
  if (appEnv === 'production' && !args.has('--allow-production')) {
    throw new Error(
      'APP_ENV=production terdeteksi. Reset Redis dibatalkan. Jika benar-benar perlu, jalankan dengan --allow-production.'
    );
  }

  const redisUrl = buildRedisUrl();
  if (!redisUrl) {
    throw new Error('REDIS_URL atau REDIS_HOST wajib diset untuk reset Redis.');
  }

  const prefixOnly = args.has('--prefix-only');
  const allDatabases = args.has('--all-databases');

  if (prefixOnly && allDatabases) {
    throw new Error('Pilih salah satu: --prefix-only atau --all-databases.');
  }

  const client = new Redis(redisUrl, {
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
  });

  try {
    console.log('[REDIS RESET] APP_ENV:', appEnv);
    console.log('[REDIS RESET] Target Redis:', sanitizeRedisUrl(redisUrl));

    await client.connect();

    if (prefixOnly) {
      const keyPrefix = process.env.REDIS_KEY_PREFIX || 'seminar-tif';
      console.log('[REDIS RESET] Mode: hapus prefix aplikasi');
      console.log('[REDIS RESET] Prefix:', `${keyPrefix.replace(/:+$/, '')}:*`);
      const deleted = await deleteByPrefix(client, keyPrefix);
      console.log(`[REDIS RESET] Selesai. ${deleted} key terhapus.`);
      return;
    }

    const before = await client.dbsize();

    if (allDatabases) {
      console.log('[REDIS RESET] Mode: FLUSHALL semua database Redis');
      await client.flushall();
      console.log(
        `[REDIS RESET] Selesai. FLUSHALL dijalankan. Key pada DB aktif sebelum reset: ${before}.`
      );
      return;
    }

    console.log('[REDIS RESET] Mode: FLUSHDB database Redis aktif');
    await client.flushdb();
    const after = await client.dbsize();
    console.log(
      `[REDIS RESET] Selesai. Key sebelum reset: ${before}. Key setelah reset: ${after}.`
    );
  } finally {
    client.disconnect();
  }
}

main().catch((error) => {
  console.error(
    '[REDIS RESET] Gagal:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
