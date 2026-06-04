-- Demo seed pendaftaran mahasiswa untuk testing LLM generate jadwal.
-- Data ini sengaja diinsert langsung ke database, bukan lewat service/API,
-- supaya tidak ada side effect seperti pengiriman email.
-- Referensi NIM/NIP diambil dari src/data/mahasiswa.sql dan src/data/dosen.sql.
-- Dibuat variatif: 2 pendaftaran untuk setiap jenis seminar demo.
-- kode_tahun_ajaran dibuat dinamis mengikuti TahunAjaranHelper.findSekarang():
--   bulan Okt-Des => YYYY1, selain itu => (YYYY-1)2.

WITH demo_pendaftaran (
  "id",
  "kode_jenis",
  "nim",
  "id_pengajuan_fst",
  "nip_pembimbing_1",
  "nip_pembimbing_2",
  "nip_penguji_1",
  "nip_penguji_2",
  "nip_ketua_sidang"
) AS (
  VALUES
    -- Seminar Kerja Praktek: 1 pembimbing + 1 penguji
    (
      'TEST-LLM-SEMKP-001',
      'SEMKP',
      '11850110215',
      'TEST-LLM-FST-SEMKP-001',
      '197408072009011007',
      NULL,
      '198908142020122012',
      NULL,
      NULL
    ),
    (
      'TEST-LLM-SEMKP-002',
      'SEMKP',
      '11850110334',
      'TEST-LLM-FST-SEMKP-002',
      '198203132009011009',
      NULL,
      '130517102',
      NULL,
      NULL
    ),

    -- Seminar Proposal: 2 pembimbing + 2 penguji
    (
      'TEST-LLM-SEMPRO-001',
      'SEMPRO',
      '11850110422',
      'TEST-LLM-FST-SEMPRO-001',
      '198203132009011009',
      '198908142020122012',
      '198102062009121003',
      '198108142006042002',
      NULL
    ),
    (
      'TEST-LLM-SEMPRO-002',
      'SEMPRO',
      '11850110443',
      'TEST-LLM-FST-SEMPRO-002',
      '198105232007102003',
      '198606292015032007',
      '198706032023212051',
      '197410162000032002',
      NULL
    ),

    -- Seminar Hasil jalur laporan: 2 pembimbing + 2 penguji
    (
      'TEST-LLM-SEMHAS-LAPORAN-001',
      'SEMHAS_LAPORAN',
      '11850110464',
      'TEST-LLM-FST-SEMHAS-LAPORAN-001',
      '197408072009011007',
      '130517102',
      '198804262019032009',
      '197102152000031002',
      NULL
    ),
    (
      'TEST-LLM-SEMHAS-LAPORAN-002',
      'SEMHAS_LAPORAN',
      '11850110468',
      'TEST-LLM-FST-SEMHAS-LAPORAN-002',
      '198203132009011009',
      '1471015301860041',
      '198111132007102003',
      '198910042023212036',
      NULL
    ),

    -- Seminar Hasil jalur paper: 2 pembimbing + 2 penguji
    (
      'TEST-LLM-SEMHAS-PAPERBASED-001',
      'SEMHAS_PAPERBASED',
      '11850110474',
      'TEST-LLM-FST-SEMHAS-PAPERBASED-001',
      '198908142020122012',
      '198102062009121003',
      '197408072009011007',
      '198706032023212051',
      NULL
    ),
    (
      'TEST-LLM-SEMHAS-PAPERBASED-002',
      'SEMHAS_PAPERBASED',
      '11850110508',
      'TEST-LLM-FST-SEMHAS-PAPERBASED-002',
      '198105232007102003',
      '198108142006042002',
      '198203132009011009',
      '197410162000032002',
      NULL
    ),

    -- Sidang jalur laporan: 2 pembimbing + 2 penguji + 1 ketua sidang
    (
      'TEST-LLM-SIDANG-LAPORAN-001',
      'SIDANG_LAPORAN',
      '11850110509',
      'TEST-LLM-FST-SIDANG-LAPORAN-001',
      '198606292015032007',
      '198804262019032009',
      '198908142020122012',
      '197102152000031002',
      '198111132007102003'
    ),
    (
      'TEST-LLM-SIDANG-LAPORAN-002',
      'SIDANG_LAPORAN',
      '11850110539',
      'TEST-LLM-FST-SIDANG-LAPORAN-002',
      '130517102',
      '198111132007102003',
      '198105232007102003',
      '198910042023212036',
      '1471015301860041'
    ),

    -- Sidang jalur paper: 2 pembimbing + 2 penguji + 1 ketua sidang
    (
      'TEST-LLM-SIDANG-PAPERBASED-001',
      'SIDANG_PAPERBASED',
      '11850111179',
      'TEST-LLM-FST-SIDANG-PAPERBASED-001',
      '1471015301860041',
      '198706032023212051',
      '198203132009011009',
      '198804262019032009',
      '197410162000032002'
    ),
    (
      'TEST-LLM-SIDANG-PAPERBASED-002',
      'SIDANG_PAPERBASED',
      '11850111414',
      'TEST-LLM-FST-SIDANG-PAPERBASED-002',
      '198102062009121003',
      '197410162000032002',
      '197408072009011007',
      '198111132007102003',
      '198908142020122012'
    )
), stale_demo_cleanup AS (
  DELETE FROM "pendaftaran"
  WHERE "id" LIKE 'TEST-LLM-%'
    AND "id" NOT IN (SELECT "id" FROM demo_pendaftaran)
  RETURNING "id"
), tahun_ajaran AS (
  SELECT CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int >= 10
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '1'
    ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1)::text || '2'
  END AS "kode"
), jenis AS (
  SELECT "id", "kode"
  FROM "jenis_seminar"
  WHERE "kode" IN (
    'SEMKP',
    'SEMPRO',
    'SEMHAS_LAPORAN',
    'SEMHAS_PAPERBASED',
    'SIDANG_LAPORAN',
    'SIDANG_PAPERBASED'
  )
), cleanup_count AS (
  SELECT COUNT(*) AS "total" FROM stale_demo_cleanup
)
INSERT INTO "pendaftaran" (
  "id",
  "nim",
  "kode_tahun_ajaran",
  "id_pengajuan_fst",
  "id_jenis_seminar",
  "nip_pembimbing_1",
  "nip_pembimbing_2",
  "nip_penguji_1",
  "nip_penguji_2",
  "nip_ketua_sidang",
  "status_berkas",
  "status_jadwal",
  "created_at",
  "updated_at"
)
SELECT
  demo_pendaftaran."id",
  demo_pendaftaran."nim",
  tahun_ajaran."kode",
  demo_pendaftaran."id_pengajuan_fst",
  jenis."id",
  demo_pendaftaran."nip_pembimbing_1",
  demo_pendaftaran."nip_pembimbing_2",
  demo_pendaftaran."nip_penguji_1",
  demo_pendaftaran."nip_penguji_2",
  demo_pendaftaran."nip_ketua_sidang",
  'APPROVED'::"StatusBerkas",
  'BELUM_JADWAL'::"StatusJadwal",
  NOW(),
  NOW()
FROM demo_pendaftaran
CROSS JOIN tahun_ajaran
JOIN jenis ON jenis."kode" = demo_pendaftaran."kode_jenis"
CROSS JOIN cleanup_count
ON CONFLICT ("id") DO UPDATE SET
  "nim" = EXCLUDED."nim",
  "kode_tahun_ajaran" = EXCLUDED."kode_tahun_ajaran",
  "id_pengajuan_fst" = EXCLUDED."id_pengajuan_fst",
  "id_jenis_seminar" = EXCLUDED."id_jenis_seminar",
  "nip_pembimbing_1" = EXCLUDED."nip_pembimbing_1",
  "nip_pembimbing_2" = EXCLUDED."nip_pembimbing_2",
  "nip_penguji_1" = EXCLUDED."nip_penguji_1",
  "nip_penguji_2" = EXCLUDED."nip_penguji_2",
  "nip_ketua_sidang" = EXCLUDED."nip_ketua_sidang",
  "status_berkas" = EXCLUDED."status_berkas",
  "status_jadwal" = EXCLUDED."status_jadwal",
  "updated_at" = NOW();
