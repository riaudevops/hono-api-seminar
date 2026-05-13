import { z } from 'zod';

export const getAllRequirementDokumenQuerySchema = z.object({
  jenis_seminar: z.string().optional(),
  dokumen_template: z.string().optional(),
  is_wajib: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === 'true'
    ),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const idJenisSeminarSchema = z
  .string()
  .min(1, 'ID jenis seminar tidak boleh kosong');

const idDokumenTemplateSchema = z
  .string()
  .min(1, 'ID dokumen template tidak boleh kosong');

const urutanSchema = z
  .number()
  .int('Urutan harus bilangan bulat')
  .min(0, 'Urutan tidak boleh negatif')
  .max(999, 'Urutan maksimal 999');

const keteranganSchema = z
  .string()
  .max(1000, 'Keterangan maksimal 1000 karakter')
  .nullable()
  .optional();

export const postRequirementDokumenSchema = z.object({
  id_jenis_seminar: idJenisSeminarSchema,
  id_dokumen_template: idDokumenTemplateSchema,
  urutan: urutanSchema.optional(),
  is_wajib: z.boolean().optional(),
  keterangan_tambahan: keteranganSchema,
});

export const putRequirementDokumenSchema = z.object({
  id_jenis_seminar: idJenisSeminarSchema.optional(),
  id_dokumen_template: idDokumenTemplateSchema.optional(),
  urutan: urutanSchema.optional(),
  is_wajib: z.boolean().optional(),
  keterangan_tambahan: keteranganSchema,
});
