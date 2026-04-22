import { LogActionType, LogActorType } from '@prisma/client';
import { z } from 'zod';

export const createLogJadwalSchema = z.object({
  action: z.nativeEnum(LogActionType, {
    errorMap: () => ({ message: 'Action log jadwal tidak valid' }),
  }),
  actor_type: z.nativeEnum(LogActorType, {
    errorMap: () => ({ message: 'Actor type log jadwal tidak valid' }),
  }),
  actor_id: z.string().min(1, 'Actor ID wajib diisi'),
  jadwal_id: z.string().min(1, 'Jadwal ID wajib diisi'),
  old_values: z.record(z.unknown()).optional(),
  new_values: z.record(z.unknown()).optional(),
});

export const updateLogJadwalSchema = z
  .object({
    action: z
      .nativeEnum(LogActionType, {
        errorMap: () => ({ message: 'Action log jadwal tidak valid' }),
      })
      .optional(),
    actor_type: z
      .nativeEnum(LogActorType, {
        errorMap: () => ({ message: 'Actor type log jadwal tidak valid' }),
      })
      .optional(),
    actor_id: z.string().min(1, 'Actor ID wajib diisi').optional(),
    jadwal_id: z.string().min(1, 'Jadwal ID wajib diisi').optional(),
    old_values: z.record(z.unknown()).nullable().optional(),
    new_values: z.record(z.unknown()).nullable().optional(),
  })
  .refine(
    (data) =>
      data.action !== undefined ||
      data.actor_type !== undefined ||
      data.actor_id !== undefined ||
      data.jadwal_id !== undefined ||
      data.old_values !== undefined ||
      data.new_values !== undefined,
    {
      message: 'Minimal satu field harus diisi untuk update',
    }
  );

export const getLogJadwalQuerySchema = z.object({
  jadwal_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_type: z.nativeEnum(LogActorType).optional(),
  action: z.nativeEnum(LogActionType).optional(),
});
