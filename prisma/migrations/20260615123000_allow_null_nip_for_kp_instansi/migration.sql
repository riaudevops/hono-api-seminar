-- Allow penilaian records without an assigned dosen.
-- Used for roles such as KP_INSTANSI where the value can be input by koordinator KP.
ALTER TABLE "penilaian" ALTER COLUMN "nip" DROP NOT NULL;
