import { z } from 'zod';
import { JenisJadwal, PenilaiRole, StatusJadwalDraft } from '@prisma/client';

const dosenAssignmentSchema = z.object({
  nip: z.string().min(1, 'NIP tidak boleh kosong').max(18, 'NIP maksimal 18 karakter'),
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: 'Role penilai tidak valid' }),
  }),
});

const mahasiswaScheduleSchema = z.object({
  nim: z.string().min(1, 'NIM tidak boleh kosong').max(11, 'NIM maksimal 11 karakter'),
  jenis: z.nativeEnum(JenisJadwal, {
    errorMap: () => ({ message: 'Jenis jadwal tidak valid' }),
  }),
  list_dosen: z.array(dosenAssignmentSchema).min(1, 'Minimal 1 dosen penilai'),
});

export const generateJadwalSchema = z
  .object({
    tanggal_mulai: z
      .string()
      .datetime({
        message: 'Format tanggal mulai harus dalam format ISO-8601 DateTime',
      })
      .transform((str) => new Date(str)),
    list_mahasiswa: z
      .array(mahasiswaScheduleSchema)
      .min(1, 'Minimal 1 mahasiswa'),
    catatan_tambahan: z
      .string()
      .max(1000, 'Catatan tambahan maksimal 1000 karakter')
      .optional(),
  })
  .refine(
    (data) => {
      const now = new Date();
      return new Date(data.tanggal_mulai) >= now;
    },
    {
      message: 'Tanggal mulai tidak boleh di masa lalu',
      path: ['tanggal_mulai'],
    }
  )
  .refine(
    (data) => {
      const nims = data.list_mahasiswa.map((m) => m.nim);
      return new Set(nims).size === nims.length;
    },
    {
      message: 'Terdapat NIM yang duplikat dalam daftar mahasiswa',
      path: ['list_mahasiswa'],
    }
  );

export const getDraftsQuerySchema = z.object({
  batch_id: z.string().optional(),
  status: z.nativeEnum(StatusJadwalDraft).optional(),
});

export const updateDraftSchema = z
  .object({
    tanggal: z
      .string()
      .datetime({ message: 'Format tanggal harus ISO-8601 DateTime' })
      .transform((str) => new Date(str))
      .optional(),
    waktu_mulai: z
      .string()
      .datetime({ message: 'Format waktu mulai harus ISO-8601 DateTime' })
      .transform((str) => new Date(str))
      .optional(),
    waktu_selesai: z
      .string()
      .datetime({ message: 'Format waktu selesai harus ISO-8601 DateTime' })
      .transform((str) => new Date(str))
      .optional(),
    kode_ruangan: z
      .string()
      .max(10, 'Kode ruangan maksimal 10 karakter')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.waktu_mulai && data.waktu_selesai) {
        return data.waktu_selesai > data.waktu_mulai;
      }
      return true;
    },
    {
      message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai',
      path: ['waktu_selesai'],
    }
  )
  .refine(
    (data) => {
      if (data.waktu_mulai) {
        const hour = new Date(data.waktu_mulai).getHours();
        return hour >= 8 && hour <= 17;
      }
      return true;
    },
    {
      message: 'Jadwal hanya bisa pada jam kerja (08:00-17:00)',
      path: ['waktu_mulai'],
    }
  );

export const batchIdParamSchema = z.object({
  batch_id: z.string().min(1, 'Batch ID tidak boleh kosong'),
});
