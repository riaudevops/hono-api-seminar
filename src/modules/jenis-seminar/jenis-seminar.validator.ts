import { z } from 'zod';

const kodeSchema = z
  .string()
  .min(1, 'Kode jenis seminar tidak boleh kosong')
  .max(20, 'Kode jenis seminar maksimal 20 karakter')
  .refine((val) => !/\s/.test(val), {
    message: 'Kode jenis seminar tidak boleh mengandung spasi',
  })
  .refine((val) => val === val.toUpperCase(), {
    message: 'Kode jenis seminar harus huruf besar semua',
  });

const namaSchema = z
  .string()
  .min(1, 'Nama jenis seminar tidak boleh kosong')
  .max(100, 'Nama jenis seminar maksimal 100 karakter');

const deskripsiSchema = z
  .string()
  .max(1000, 'Deskripsi maksimal 1000 karakter')
  .optional();

const jumlahSchema = z
  .number()
  .int('Harus bilangan bulat')
  .min(0, 'Tidak boleh negatif')
  .max(10, 'Maksimal 10');

export const postJenisSeminarSchema = z.object({
  kode: kodeSchema,
  nama: namaSchema,
  deskripsi: deskripsiSchema,
  is_aktif: z.boolean().optional(),
  jumlah_pembimbing: jumlahSchema.optional(),
  jumlah_penguji: jumlahSchema.optional(),
  ada_ketua_sidang: z.boolean().optional(),
});

export const putJenisSeminarSchema = z.object({
  kode: kodeSchema.optional(),
  nama: namaSchema.optional(),
  deskripsi: deskripsiSchema.nullable(),
  is_aktif: z.boolean().optional(),
  jumlah_pembimbing: jumlahSchema.optional(),
  jumlah_penguji: jumlahSchema.optional(),
  ada_ketua_sidang: z.boolean().optional(),
});
