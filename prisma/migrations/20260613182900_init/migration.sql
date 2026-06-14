-- CreateEnum
CREATE TYPE "PenilaiRole" AS ENUM ('KP_INSTANSI', 'KP_PEMBIMBING', 'KP_PENGUJI', 'TA_PEMBIMBING_1', 'TA_PEMBIMBING_2', 'TA_PENGUJI_1', 'TA_PENGUJI_2', 'TA_KETUA_SIDANG');

-- CreateEnum
CREATE TYPE "LogActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'GANTI_JADWAL', 'GANTI_DOSEN');

-- CreateEnum
CREATE TYPE "LogActorType" AS ENUM ('KOORDINATOR', 'DOSEN', 'MAHASISWA');

-- CreateEnum
CREATE TYPE "LogEntityType" AS ENUM ('JADWAL', 'PENILAIAN', 'PENDAFTARAN', 'MAHASISWA', 'JENIS_SEMINAR', 'DOKUMEN_TEMPLATE', 'REQUIREMENT_DOKUMEN', 'BIDANG_KEAHLIAN', 'KEAHLIAN_DOSEN', 'RUANGAN', 'CONSTRAINT_DOSEN', 'KOMPONEN_PENILAIAN', 'JADWAL_DRAFT', 'LOG', 'BOBOT_PENILAI');

-- CreateEnum
CREATE TYPE "StatusJadwalDraft" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('AVAILABLE_TIME', 'UNAVAILABLE_TIME', 'PREFERENCE', 'LOCATION');

-- CreateEnum
CREATE TYPE "StatusBerkas" AS ENUM ('PENDING', 'REVISI', 'APPROVED', 'REJECTED', 'UPLOAD_ULANG');

-- CreateEnum
CREATE TYPE "StatusJadwal" AS ENUM ('BELUM_JADWAL', 'SUDAH_JADWAL');

-- CreateEnum
CREATE TYPE "StatusKelulusan" AS ENUM ('LULUS', 'TIDAK_LULUS', 'BELUM_DITENTUKAN');

-- CreateEnum
CREATE TYPE "TipeInputDokumen" AS ENUM ('FILE_UPLOAD', 'TEXT', 'URL', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT');

-- CreateTable
CREATE TABLE "dosen" (
    "nip" VARCHAR(18) NOT NULL,
    "nama" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "no_hp" VARCHAR(14),

    CONSTRAINT "dosen_pkey" PRIMARY KEY ("nip")
);

-- CreateTable
CREATE TABLE "bidang_keahlian" (
    "id" TEXT NOT NULL,
    "nama" VARCHAR(100) NOT NULL,

    CONSTRAINT "bidang_keahlian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keahlian_dosen" (
    "id" TEXT NOT NULL,
    "nip" VARCHAR(18) NOT NULL,
    "id_bidang_keahlian" TEXT NOT NULL,

    CONSTRAINT "keahlian_dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahasiswa" (
    "nim" VARCHAR(11) NOT NULL,
    "nama" VARCHAR(255) NOT NULL,
    "email" VARCHAR(36) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "no_hp" VARCHAR(14),

    CONSTRAINT "mahasiswa_pkey" PRIMARY KEY ("nim")
);

-- CreateTable
CREATE TABLE "ruangan" (
    "kode" VARCHAR(10) NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ruangan_pkey" PRIMARY KEY ("kode")
);

-- CreateTable
CREATE TABLE "jadwal" (
    "id" VARCHAR(14) NOT NULL,
    "tanggal" TIMESTAMPTZ NOT NULL,
    "waktu_mulai" TIMESTAMPTZ NOT NULL,
    "waktu_selesai" TIMESTAMPTZ NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "kode_ruangan" TEXT NOT NULL,
    "status_kelulusan" "StatusKelulusan" NOT NULL DEFAULT 'BELUM_DITENTUKAN',
    "kode_tahun_ajaran" VARCHAR(5) NOT NULL,

    CONSTRAINT "jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_draft" (
    "id" TEXT NOT NULL,
    "batch_id" VARCHAR(20) NOT NULL,
    "nim" TEXT NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,
    "tanggal" TIMESTAMPTZ NOT NULL,
    "waktu_mulai" TIMESTAMPTZ NOT NULL,
    "waktu_selesai" TIMESTAMPTZ NOT NULL,
    "kode_ruangan" VARCHAR(10) NOT NULL,
    "list_dosen" JSONB NOT NULL,
    "llm_reasoning" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "StatusJadwalDraft" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "komponen_penilaian" (
    "id" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "persentase" INTEGER NOT NULL,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "role" "PenilaiRole" NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,

    CONSTRAINT "komponen_penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penilaian" (
    "id" TEXT NOT NULL,
    "id_jadwal" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "role" "PenilaiRole" NOT NULL,

    CONSTRAINT "penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_penilaian" (
    "id" TEXT NOT NULL,
    "id_penilaian" TEXT NOT NULL,
    "id_komponen" TEXT NOT NULL,
    "nilai" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,

    CONSTRAINT "detail_penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "LogActionType" NOT NULL,
    "actor_type" "LogActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "entity_type" "LogEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "context" JSONB,
    "old_values" JSONB,
    "new_values" JSONB,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraint_dosen" (
    "id" TEXT NOT NULL,
    "nip" VARCHAR(18) NOT NULL,
    "type" "ConstraintType" NOT NULL,
    "hari" INTEGER,
    "waktu_mulai" TIMESTAMPTZ,
    "waktu_selesai" TIMESTAMPTZ,
    "keterangan" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "raw_data" JSONB,

    CONSTRAINT "constraint_dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenis_seminar" (
    "id" TEXT NOT NULL,
    "kode" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "deskripsi" TEXT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "wajib_pembimbing" INTEGER NOT NULL DEFAULT 1,
    "wajib_penguji" INTEGER NOT NULL DEFAULT 2,
    "ada_ketua_sidang" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "jenis_seminar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bobot_penilai" (
    "id" TEXT NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,
    "role" "PenilaiRole" NOT NULL,
    "persentase" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bobot_penilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_template" (
    "id" TEXT NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "kode" VARCHAR(50) NOT NULL,
    "deskripsi" TEXT,
    "tipe_input" "TipeInputDokumen" NOT NULL,
    "opsi" JSONB,
    "format_file" VARCHAR(50),
    "max_size_mb" INTEGER,
    "can_view_dosen" BOOLEAN NOT NULL DEFAULT false,
    "is_special" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dokumen_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_dokumen" (
    "id" TEXT NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,
    "id_dokumen_template" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "is_wajib" BOOLEAN NOT NULL DEFAULT true,
    "keterangan_tambahan" TEXT,

    CONSTRAINT "requirement_dokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendaftaran" (
    "id" TEXT NOT NULL,
    "nim" VARCHAR(11) NOT NULL,
    "kode_tahun_ajaran" VARCHAR(5) NOT NULL,
    "id_pengajuan_fst" VARCHAR(50) NOT NULL,
    "id_jenis_seminar" TEXT NOT NULL,
    "nip_pembimbing_1" VARCHAR(18) NOT NULL,
    "nip_pembimbing_2" VARCHAR(18),
    "nip_penguji_1" VARCHAR(18),
    "nip_penguji_2" VARCHAR(18),
    "status_berkas" "StatusBerkas" NOT NULL DEFAULT 'PENDING',
    "status_jadwal" "StatusJadwal" NOT NULL DEFAULT 'BELUM_JADWAL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pendaftaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_pendaftaran" (
    "id" TEXT NOT NULL,
    "id_pendaftaran" TEXT NOT NULL,
    "id_dokumen_template" TEXT NOT NULL,
    "nilai_text" TEXT,
    "nilai_file_url" TEXT,
    "nilai_boolean" BOOLEAN,
    "nilai_date" TIMESTAMPTZ,
    "nilai_json" JSONB,

    CONSTRAINT "data_pendaftaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dosen_email_key" ON "dosen"("email");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_no_hp_key" ON "dosen"("no_hp");

-- CreateIndex
CREATE UNIQUE INDEX "bidang_keahlian_nama_key" ON "bidang_keahlian"("nama");

-- CreateIndex
CREATE INDEX "keahlian_dosen_nip_idx" ON "keahlian_dosen"("nip");

-- CreateIndex
CREATE INDEX "keahlian_dosen_id_bidang_keahlian_idx" ON "keahlian_dosen"("id_bidang_keahlian");

-- CreateIndex
CREATE UNIQUE INDEX "keahlian_dosen_nip_id_bidang_keahlian_key" ON "keahlian_dosen"("nip", "id_bidang_keahlian");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_email_key" ON "mahasiswa"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_no_hp_key" ON "mahasiswa"("no_hp");

-- CreateIndex
CREATE INDEX "jadwal_tanggal_idx" ON "jadwal"("tanggal");

-- CreateIndex
CREATE INDEX "jadwal_nim_kode_tahun_ajaran_idx" ON "jadwal"("nim", "kode_tahun_ajaran");

-- CreateIndex
CREATE INDEX "jadwal_kode_ruangan_tanggal_idx" ON "jadwal"("kode_ruangan", "tanggal");

-- CreateIndex
CREATE INDEX "jadwal_kode_ruangan_waktu_mulai_waktu_selesai_idx" ON "jadwal"("kode_ruangan", "waktu_mulai", "waktu_selesai");

-- CreateIndex
CREATE INDEX "jadwal_waktu_mulai_waktu_selesai_idx" ON "jadwal"("waktu_mulai", "waktu_selesai");

-- CreateIndex
CREATE INDEX "jadwal_id_jenis_seminar_idx" ON "jadwal"("id_jenis_seminar");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_nim_id_jenis_seminar_kode_tahun_ajaran_key" ON "jadwal"("nim", "id_jenis_seminar", "kode_tahun_ajaran");

-- CreateIndex
CREATE INDEX "jadwal_draft_batch_id_idx" ON "jadwal_draft"("batch_id");

-- CreateIndex
CREATE INDEX "jadwal_draft_status_idx" ON "jadwal_draft"("status");

-- CreateIndex
CREATE INDEX "jadwal_draft_id_jenis_seminar_idx" ON "jadwal_draft"("id_jenis_seminar");

-- CreateIndex
CREATE INDEX "komponen_penilaian_id_jenis_seminar_idx" ON "komponen_penilaian"("id_jenis_seminar");

-- CreateIndex
CREATE INDEX "komponen_penilaian_role_idx" ON "komponen_penilaian"("role");

-- CreateIndex
CREATE UNIQUE INDEX "komponen_penilaian_id_jenis_seminar_role_nama_key" ON "komponen_penilaian"("id_jenis_seminar", "role", "nama");

-- CreateIndex
CREATE INDEX "penilaian_id_jadwal_idx" ON "penilaian"("id_jadwal");

-- CreateIndex
CREATE INDEX "penilaian_nip_idx" ON "penilaian"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "penilaian_id_jadwal_nip_key" ON "penilaian"("id_jadwal", "nip");

-- CreateIndex
CREATE UNIQUE INDEX "penilaian_id_jadwal_role_key" ON "penilaian"("id_jadwal", "role");

-- CreateIndex
CREATE INDEX "detail_penilaian_id_komponen_idx" ON "detail_penilaian"("id_komponen");

-- CreateIndex
CREATE UNIQUE INDEX "detail_penilaian_id_penilaian_id_komponen_key" ON "detail_penilaian"("id_penilaian", "id_komponen");

-- CreateIndex
CREATE INDEX "log_entity_type_entity_id_idx" ON "log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "log_actor_type_actor_id_idx" ON "log"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "log_timestamp_idx" ON "log"("timestamp");

-- CreateIndex
CREATE INDEX "constraint_dosen_nip_idx" ON "constraint_dosen"("nip");

-- CreateIndex
CREATE INDEX "constraint_dosen_type_idx" ON "constraint_dosen"("type");

-- CreateIndex
CREATE INDEX "constraint_dosen_nip_is_active_idx" ON "constraint_dosen"("nip", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "jenis_seminar_kode_key" ON "jenis_seminar"("kode");

-- CreateIndex
CREATE INDEX "jenis_seminar_kode_idx" ON "jenis_seminar"("kode");

-- CreateIndex
CREATE INDEX "bobot_penilai_id_jenis_seminar_idx" ON "bobot_penilai"("id_jenis_seminar");

-- CreateIndex
CREATE UNIQUE INDEX "bobot_penilai_id_jenis_seminar_role_key" ON "bobot_penilai"("id_jenis_seminar", "role");

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_template_kode_key" ON "dokumen_template"("kode");

-- CreateIndex
CREATE INDEX "requirement_dokumen_id_jenis_seminar_idx" ON "requirement_dokumen"("id_jenis_seminar");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_dokumen_id_jenis_seminar_id_dokumen_template_key" ON "requirement_dokumen"("id_jenis_seminar", "id_dokumen_template");

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_id_pengajuan_fst_key" ON "pendaftaran"("id_pengajuan_fst");

-- CreateIndex
CREATE INDEX "pendaftaran_nim_idx" ON "pendaftaran"("nim");

-- CreateIndex
CREATE INDEX "pendaftaran_id_jenis_seminar_idx" ON "pendaftaran"("id_jenis_seminar");

-- CreateIndex
CREATE INDEX "pendaftaran_status_berkas_idx" ON "pendaftaran"("status_berkas");

-- CreateIndex
CREATE INDEX "pendaftaran_kode_tahun_ajaran_id_jenis_seminar_idx" ON "pendaftaran"("kode_tahun_ajaran", "id_jenis_seminar");

-- CreateIndex
CREATE INDEX "data_pendaftaran_id_pendaftaran_idx" ON "data_pendaftaran"("id_pendaftaran");

-- CreateIndex
CREATE UNIQUE INDEX "data_pendaftaran_id_pendaftaran_id_dokumen_template_key" ON "data_pendaftaran"("id_pendaftaran", "id_dokumen_template");

-- AddForeignKey
ALTER TABLE "keahlian_dosen" ADD CONSTRAINT "keahlian_dosen_nip_fkey" FOREIGN KEY ("nip") REFERENCES "dosen"("nip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keahlian_dosen" ADD CONSTRAINT "keahlian_dosen_id_bidang_keahlian_fkey" FOREIGN KEY ("id_bidang_keahlian") REFERENCES "bidang_keahlian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_kode_ruangan_fkey" FOREIGN KEY ("kode_ruangan") REFERENCES "ruangan"("kode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_draft" ADD CONSTRAINT "jadwal_draft_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "komponen_penilaian" ADD CONSTRAINT "komponen_penilaian_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penilaian" ADD CONSTRAINT "penilaian_id_jadwal_fkey" FOREIGN KEY ("id_jadwal") REFERENCES "jadwal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penilaian" ADD CONSTRAINT "penilaian_nip_fkey" FOREIGN KEY ("nip") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_penilaian" ADD CONSTRAINT "detail_penilaian_id_penilaian_fkey" FOREIGN KEY ("id_penilaian") REFERENCES "penilaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_penilaian" ADD CONSTRAINT "detail_penilaian_id_komponen_fkey" FOREIGN KEY ("id_komponen") REFERENCES "komponen_penilaian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_dosen" ADD CONSTRAINT "constraint_dosen_nip_fkey" FOREIGN KEY ("nip") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bobot_penilai" ADD CONSTRAINT "bobot_penilai_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_dokumen" ADD CONSTRAINT "requirement_dokumen_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_dokumen" ADD CONSTRAINT "requirement_dokumen_id_dokumen_template_fkey" FOREIGN KEY ("id_dokumen_template") REFERENCES "dokumen_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_id_jenis_seminar_fkey" FOREIGN KEY ("id_jenis_seminar") REFERENCES "jenis_seminar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_pendaftaran" ADD CONSTRAINT "data_pendaftaran_id_pendaftaran_fkey" FOREIGN KEY ("id_pendaftaran") REFERENCES "pendaftaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_pendaftaran" ADD CONSTRAINT "data_pendaftaran_id_dokumen_template_fkey" FOREIGN KEY ("id_dokumen_template") REFERENCES "dokumen_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
