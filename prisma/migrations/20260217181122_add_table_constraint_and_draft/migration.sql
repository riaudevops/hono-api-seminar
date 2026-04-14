-- CreateEnum
CREATE TYPE "StatusJadwalDraft" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('AVAILABLE_TIME', 'UNAVAILABLE_TIME', 'PREFERENCE', 'LOCATION');

-- CreateTable
CREATE TABLE "jadwal_draft" (
    "id" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "tanggal" TIMESTAMPTZ NOT NULL,
    "waktu_mulai" TIMESTAMPTZ NOT NULL,
    "waktu_selesai" TIMESTAMPTZ NOT NULL,
    "ruangan" TEXT NOT NULL,
    "llm_reasoning" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "StatusJadwalDraft" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_draft_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "jadwal_draft_status_idx" ON "jadwal_draft"("status");

-- CreateIndex
CREATE INDEX "constraint_dosen_nip_idx" ON "constraint_dosen"("nip");

-- CreateIndex
CREATE INDEX "constraint_dosen_type_idx" ON "constraint_dosen"("type");

-- AddForeignKey
ALTER TABLE "constraint_dosen" ADD CONSTRAINT "constraint_dosen_nip_fkey" FOREIGN KEY ("nip") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;
