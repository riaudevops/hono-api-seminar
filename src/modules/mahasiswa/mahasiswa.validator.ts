import { z } from 'zod';

const noHpSchema = z
  .string()
  .min(8, 'Nomor HP minimal 8 digit')
  .max(14, 'Nomor HP maksimal 14 digit')
  .regex(/^[0-9+]+$/, 'Nomor HP hanya boleh berisi angka dan tanda +');

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const getAllMahasiswaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: optionalTrimmedString,
  nim: optionalTrimmedString,
  nama: optionalTrimmedString,
  email: optionalTrimmedString,
  no_hp: optionalTrimmedString,
  aktif: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  angkatan: z.coerce.number().int().min(2000).max(2099).optional(),
  sortBy: z.enum(['nim', 'nama', 'email', 'aktif']).default('nama'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const putDataSayaSchema = z.object({
  no_hp: noHpSchema.nullable(),
});
