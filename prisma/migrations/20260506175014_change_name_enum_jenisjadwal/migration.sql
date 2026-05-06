/*
  Warnings:

  - The values [SIDANG_TA_LAPORAN,SIDANG_TA_PAPERBASED] on the enum `JenisJadwal` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `pendaftaran` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `pendaftaran` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "JenisJadwal_new" AS ENUM ('SEMKP', 'SEMPRO', 'SEMHAS_LAPORAN', 'SEMHAS_PAPERBASED', 'SIDANG_LAPORAN', 'SIDANG_PAPERBASED');
ALTER TABLE "jadwal" ALTER COLUMN "jenis" TYPE "JenisJadwal_new" USING ("jenis"::text::"JenisJadwal_new");
ALTER TABLE "jadwal_draft" ALTER COLUMN "jenis" TYPE "JenisJadwal_new" USING ("jenis"::text::"JenisJadwal_new");
ALTER TABLE "pendaftaran" ALTER COLUMN "jenis_seminar" TYPE "JenisJadwal_new" USING ("jenis_seminar"::text::"JenisJadwal_new");
ALTER TYPE "JenisJadwal" RENAME TO "JenisJadwal_old";
ALTER TYPE "JenisJadwal_new" RENAME TO "JenisJadwal";
DROP TYPE "public"."JenisJadwal_old";
COMMIT;

-- AlterTable
ALTER TABLE "pendaftaran" DROP CONSTRAINT "pendaftaran_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ADD CONSTRAINT "pendaftaran_pkey" PRIMARY KEY ("id");
