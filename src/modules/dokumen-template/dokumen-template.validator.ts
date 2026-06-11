import { z } from 'zod';

export const getAllDokumenTemplateQuerySchema = z.object({
  jenis_seminar: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const namaSchema = z
  .string()
  .min(1, 'Nama dokumen tidak boleh kosong')
  .max(150, 'Nama dokumen maksimal 150 karakter');

const kodeSchema = z
  .string()
  .min(1, 'Kode dokumen tidak boleh kosong')
  .max(50, 'Kode dokumen maksimal 50 karakter')
  .refine((val) => !/\s/.test(val), {
    message: 'Kode dokumen tidak boleh mengandung spasi',
  })
  .refine((val) => val === val.toUpperCase(), {
    message: 'Kode dokumen harus huruf besar semua',
  });

const deskripsiSchema = z.string().max(1000).nullable().optional();

const tipeInputSchema = z.enum([
  'FILE_UPLOAD',
  'TEXT',
  'URL',
  'BOOLEAN',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
]);

const opsiSchema = z.array(z.string()).nullable().optional();

const formatFileSchema = z
  .string()
  .max(50, 'Format file maksimal 50 karakter')
  .nullable()
  .optional();

const maxSizeMbSchema = z.number().int().min(1).max(100).nullable().optional();

export const postDokumenTemplateSchema = z.object({
  nama: namaSchema,
  kode: kodeSchema,
  deskripsi: deskripsiSchema,
  tipe_input: tipeInputSchema,
  opsi: opsiSchema,
  format_file: formatFileSchema,
  max_size_mb: maxSizeMbSchema,
  is_special: z.boolean().optional(),
  can_view_dosen: z.boolean().optional(),
});

export const putDokumenTemplateSchema = z.object({
  nama: namaSchema.optional(),
  kode: kodeSchema.optional(),
  deskripsi: deskripsiSchema.nullable(),
  tipe_input: tipeInputSchema.optional(),
  opsi: opsiSchema,
  format_file: formatFileSchema,
  max_size_mb: maxSizeMbSchema,
  is_special: z.boolean().optional(),
  can_view_dosen: z.boolean().optional(),
});
