#!/usr/bin/env bun
/// <reference types="bun" />

const args = new Set(process.argv.slice(2));

function printHelp() {
  console.log(`Reset database demo seminar.

Usage:
  bun run demo:reset-db
  bun scripts/reset-demo-db.ts

Apa yang dilakukan:
  1. prisma db push --force-reset --accept-data-loss
  2. prisma db seed
  3. clear Redis cache dengan prefix aplikasi
  4. tampilkan ringkasan data demo

Catatan:
  - Script ini DESTRUCTIVE: semua data di database target akan direset.
  - Script otomatis ditolak jika APP_ENV=production, kecuali pakai --allow-production.
`);
}

function normalizeEnv(value: string | undefined) {
  return (value || 'development').split('#')[0].trim().toLowerCase();
}

function sanitizeDatabaseUrl(url: string | undefined) {
  if (!url) return '(DATABASE_URL tidak diset)';

  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    if (parsed.username)
      parsed.username = parsed.username ? `${parsed.username}` : '';
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

async function runStep(label: string, command: string[]) {
  console.log(`\n[DEMO RESET] ${label}`);
  console.log(`[DEMO RESET] $ ${command.join(' ')}`);

  const proc = Bun.spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} gagal dengan exit code ${exitCode}`);
  }
}

async function clearRedisCache() {
  console.log('\n[DEMO RESET] Membersihkan Redis cache aplikasi...');
  const { default: redisService } =
    await import('../src/infrastructures/redis.infrastructure');

  await redisService.delByPattern('*');
  await redisService.disconnect();
  console.log('[DEMO RESET] Redis cache selesai dibersihkan.');
}

async function printSummary() {
  const { default: prisma } =
    await import('../src/infrastructures/db.infrastructure');

  const [
    mahasiswaTotal,
    dosenTotal,
    jenisSeminarTotal,
    ruanganTotal,
    demoPendaftaranTotal,
    demoConstraintTotal,
    demoPendaftaran,
  ] = await Promise.all([
    prisma.mahasiswa.count(),
    prisma.dosen.count(),
    prisma.jenis_seminar.count(),
    prisma.ruangan.count(),
    prisma.pendaftaran.count({
      where: { id: { startsWith: 'TEST-LLM-SEMPRO-' } },
    }),
    prisma.constraint_dosen.count({
      where: { id: { startsWith: 'test-llm-c-' } },
    }),
    prisma.pendaftaran.findMany({
      where: { id: { startsWith: 'TEST-LLM-SEMPRO-' } },
      orderBy: { id: 'asc' },
      take: 3,
      select: {
        nim: true,
        kode_tahun_ajaran: true,
        nip_pembimbing_1: true,
        nip_pembimbing_2: true,
        nip_penguji_1: true,
        nip_penguji_2: true,
      },
    }),
  ]);

  await prisma.$disconnect();

  console.log('\n[DEMO RESET] Ringkasan data setelah reset + seed:');
  console.table({
    mahasiswa: mahasiswaTotal,
    dosen: dosenTotal,
    jenis_seminar: jenisSeminarTotal,
    ruangan: ruanganTotal,
    demo_pendaftaran: demoPendaftaranTotal,
    demo_constraint_dosen: demoConstraintTotal,
  });

  console.log(
    '\n[DEMO RESET] Contoh 3 item list_mahasiswa untuk generate draft jadwal:'
  );
  console.log(
    JSON.stringify(
      demoPendaftaran.map((p) => ({
        nim: p.nim,
        kode_jenis: 'SEMPRO',
        list_dosen: [
          { nip: p.nip_pembimbing_1, role: 'TA_PEMBIMBING_1' },
          { nip: p.nip_pembimbing_2, role: 'TA_PEMBIMBING_2' },
          { nip: p.nip_penguji_1, role: 'TA_PENGUJI_1' },
          { nip: p.nip_penguji_2, role: 'TA_PENGUJI_2' },
        ],
      })),
      null,
      2
    )
  );
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    printHelp();
    return;
  }

  const appEnv = normalizeEnv(process.env.APP_ENV);
  if (appEnv === 'production' && !args.has('--allow-production')) {
    throw new Error(
      'APP_ENV=production terdeteksi. Reset demo dibatalkan. Jika benar-benar perlu, jalankan dengan --allow-production.'
    );
  }

  console.log(
    '[DEMO RESET] Target DATABASE_URL:',
    sanitizeDatabaseUrl(process.env.DATABASE_URL)
  );
  console.log('[DEMO RESET] APP_ENV:', appEnv);

  await runStep('Reset schema database dari Prisma schema', [
    'bunx',
    'prisma',
    'db',
    'push',
    '--force-reset',
    '--accept-data-loss',
  ]);

  await runStep('Seed data dasar + data demo LLM', [
    'bunx',
    'prisma',
    'db',
    'seed',
  ]);

  await clearRedisCache();
  await printSummary();

  console.log('\n[DEMO RESET] Selesai. Database siap untuk demo aplikasi.');
}

main().catch((error) => {
  console.error(
    '\n[DEMO RESET] Gagal:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
