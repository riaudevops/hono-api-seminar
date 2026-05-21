import { z } from 'zod';

export const idPenilaianParamSchema = z.object({
  id_penilaian: z.string().min(1, 'ID penilaian wajib diisi'),
});

export const idJadwalParamSchema = z.object({
  id_jadwal: z.string().min(1, 'ID jadwal wajib diisi'),
});

export const upsertDetailPenilaianSchema = z.object({
  details: z
    .array(
      z.object({
        id_komponen: z.string().min(1, 'ID komponen wajib diisi'),
        nilai: z
          .number()
          .min(0, 'Nilai minimal 0')
          .max(100, 'Nilai maksimal 100'),
        catatan: z.string().trim().optional().nullable(),
      })
    )
    .min(1, 'Minimal satu detail penilaian harus diisi')
    .refine(
      (details) =>
        new Set(details.map((detail) => detail.id_komponen)).size ===
        details.length,
      'Komponen penilaian tidak boleh duplikat'
    ),
});
