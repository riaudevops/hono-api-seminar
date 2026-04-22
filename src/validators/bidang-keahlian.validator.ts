import { z } from 'zod';

export const createBidangKeahlianSchema = z.object({
  nama: z
    .string()
    .min(1, 'Nama bidang keahlian tidak boleh kosong')
    .max(100, 'Nama bidang keahlian maksimal 100 karakter'),
});

export const updateBidangKeahlianSchema = z
  .object({
    nama: z
      .string()
      .min(1, 'Nama bidang keahlian tidak boleh kosong')
      .max(100, 'Nama bidang keahlian maksimal 100 karakter')
      .optional(),
  })
  .refine((data) => data.nama !== undefined, {
    message: 'Minimal satu field harus diisi untuk update',
  });
