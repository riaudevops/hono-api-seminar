import { z } from 'zod';

export const postRuanganSchema = z.object({
  kode: z
    .string()
    .min(1, 'Kode ruangan tidak boleh kosong')
    .max(10, 'Kode ruangan maksimal 10 karakter')
    .refine((val) => !/\s/.test(val), {
      message: 'Kode ruangan tidak boleh mengandung spasi',
    })
    .refine((val) => val === val.toUpperCase(), {
      message: 'Kode ruangan harus huruf besar semua',
    }),
  nama: z
    .string()
    .min(1, 'Nama ruangan tidak boleh kosong')
    .max(50, 'Nama ruangan maksimal 50 karakter'),
});
