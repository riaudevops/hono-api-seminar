-- AlterEnum
ALTER TYPE "PenilaiRole" ADD VALUE 'ARTIKEL_TA';

-- DropIndex
DROP INDEX "penilaian_id_jadwal_nip_key";

-- CreateIndex
CREATE UNIQUE INDEX "penilaian_id_jadwal_nip_role_key" ON "penilaian"("id_jadwal", "nip", "role");
