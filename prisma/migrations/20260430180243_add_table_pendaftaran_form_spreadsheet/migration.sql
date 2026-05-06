-- CreateEnum
CREATE TYPE "StatusBerkas" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "pendaftaran" (
    "id" TEXT NOT NULL,
    "nim" VARCHAR(11) NOT NULL,
    "nama" VARCHAR(255) NOT NULL,
    "semester" INTEGER NOT NULL,
    "id_pengajuan_fst" VARCHAR(50) NOT NULL,
    "no_wa" VARCHAR(15) NOT NULL,
    "jenis_seminar" "JenisJadwal" NOT NULL,
    "nip_pembimbing_1" VARCHAR(18) NOT NULL,
    "nip_pembimbing_2" VARCHAR(18),
    "nip_penguji_1" VARCHAR(18) NOT NULL,
    "nip_penguji_2" VARCHAR(18) NOT NULL,
    "mata_kuliah_pilihan" JSONB,
    "berkas_syarat_url" TEXT NOT NULL,
    "undangan_sebelumnya_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_berkas" "StatusBerkas" NOT NULL DEFAULT 'PENDING',
    "status_proses" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pendaftaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pendaftaran_id_pengajuan_fst_key" ON "pendaftaran"("id_pengajuan_fst");

-- CreateIndex
CREATE INDEX "pendaftaran_nim_idx" ON "pendaftaran"("nim");

-- CreateIndex
CREATE INDEX "pendaftaran_id_pengajuan_fst_idx" ON "pendaftaran"("id_pengajuan_fst");

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nip_pembimbing_1_fkey" FOREIGN KEY ("nip_pembimbing_1") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nip_pembimbing_2_fkey" FOREIGN KEY ("nip_pembimbing_2") REFERENCES "dosen"("nip") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nip_penguji_1_fkey" FOREIGN KEY ("nip_penguji_1") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendaftaran" ADD CONSTRAINT "pendaftaran_nip_penguji_2_fkey" FOREIGN KEY ("nip_penguji_2") REFERENCES "dosen"("nip") ON DELETE RESTRICT ON UPDATE CASCADE;
