import { z } from 'zod';
import { ConstraintType } from '@prisma/client';

export const postConstraintSchema = z
  .object({
    type: z.nativeEnum(ConstraintType, {
      errorMap: () => ({ message: 'Tipe constraint tidak valid' }),
    }),
    hari: z
      .number()
      .int('Hari harus berupa bilangan bulat')
      .min(1, 'Hari minimal 1 (Senin)')
      .max(7, 'Hari maksimal 7 (Minggu)')
      .optional(),
    waktu_mulai: z
      .string()
      .datetime({
        message: 'Format waktu mulai harus dalam format ISO-8601 DateTime',
      })
      .optional(),
    waktu_selesai: z
      .string()
      .datetime({
        message: 'Format waktu selesai harus dalam format ISO-8601 DateTime',
      })
      .optional(),
    keterangan: z
      .string()
      .max(500, 'Keterangan maksimal 500 karakter')
      .optional(),
    priority: z
      .number()
      .int('Prioritas harus berupa bilangan bulat')
      .min(1, 'Prioritas minimal 1')
      .max(5, 'Prioritas maksimal 5')
      .default(1),
    raw_data: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.waktu_mulai && data.waktu_selesai) {
        return new Date(data.waktu_selesai) > new Date(data.waktu_mulai);
      }
      return true;
    },
    {
      message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai',
      path: ['waktu_selesai'],
    }
  );

export const putConstraintSchema = z
  .object({
    type: z
      .nativeEnum(ConstraintType, {
        errorMap: () => ({ message: 'Tipe constraint tidak valid' }),
      })
      .optional(),
    hari: z
      .number()
      .int('Hari harus berupa bilangan bulat')
      .min(1, 'Hari minimal 1 (Senin)')
      .max(7, 'Hari maksimal 7 (Minggu)')
      .nullable()
      .optional(),
    waktu_mulai: z
      .string()
      .datetime({
        message: 'Format waktu mulai harus dalam format ISO-8601 DateTime',
      })
      .nullable()
      .optional(),
    waktu_selesai: z
      .string()
      .datetime({
        message: 'Format waktu selesai harus dalam format ISO-8601 DateTime',
      })
      .nullable()
      .optional(),
    keterangan: z
      .string()
      .max(500, 'Keterangan maksimal 500 karakter')
      .nullable()
      .optional(),
    priority: z
      .number()
      .int('Prioritas harus berupa bilangan bulat')
      .min(1, 'Prioritas minimal 1')
      .max(5, 'Prioritas maksimal 5')
      .optional(),
    is_active: z.boolean().optional(),
    raw_data: z.record(z.unknown()).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.waktu_mulai && data.waktu_selesai) {
        return new Date(data.waktu_selesai) > new Date(data.waktu_mulai);
      }
      return true;
    },
    {
      message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai',
      path: ['waktu_selesai'],
    }
  );

export const chatConstraintSchema = z.object({
  message: z
    .string()
    .min(3, 'Pesan minimal 3 karakter')
    .max(1000, 'Pesan maksimal 1000 karakter'),
});
