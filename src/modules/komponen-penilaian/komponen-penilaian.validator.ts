import { z } from 'zod';
import { PenilaiRole } from '@prisma/client';

export const getAllKomponenPenilaianQuerySchema = z.object({
  role: z.nativeEnum(PenilaiRole).optional(),
  id_jenis_seminar: z
    .string()
    .min(1, 'ID jenis seminar wajib diisi')
    .optional(),
  is_aktif: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const getKomponenByRoleParamSchema = z.object({
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: 'Role penilai tidak valid' }),
  }),
});

export const getKomponenByRoleQuerySchema = z.object({
  id_jenis_seminar: z
    .string()
    .min(1, 'ID jenis seminar wajib diisi')
    .optional(),
  is_aktif: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const createKomponenPenilaianSchema = z.object({
  nama: z
    .string()
    .min(1, 'Nama komponen wajib diisi')
    .max(50, 'Nama komponen maksimal 50 karakter'),
  persentase: z
    .number()
    .int('Persentase harus berupa bilangan bulat')
    .min(1, 'Persentase minimal 1%')
    .max(100, 'Persentase maksimal 100%'),
  is_aktif: z.boolean().default(true),
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: 'Role penilai tidak valid' }),
  }),
  id_jenis_seminar: z.string().min(1, 'ID jenis seminar wajib diisi'),
});

export const updateKomponenPenilaianSchema = z.object({
  nama: z
    .string()
    .min(1, 'Nama komponen wajib diisi')
    .max(50, 'Nama komponen maksimal 50 karakter')
    .optional(),
  persentase: z
    .number()
    .int('Persentase harus berupa bilangan bulat')
    .min(1, 'Persentase minimal 1%')
    .max(100, 'Persentase maksimal 100%')
    .optional(),
  is_aktif: z.boolean().optional(),
  role: z
    .nativeEnum(PenilaiRole, {
      errorMap: () => ({ message: 'Role penilai tidak valid' }),
    })
    .optional(),
  id_jenis_seminar: z
    .string()
    .min(1, 'ID jenis seminar wajib diisi')
    .optional(),
});

export const toggleStatusKomponenSchema = z.object({
  is_aktif: z.boolean({
    required_error: 'Status aktif wajib diisi',
  }),
});
