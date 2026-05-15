import { z } from 'zod';
import { StatusBerkas } from '@prisma/client';

export const getAllPendaftaranQuerySchema = z.object({
  periode: z.enum(['last_7_hari', 'last_30_hari', 'semua']).optional(),
  jenis_seminar: z.string().optional(),
  status_berkas: z.nativeEnum(StatusBerkas).optional(),
  tahun_ajaran: z.string().optional(),
  nim: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const dashboardQuerySchema = z.object({
  tahun_ajaran: z.string().optional(),
});

export const dashboardQuerySchema = z.object({
  tahun_ajaran: z.string().optional(),
});

const tahunAjaranSchema = z
  .string()
  .max(5, 'Tahun ajaran maksimal 5 karakter');

const idPengajuanFstSchema = z
  .string()
  .min(1, 'ID Pengajuan FST tidak boleh kosong')
  .max(50, 'ID Pengajuan FST maksimal 50 karakter');

const idJenisSeminarSchema = z
  .string()
  .min(1, 'ID jenis seminar tidak boleh kosong');

const nipSchema = z
  .string()
  .min(1, 'NIP tidak boleh kosong')
  .max(18, 'NIP maksimal 18 karakter');

const nipNullableSchema = z
  .string()
  .max(18, 'NIP maksimal 18 karakter')
  .nullable()
  .optional();

const dokumenNilaiSchema: z.ZodType = z.record(
  z.string(),
  z.union([
    z.string(),
    z.boolean(),
    z.array(z.string()),
    z.null(),
  ])
);

const uniqueNipRefinement = (data: {
  nip_pembimbing_1?: string | null;
  nip_pembimbing_2?: string | null;
  nip_penguji_1?: string | null;
  nip_penguji_2?: string | null;
  nip_ketua_sidang?: string | null;
}) => {
  const nips = [
    data.nip_pembimbing_1,
    data.nip_pembimbing_2,
    data.nip_penguji_1,
    data.nip_penguji_2,
    data.nip_ketua_sidang,
  ].filter((nip): nip is string => !!nip);
  return new Set(nips).size === nips.length;
};

// Mahasiswa create — NIM diambil dari JWT, bukan body
export const postPendaftaranMahasiswaSchema = z
  .object({
    id_pengajuan_fst: idPengajuanFstSchema,
    id_jenis_seminar: idJenisSeminarSchema,
    nip_pembimbing_1: nipSchema,
    nip_pembimbing_2: nipNullableSchema,
    nip_penguji_1: nipNullableSchema,
    nip_penguji_2: nipNullableSchema,
    nip_ketua_sidang: nipNullableSchema,
    dokumen: dokumenNilaiSchema.optional(),
  })
  .refine(uniqueNipRefinement, {
    message: 'NIP pembimbing, penguji, dan ketua sidang tidak boleh sama',
  });

// Mahasiswa update — hanya field yang boleh direvisi mahasiswa
export const putPendaftaranMahasiswaSchema = z
  .object({
    id_pengajuan_fst: idPengajuanFstSchema.optional(),
    id_jenis_seminar: idJenisSeminarSchema.optional(),
    nip_pembimbing_1: nipSchema.optional(),
    nip_pembimbing_2: nipNullableSchema,
    nip_penguji_1: nipNullableSchema,
    nip_penguji_2: nipNullableSchema,
    nip_ketua_sidang: nipNullableSchema,
    dokumen: dokumenNilaiSchema.optional(),
  })
  .refine(uniqueNipRefinement, {
    message: 'NIP pembimbing, penguji, dan ketua sidang tidak boleh sama',
  });

// Koordinator validasi status berkas
export const patchStatusBerkasSchema = z.object({
  status_berkas: z.nativeEnum(StatusBerkas),
});
