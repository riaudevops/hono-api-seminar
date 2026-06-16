import { z } from 'zod';

const penilaianItemSchema = z.object({
  komponen_id: z.string().min(1, 'Komponen ID wajib diisi'),
  mahasiswa_nim: z.string().min(1, 'NIM mahasiswa wajib diisi'),
  dosen_nip: z.string().min(1, 'NIP dosen wajib diisi'),
  nilai: z.number().min(0, 'Nilai minimal 0').max(100, 'Nilai maksimal 100'),
});

export const submitNilaiSchema = z
  .object({
    jadwal_id: z.string().min(1, 'Jadwal ID wajib diisi'),
    penilaian: z.array(penilaianItemSchema).min(1, 'Minimal 1 item penilaian'),
  })
  .refine(
    (data) => {
      const nipSet = new Set(data.penilaian.map((p) => p.dosen_nip));
      return nipSet.size === 1;
    },
    { message: 'Semua item penilaian harus dari dosen yang sama (NIP sama)' }
  );

export const getKomponenPenilaianSayaQuerySchema = z.object({
  id_jenis_seminar: z.string().min(1, 'ID jenis seminar wajib diisi'),
  jadwal_id: z.string().min(1, 'ID jadwal wajib diisi'),
});

export const postConstraintSchema = z
  .object({
    type: z.enum([
      'AVAILABLE_TIME',
      'UNAVAILABLE_TIME',
      'PREFERENCE',
      'LOCATION',
    ]),
    hari: z.number().min(1).max(7).optional().nullable(),
    waktu_mulai: z.string().optional().nullable(),
    waktu_selesai: z.string().optional().nullable(),
    keterangan: z.string().optional().nullable(),
    priority: z.number().min(1).max(5).optional().default(1),
    is_active: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      if (data.type === 'AVAILABLE_TIME' || data.type === 'UNAVAILABLE_TIME') {
        return data.hari != null && data.waktu_mulai && data.waktu_selesai;
      }
      return true;
    },
    {
      message:
        'Hari, waktu_mulai, dan waktu_selesai wajib diisi untuk tipe AVAILABLE_TIME atau UNAVAILABLE_TIME',
    }
  );
