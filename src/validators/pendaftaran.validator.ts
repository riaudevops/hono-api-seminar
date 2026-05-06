import { z } from 'zod';
import { JenisJadwal, StatusBerkas } from '@prisma/client';

export const postPendaftaranSchema = z.object({
  id_pengajuan_fst: z.string().max(50, 'ID Pengajuan FST maksimal 50 karakter'),
  no_wa: z.string().max(15, 'No. WA maksimal 15 karakter'),
  jenis_seminar: z.nativeEnum(JenisJadwal),
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
  status_proses: z.boolean().default(false),
});

export const putPendaftaranSchema = z.object({
  nama: z.string().max(255).optional(),
  semester: z.number().int().min(1).optional(),
  no_wa: z.string().max(15).optional(),
  jenis_seminar: z.nativeEnum(JenisJadwal).optional(),
  judul: z.string().max(255).optional(),
  nip_pembimbing_1: z.string().max(18).optional(),
  nip_pembimbing_2: z.string().max(18).nullable().optional(),
  nip_penguji_1: z.string().max(18).optional(),
  nip_penguji_2: z.string().max(18).optional(),
  mata_kuliah_pilihan: z.any().optional(),
  berkas_syarat_url: z.string().optional(),
  undangan_sebelumnya_url: z.string().nullable().optional(),
});

export const validateBerkasSchema = z.object({
  status_berkas: z.nativeEnum(StatusBerkas),
});
