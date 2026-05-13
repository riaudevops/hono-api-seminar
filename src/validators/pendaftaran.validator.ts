import { z } from 'zod';
import { StatusBerkas } from '@prisma/client';

const KODE_JENIS_VALUES = [
  'SEMKP',
  'SEMPRO',
  'SEMHAS_LAPORAN',
  'SEMHAS_PAPERBASED',
  'SIDANG_LAPORAN',
  'SIDANG_PAPERBASED',
] as const;

export const postPendaftaranSchema = z.object({
  id_pengajuan_fst: z.string().max(50, 'ID Pengajuan FST maksimal 50 karakter'),
  no_wa: z.string().max(15, 'No. WA maksimal 15 karakter'),
  id_jenis_seminar: z.string().optional(),
  kode_jenis: z.enum(KODE_JENIS_VALUES).optional(),
  judul: z.string().max(255, 'Judul maksimal 255 karakter').optional(),
  nip_pembimbing_1: z.string().max(18, 'NIP maksimal 18 karakter'),
  nip_pembimbing_2: z.string().max(18).nullable().optional(),
  nip_penguji_1: z.string().max(18, 'NIP maksimal 18 karakter'),
  nip_penguji_2: z.string().max(18, 'NIP maksimal 18 karakter'),
  mata_kuliah_pilihan: z.any().optional(),
  berkas_syarat_url: z.string().min(1, 'URL berkas syarat wajib diisi'),
  undangan_sebelumnya_url: z.string().nullable().optional(),
  created_at: z.coerce.date().optional(),
  status_berkas: z.nativeEnum(StatusBerkas).default('PENDING'),
}).refine(
  (d) => d.id_jenis_seminar || d.kode_jenis,
  { message: 'Field id_jenis_seminar atau kode_jenis wajib diisi', path: ['kode_jenis'] }
).refine(
  (data) => {
    const nips = [
      data.nip_pembimbing_1,
      data.nip_pembimbing_2,
      data.nip_penguji_1,
      data.nip_penguji_2,
    ].filter(Boolean);
    return new Set(nips).size === nips.length;
  },
  { message: 'NIP pembimbing dan penguji tidak boleh sama' },
);

export const putPendaftaranSchema = z.object({
  no_wa: z.string().max(15).optional(),
  id_jenis_seminar: z.string().optional(),
  kode_jenis: z.enum(KODE_JENIS_VALUES).optional(),
  judul: z.string().max(255).optional(),
  nip_pembimbing_1: z.string().max(18).optional(),
  nip_pembimbing_2: z.string().max(18).nullable().optional(),
  nip_penguji_1: z.string().max(18).optional(),
  nip_penguji_2: z.string().max(18).optional(),
  mata_kuliah_pilihan: z.any().optional(),
  berkas_syarat_url: z.string().optional(),
  undangan_sebelumnya_url: z.string().nullable().optional(),
}).refine(
  (data) => {
    const nips = [
      data.nip_pembimbing_1,
      data.nip_pembimbing_2,
      data.nip_penguji_1,
      data.nip_penguji_2,
    ].filter(Boolean);
    return new Set(nips).size === nips.length;
  },
  { message: 'NIP pembimbing dan penguji tidak boleh sama' },
);

export const validateBerkasSchema = z.object({
  status_berkas: z.nativeEnum(StatusBerkas),
});
