import { LogActionType, LogActorType } from '@prisma/client';
import { z } from 'zod';

export const createLogPenilaianSchema = z.object({
  action: z.nativeEnum(LogActionType, {
    errorMap: () => ({ message: 'Action log penilaian tidak valid' }),
  }),
  actor_type: z.nativeEnum(LogActorType, {
    errorMap: () => ({ message: 'Actor type log penilaian tidak valid' }),
  }),
  actor_id: z.string().min(1, 'Actor ID wajib diisi'),
  id_jadwal: z.string().min(1, 'Jadwal ID wajib diisi'),
  id_komponen_penilaian: z.string().min(1, 'Komponen penilaian ID wajib diisi'),
  old_nilai: z.number().nullable().optional(),
  new_nilai: z.number().nullable().optional(),
});

export const updateLogPenilaianSchema = z
  .object({
    action: z
      .nativeEnum(LogActionType, {
        errorMap: () => ({ message: 'Action log penilaian tidak valid' }),
      })
      .optional(),
    actor_type: z
      .nativeEnum(LogActorType, {
        errorMap: () => ({ message: 'Actor type log penilaian tidak valid' }),
      })
      .optional(),
    actor_id: z.string().min(1, 'Actor ID wajib diisi').optional(),
    id_jadwal: z.string().min(1, 'Jadwal ID wajib diisi').optional(),
    id_komponen_penilaian: z
      .string()
      .min(1, 'Komponen penilaian ID wajib diisi')
      .optional(),
    old_nilai: z.number().nullable().optional(),
    new_nilai: z.number().nullable().optional(),
  })
  .refine(
    (data) =>
      data.action !== undefined ||
      data.actor_type !== undefined ||
      data.actor_id !== undefined ||
      data.id_jadwal !== undefined ||
      data.id_komponen_penilaian !== undefined ||
      data.old_nilai !== undefined ||
      data.new_nilai !== undefined,
    {
      message: 'Minimal satu field harus diisi untuk update',
    }
  );

export const getLogPenilaianQuerySchema = z.object({
  id_jadwal: z.string().optional(),
  id_komponen_penilaian: z.string().optional(),
  actor_id: z.string().optional(),
  actor_type: z.nativeEnum(LogActorType).optional(),
  action: z.nativeEnum(LogActionType).optional(),
});
