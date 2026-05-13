import { z } from 'zod';

const noHpSchema = z
  .string()
  .min(8, 'Nomor HP minimal 8 digit')
  .max(14, 'Nomor HP maksimal 14 digit')
  .regex(/^[0-9+]+$/, 'Nomor HP hanya boleh berisi angka dan tanda +');

export const putDataSayaSchema = z.object({
  no_hp: noHpSchema.nullable(),
});
