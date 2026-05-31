import { z } from 'zod';
import { PenilaiRole } from '@prisma/client';

const persentaseSchema = z
  .number()
  .int('Persentase harus bilangan bulat')
  .min(0, 'Persentase minimal 0')
  .max(100, 'Persentase maksimal 100');

const bobotItemSchema = z.object({
  role: z.nativeEnum(PenilaiRole),
  persentase: persentaseSchema,
});

export const upsertBobotPenilaiSchema = z
  .object({
    id_jenis_seminar: z.string().min(1, 'id_jenis_seminar wajib diisi'),
    bobot: z.array(bobotItemSchema).min(1, 'Minimal satu role harus diisi'),
  })
  .refine(
    (data) => {
      const total = data.bobot.reduce((sum, b) => sum + b.persentase, 0);
      return total === 100;
    },
    {
      message: 'Total persentase semua role harus tepat 100%',
      path: ['bobot'],
    }
  )
  .refine(
    (data) => {
      const roles = data.bobot.map((b) => b.role);
      return new Set(roles).size === roles.length;
    },
    {
      message: 'Role tidak boleh duplikat dalam satu jenis seminar',
      path: ['bobot'],
    }
  );

export const updateSingleBobotSchema = z.object({
  persentase: persentaseSchema,
});

export const getBobotByJenisSeminarParamSchema = z.object({
  id_jenis_seminar: z.string().min(1),
});
