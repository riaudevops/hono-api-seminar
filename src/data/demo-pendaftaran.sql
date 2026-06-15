-- Demo seed pendaftaran + jadwal + penilaian.
-- Referensi NIM/NIP diambil dari src/data/mahasiswa.sql dan src/data/dosen.sql.
-- Data dibuat variatif supaya beban dosen tersebar dan tidak menumpuk di satu dosen.
--
-- Catatan:
-- - kode_tahun_ajaran dibuat dinamis mengikuti TahunAjaranHelper.findSekarang():
--   bulan Okt-Des => YYYY1, selain itu => (YYYY-1)2.
-- - Jadwal menggunakan timestamp eksplisit +07 (WIB) agar jam demo mudah dibaca.
-- - Jika file ini dijalankan ulang, data demo lama dengan prefix DEMO-PDF-/JD-DEMO- akan diganti bersih.

CREATE TEMP TABLE IF NOT EXISTS _demo_pendaftaran_jadwal_seed (
  id_pendaftaran text,
  id_jadwal text,
  kode_jenis text,
  nim text,
  id_pengajuan_fst text,
  nip_pembimbing_1 text,
  nip_pembimbing_2 text,
  nip_penguji_1 text,
  nip_penguji_2 text,
  nip_ketua_sidang text,
  kode_ruangan text,
  waktu_mulai timestamptz,
  waktu_selesai timestamptz,
  status_kelulusan "StatusKelulusan"
) ON COMMIT DROP;

TRUNCATE TABLE _demo_pendaftaran_jadwal_seed;

INSERT INTO _demo_pendaftaran_jadwal_seed (
  id_pendaftaran,
  id_jadwal,
  kode_jenis,
  nim,
  id_pengajuan_fst,
  nip_pembimbing_1,
  nip_pembimbing_2,
  nip_penguji_1,
  nip_penguji_2,
  nip_ketua_sidang,
  kode_ruangan,
  waktu_mulai,
  waktu_selesai,
  status_kelulusan
) VALUES
  -- Seminar Kerja Praktek: 1 pembimbing + 1 penguji
  (
    'DEMO-PDF-SEMKP-001', 'JD-DEMO-001', 'SEMKP', '11850110215', 'DEMO-FST-SEMKP-001',
    '197408072009011007', NULL, '198908142020122012', NULL, NULL,
    'FST-301', '2026-07-06 08:00:00+07', '2026-07-06 09:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SEMKP-002', 'JD-DEMO-002', 'SEMKP', '11850110334', 'DEMO-FST-SEMKP-002',
    '198203132009011009', NULL, '130517102', NULL, NULL,
    'FST-302', '2026-07-06 10:00:00+07', '2026-07-06 11:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SEMKP-003', 'JD-DEMO-003', 'SEMKP', '11850110422', 'DEMO-FST-SEMKP-003',
    '198105232007102003', NULL, '198606292015032007', NULL, NULL,
    'FST-303', '2026-07-06 13:00:00+07', '2026-07-06 14:00:00+07', 'LULUS'
  ),

  -- Seminar Proposal TA: 2 pembimbing + 2 penguji
  (
    'DEMO-PDF-SEMPRO-001', 'JD-DEMO-004', 'SEMPRO', '11850110443', 'DEMO-FST-SEMPRO-001',
    '1471015301860041', '198102062009121003', '198108142006042002', '198706032023212051', NULL,
    'FST-304', '2026-07-07 08:00:00+07', '2026-07-07 09:30:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SEMPRO-002', 'JD-DEMO-005', 'SEMPRO', '11850110464', 'DEMO-FST-SEMPRO-002',
    '197410162000032002', '198804262019032009', '197102152000031002', '198111132007102003', NULL,
    'FST-305', '2026-07-07 10:00:00+07', '2026-07-07 11:30:00+07', 'LULUS'
  ),
  (
    'DEMO-PDF-SEMPRO-003', 'JD-DEMO-006', 'SEMPRO', '11850110468', 'DEMO-FST-SEMPRO-003',
    '198704272023212044', '198910042023212036', '198612062015031004', '198010182007101002', NULL,
    'FST-306', '2026-07-07 13:00:00+07', '2026-07-07 14:30:00+07', 'TIDAK_LULUS'
  ),

  -- Seminar Hasil TA jalur laporan: 2 pembimbing + 2 penguji
  (
    'DEMO-PDF-SEMHAS-LAP-001', 'JD-DEMO-007', 'SEMHAS_LAPORAN', '11850110474', 'DEMO-FST-SEMHAS-LAP-001',
    '197805082007101007', '130517100', '198111252007102004', '197711282007101003', NULL,
    'FST-301', '2026-07-08 08:00:00+07', '2026-07-08 10:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SEMHAS-LAP-002', 'JD-DEMO-008', 'SEMHAS_LAPORAN', '11850110508', 'DEMO-FST-SEMHAS-LAP-002',
    '197710282003122004', '198708302023211016', '198605052015031006', '198610092022032001', NULL,
    'FST-302', '2026-07-08 13:00:00+07', '2026-07-08 15:00:00+07', 'LULUS'
  ),
  (
    'DEMO-PDF-SEMHAS-LAP-003', 'JD-DEMO-009', 'SEMHAS_LAPORAN', '11850110509', 'DEMO-FST-SEMHAS-LAP-003',
    '197608302011011003', '198702072024211009', '197103132007011023', '198705242015031006', NULL,
    'FST-303', '2026-07-09 08:00:00+07', '2026-07-09 10:00:00+07', 'BELUM_DITENTUKAN'
  ),

  -- Seminar Hasil TA jalur paperbased: 2 pembimbing + 2 penguji
  (
    'DEMO-PDF-SEMHAS-PAP-001', 'JD-DEMO-010', 'SEMHAS_PAPERBASED', '11850110539', 'DEMO-FST-SEMHAS-PAP-001',
    '197403192008012015', '198401232015032001', '198212162015031003', '198904212023211026', NULL,
    'FST-304', '2026-07-09 13:00:00+07', '2026-07-09 15:00:00+07', 'LULUS'
  ),
  (
    'DEMO-PDF-SEMHAS-PAP-002', 'JD-DEMO-011', 'SEMHAS_PAPERBASED', '11850111179', 'DEMO-FST-SEMHAS-PAP-002',
    '198605112023212030', '198908142020122012', '197408072009011007', '198203132009011009', NULL,
    'FST-305', '2026-07-10 08:00:00+07', '2026-07-10 10:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SEMHAS-PAP-003', 'JD-DEMO-012', 'SEMHAS_PAPERBASED', '11850111414', 'DEMO-FST-SEMHAS-PAP-003',
    '198105232007102003', '198606292015032007', '1471015301860041', '198102062009121003', NULL,
    'FST-306', '2026-07-10 13:00:00+07', '2026-07-10 15:00:00+07', 'TIDAK_LULUS'
  ),

  -- Sidang TA jalur laporan: 2 pembimbing + 2 penguji + 1 ketua sidang
  (
    'DEMO-PDF-SIDANG-LAP-001', 'JD-DEMO-013', 'SIDANG_LAPORAN', '11850111418', 'DEMO-FST-SIDANG-LAP-001',
    '198108142006042002', '198706032023212051', '197410162000032002', '198804262019032009', '197102152000031002',
    'FST-301', '2026-07-13 08:00:00+07', '2026-07-13 10:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SIDANG-LAP-002', 'JD-DEMO-014', 'SIDANG_LAPORAN', '11850111460', 'DEMO-FST-SIDANG-LAP-002',
    '198111132007102003', '198704272023212044', '198910042023212036', '198612062015031004', '198010182007101002',
    'FST-302', '2026-07-13 13:00:00+07', '2026-07-13 15:00:00+07', 'LULUS'
  ),
  (
    'DEMO-PDF-SIDANG-LAP-003', 'JD-DEMO-015', 'SIDANG_LAPORAN', '11850111508', 'DEMO-FST-SIDANG-LAP-003',
    '197805082007101007', '130517100', '198111252007102004', '197711282007101003', '197710282003122004',
    'FST-303', '2026-07-14 08:00:00+07', '2026-07-14 10:00:00+07', 'BELUM_DITENTUKAN'
  ),

  -- Sidang TA jalur paperbased: 2 pembimbing + 2 penguji + 1 ketua sidang
  (
    'DEMO-PDF-SIDANG-PAP-001', 'JD-DEMO-016', 'SIDANG_PAPERBASED', '11850111581', 'DEMO-FST-SIDANG-PAP-001',
    '198708302023211016', '198605052015031006', '198610092022032001', '197608302011011003', '198702072024211009',
    'FST-304', '2026-07-14 13:00:00+07', '2026-07-14 15:00:00+07', 'LULUS'
  ),
  (
    'DEMO-PDF-SIDANG-PAP-002', 'JD-DEMO-017', 'SIDANG_PAPERBASED', '11850112157', 'DEMO-FST-SIDANG-PAP-002',
    '197103132007011023', '198705242015031006', '197403192008012015', '198401232015032001', '198212162015031003',
    'FST-305', '2026-07-15 08:00:00+07', '2026-07-15 10:00:00+07', 'BELUM_DITENTUKAN'
  ),
  (
    'DEMO-PDF-SIDANG-PAP-003', 'JD-DEMO-018', 'SIDANG_PAPERBASED', '11850112160', 'DEMO-FST-SIDANG-PAP-003',
    '198904212023211026', '198605112023212030', '197408072009011007', '198203132009011009', '198908142020122012',
    'FST-306', '2026-07-15 13:00:00+07', '2026-07-15 15:00:00+07', 'TIDAK_LULUS'
  );

-- Bersihkan data demo lama agar script idempotent.
DELETE FROM "detail_penilaian"
WHERE "id_penilaian" IN (
  SELECT p."id"
  FROM "penilaian" p
  JOIN "jadwal" j ON j."id" = p."id_jadwal"
  WHERE j."id" LIKE 'JD-DEMO-%'
);

DELETE FROM "penilaian"
WHERE "id_jadwal" IN (
  SELECT "id" FROM "jadwal" WHERE "id" LIKE 'JD-DEMO-%'
);

DELETE FROM "jadwal"
WHERE "id" LIKE 'JD-DEMO-%';

DELETE FROM "pendaftaran"
WHERE "id" LIKE 'DEMO-PDF-%';

WITH tahun_ajaran AS (
  SELECT CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int >= 10
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '1'
    ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1)::text || '2'
  END AS kode
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
  "status_berkas",
  "status_jadwal",
  "created_at",
  "updated_at"
)
SELECT
  seed.id_pendaftaran,
  seed.nim,
  tahun_ajaran.kode,
  seed.id_pengajuan_fst,
  jenis."id",
  seed.nip_pembimbing_1,
  seed.nip_pembimbing_2,
  seed.nip_penguji_1,
  seed.nip_penguji_2,
  'APPROVED'::"StatusBerkas",
  'SUDAH_JADWAL'::"StatusJadwal",
  NOW(),
  NOW()
FROM _demo_pendaftaran_jadwal_seed seed
CROSS JOIN tahun_ajaran
JOIN "jenis_seminar" jenis ON jenis."kode" = seed.kode_jenis;

WITH tahun_ajaran AS (
  SELECT CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int >= 10
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '1'
    ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1)::text || '2'
  END AS kode
)
INSERT INTO "jadwal" (
  "id",
  "tanggal",
  "waktu_mulai",
  "waktu_selesai",
  "id_jenis_seminar",
  "nim",
  "kode_ruangan",
  "status_kelulusan",
  "kode_tahun_ajaran"
)
SELECT
  seed.id_jadwal,
  seed.waktu_mulai,
  seed.waktu_mulai,
  seed.waktu_selesai,
  jenis."id",
  seed.nim,
  seed.kode_ruangan,
  seed.status_kelulusan,
  tahun_ajaran.kode
FROM _demo_pendaftaran_jadwal_seed seed
CROSS JOIN tahun_ajaran
JOIN "jenis_seminar" jenis ON jenis."kode" = seed.kode_jenis;

INSERT INTO "penilaian" ("id", "id_jadwal", "nip", "role")
SELECT 'PN-' || seed.id_jadwal || '-P1', seed.id_jadwal, seed.nip_pembimbing_1, 'KP_PEMBIMBING'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis = 'SEMKP'
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-U1', seed.id_jadwal, seed.nip_penguji_1, 'KP_PENGUJI'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis = 'SEMKP'
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-P1', seed.id_jadwal, seed.nip_pembimbing_1, 'TA_PEMBIMBING_1'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis <> 'SEMKP'
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-P2', seed.id_jadwal, seed.nip_pembimbing_2, 'TA_PEMBIMBING_2'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis <> 'SEMKP' AND seed.nip_pembimbing_2 IS NOT NULL
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-U1', seed.id_jadwal, seed.nip_penguji_1, 'TA_PENGUJI_1'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis <> 'SEMKP' AND seed.nip_penguji_1 IS NOT NULL
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-U2', seed.id_jadwal, seed.nip_penguji_2, 'TA_PENGUJI_2'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis <> 'SEMKP' AND seed.nip_penguji_2 IS NOT NULL
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-KS', seed.id_jadwal, seed.nip_ketua_sidang, 'TA_KETUA_SIDANG'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis IN ('SIDANG_LAPORAN', 'SIDANG_PAPERBASED')
  AND seed.nip_ketua_sidang IS NOT NULL
UNION ALL
SELECT 'PN-' || seed.id_jadwal || '-AT', seed.id_jadwal, seed.nip_ketua_sidang, 'ARTIKEL_TA'::"PenilaiRole"
FROM _demo_pendaftaran_jadwal_seed seed
WHERE seed.kode_jenis = 'SIDANG_PAPERBASED'
  AND seed.nip_ketua_sidang IS NOT NULL;

SELECT
  seed.kode_jenis,
  COUNT(*) AS total_jadwal
FROM _demo_pendaftaran_jadwal_seed seed
GROUP BY seed.kode_jenis
ORDER BY seed.kode_jenis;

SELECT
  dosen.nama,
  p.nip,
  COUNT(*) AS total_peran
FROM "penilaian" p
JOIN "dosen" dosen ON dosen.nip = p.nip
WHERE p."id_jadwal" LIKE 'JD-DEMO-%'
GROUP BY dosen.nama, p.nip
ORDER BY total_peran DESC, dosen.nama;
