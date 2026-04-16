import { z } from 'zod';

// =============================================================================
// Constraint Output Schema — untuk LLM structured output
// =============================================================================

export const ParsedConstraintSchema = z.object({
  type: z.enum(['AVAILABLE_TIME', 'UNAVAILABLE_TIME', 'PREFERENCE', 'LOCATION']),
  hari: z.number().int().min(1).max(7).nullable(),
  waktu_mulai: z.string().nullable(),
  waktu_selesai: z.string().nullable(),
  keterangan: z.string(),
  priority: z.number().int().min(1).max(5),
});

export const ParseConstraintOutputSchema = z.object({
  constraints: z.array(ParsedConstraintSchema),
});

// =============================================================================
// Type exports
// =============================================================================
export type ParsedConstraint = z.infer<typeof ParsedConstraintSchema>;
export type ParseConstraintOutput = z.infer<typeof ParseConstraintOutputSchema>;
