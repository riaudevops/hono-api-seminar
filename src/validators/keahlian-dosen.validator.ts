import { z } from 'zod';

export const createKeahlianDosenSchema = z.object({
  nip: z
    .string()
    .min(1, 'NIP dosen tidak boleh kosong')
    .max(18, 'NIP dosen maksimal 18 karakter')
    .refine((val) => !/\s/.test(val), {
      message: 'NIP dosen tidak boleh mengandung spasi',
    }),
  id_bidang_keahlian: z
    .string()
    .min(1, 'ID bidang keahlian tidak boleh kosong'),
});

export const updateKeahlianDosenSchema = z
  .object({
    nip: z
      .string()
      .min(1, 'NIP dosen tidak boleh kosong')
      .max(18, 'NIP dosen maksimal 18 karakter')
      .refine((val) => !/\s/.test(val), {
        message: 'NIP dosen tidak boleh mengandung spasi',
      })
      .optional(),
    id_bidang_keahlian: z
      .string()
      .min(1, 'ID bidang keahlian tidak boleh kosong')
      .optional(),
  })
  .refine(
    (data) => data.nip !== undefined || data.id_bidang_keahlian !== undefined,
    {
      message: 'Minimal satu field harus diisi untuk update',
    }
  );

export const getKeahlianDosenQuerySchema = z.object({
  nip: z
    .string()
    .max(18, 'NIP dosen maksimal 18 karakter')
    .refine((val) => !/\s/.test(val), {
      message: 'NIP dosen tidak boleh mengandung spasi',
    })
    .optional(),
  id_bidang_keahlian: z.string().optional(),
  bidang: z.string().optional(),
});
