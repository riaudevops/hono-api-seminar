import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import { z } from 'zod';

export const getLogQuerySchema = z.object({
  entity_type: z.nativeEnum(LogEntityType).optional(),
  entity_id: z.string().min(1).optional(),
  actor_id: z.string().min(1).optional(),
  actor_type: z.nativeEnum(LogActorType).optional(),
  action: z.nativeEnum(LogActionType).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});
