/*
  Warnings:

  - You are about to drop the column `ruangan` on the `jadwal_draft` table. All the data in the column will be lost.
  - Added the required column `batch_id` to the `jadwal_draft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenis` to the `jadwal_draft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `judul` to the `jadwal_draft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kode_ruangan` to the `jadwal_draft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `list_dosen` to the `jadwal_draft` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "jadwal_draft_status_idx";

-- AlterTable
ALTER TABLE "jadwal" ADD COLUMN     "judul" VARCHAR(255);

-- AlterTable
ALTER TABLE "jadwal_draft" DROP COLUMN "ruangan",
ADD COLUMN     "batch_id" VARCHAR(20) NOT NULL,
ADD COLUMN     "jenis" "JenisJadwal" NOT NULL,
ADD COLUMN     "judul" VARCHAR(255) NOT NULL,
ADD COLUMN     "kode_ruangan" VARCHAR(10) NOT NULL,
ADD COLUMN     "list_dosen" JSONB NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

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

-- CreateIndex
CREATE UNIQUE INDEX "bidang_keahlian_nama_key" ON "bidang_keahlian"("nama");

-- CreateIndex
CREATE INDEX "keahlian_dosen_nip_idx" ON "keahlian_dosen"("nip");

-- CreateIndex
CREATE INDEX "keahlian_dosen_id_bidang_keahlian_idx" ON "keahlian_dosen"("id_bidang_keahlian");

-- CreateIndex
CREATE UNIQUE INDEX "keahlian_dosen_nip_id_bidang_keahlian_key" ON "keahlian_dosen"("nip", "id_bidang_keahlian");

-- AddForeignKey
ALTER TABLE "keahlian_dosen" ADD CONSTRAINT "keahlian_dosen_nip_fkey" FOREIGN KEY ("nip") REFERENCES "dosen"("nip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keahlian_dosen" ADD CONSTRAINT "keahlian_dosen_id_bidang_keahlian_fkey" FOREIGN KEY ("id_bidang_keahlian") REFERENCES "bidang_keahlian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
