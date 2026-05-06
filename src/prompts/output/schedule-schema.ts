import { z } from 'zod';

// =============================================================================
// Output Schema — Zod Schema → JSON Schema, Fresh
// =============================================================================
// Schema untuk structured output AI scheduler.
// Gunakan `toJSONSchema()` untuk mendapatkan JSON Schema yang bisa dikirim ke LLM.
// =============================================================================

// --- Common ---

const TimeSlotSchema = z.object({
  tanggal: z.string().describe('Format YYYY-MM-DD'),
  waktu_mulai: z.string().describe('Format HH:mm WIB'),
  waktu_selesai: z.string().describe('Format HH:mm WIB'),
  kode_ruangan: z.string().describe('Kode ruangan (misal: R-101)'),
});

// --- Create Schedule Output ---

const ScheduleSuggestionSchema = TimeSlotSchema.extend({
  confidence: z.number().min(0).max(1).describe('Skor keyakinan AI (0.0-1.0)'),
  reasoning: z.string().describe('Alasan pemilihan slot ini'),
});

export const CreateScheduleOutputSchema = z.object({
  suggestions: z
    .array(ScheduleSuggestionSchema)
    .describe('Daftar slot yang diusulkan'),
});

// --- Resolve Conflict Output ---

const ConflictSolutionSchema = z.object({
  action: z
    .enum(['RESCHEDULE', 'SWAP_ROOM', 'SWAP_TIME', 'UNRESOLVABLE'])
    .describe('Tipe aksi penyelesaian'),
  jadwal_id: z.string().describe('ID jadwal yang perlu diubah'),
  slot_baru: TimeSlotSchema.optional().describe(
    'Slot pengganti (jika RESCHEDULE/SWAP)'
  ),
});

const ConflictSchema = z.object({
  konflik_id: z.string().describe('ID jadwal yang bentrok'),
  tipe: z.enum(['RUANGAN', 'DOSEN', 'CONSTRAINT']).describe('Jenis konflik'),
  severity: z.enum(['critical', 'warning']).describe('Tingkat keparahan'),
  deskripsi: z.string().describe('Deskripsi konflik'),
  solusi: ConflictSolutionSchema.describe('Langkah penyelesaian'),
  reasoning: z.string().describe('Alasan pemilihan solusi ini'),
});

export const ResolveConflictOutputSchema = z.object({
  conflicts: z
    .array(ConflictSchema)
    .describe('Daftar konflik dan penyelesaiannya'),
});

// --- Suggest Alternatives Output ---

const AlternativeSchema = TimeSlotSchema.extend({
  rank: z.number().int().min(1).describe('Peringkat alternatif (1 = terbaik)'),
  label: z.string().describe('Label singkat alternatif'),
  trade_offs: z.array(z.string()).describe('Kompromi yang harus diterima'),
  keuntungan: z.array(z.string()).describe('Keuntungan alternatif ini'),
  confidence: z.number().min(0).max(1).describe('Skor keyakinan (0.0-1.0)'),
});

export const SuggestAlternativesOutputSchema = z.object({
  original_request: z
    .object({
      nim: z.string(),
      jenis: z.string(),
      preferred_date: z.string().describe('Tanggal yang diminta (YYYY-MM-DD)'),
    })
    .describe('Permintaan awal'),
  alternatives: z.array(AlternativeSchema).describe('Daftar alternatif jadwal'),
  reasoning: z.string().describe('Penjelasan keseluruhan'),
});

// =============================================================================
// JSON Schema export — untuk dikirim ke LLM sebagai response_format
// =============================================================================
export function toJSONSchema(
  schema:
    | typeof CreateScheduleOutputSchema
    | typeof ResolveConflictOutputSchema
    | typeof SuggestAlternativesOutputSchema
): Record<string, unknown> {
  return zodToJsonSchema(schema);
}

/** Minimal Zod → JSON Schema converter (tanpa dependency tambahan) */
function zodToJsonSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  return zodSchema._def
    ? convertZodDef(zodSchema._def, zodSchema.description)
    : { type: 'object' };
}

function convertZodDef(
  def: Record<string, unknown>,
  description?: string
): Record<string, unknown> {
  const base = description ? { description } : {};

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (def as any).shape() as Record<string, z.ZodTypeAny>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertZodDef(
          (value as any)._def,
          (value as any).description
        );
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      return { ...base, type: 'object', properties, required };
    }
    case 'ZodArray': {
      return {
        ...base,
        type: 'array',
        items: convertZodDef((def as any).type._def),
      };
    }
    case 'ZodString':
      return { ...base, type: 'string' };
    case 'ZodNumber':
      return { ...base, type: 'number' };
    case 'ZodEnum':
      return { ...base, type: 'string', enum: (def as any).values };
    case 'ZodOptional':
      return convertZodDef((def as any).innerType._def, description);
    default:
      return { ...base, type: 'object' };
  }
}

// --- Generate Batch Schedule Output ---

const BatchScheduleSuggestionSchema = TimeSlotSchema.extend({
  nim: z.string().describe('NIM mahasiswa'),
  jenis: z.string().describe('Jenis seminar (misal: SEMPRO, SIDANG_LAPORAN)'),
  confidence: z.number().min(0).max(1).describe('Skor keyakinan AI (0.0-1.0)'),
  reasoning: z.string().describe('Alasan pemilihan slot ini'),
});

export const GenerateBatchOutputSchema = z.object({
  suggestions: z
    .array(BatchScheduleSuggestionSchema)
    .describe('Daftar jadwal yang diusulkan, satu per mahasiswa'),
});

// =============================================================================
// Type exports
// =============================================================================
export type CreateScheduleOutput = z.infer<typeof CreateScheduleOutputSchema>;
export type ResolveConflictOutput = z.infer<typeof ResolveConflictOutputSchema>;
export type SuggestAlternativesOutput = z.infer<
  typeof SuggestAlternativesOutputSchema
>;
export type GenerateBatchOutput = z.infer<typeof GenerateBatchOutputSchema>;
