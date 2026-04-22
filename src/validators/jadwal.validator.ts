import { z } from 'zod';
import { JenisJadwal } from '@prisma/client';

export const postPutJadwalSchema = z
  .object({
    tanggal: z
      .string()
      .datetime({
        message:
          'Format tanggal harus dalam format ISO-8601 DateTime (contoh: 2025-10-14T00:00:00.000Z)',
      })
      .transform((str) => new Date(str)),
    waktu_mulai: z
      .string()
      .datetime({
        message:
          'Format waktu mulai harus dalam format ISO-8601 DateTime (contoh: 2025-10-14T08:00:00.000Z)',
      })
      .transform((str) => new Date(str)),
    waktu_selesai: z
      .string()
      .datetime({
        message:
          'Format waktu selesai harus dalam format ISO-8601 DateTime (contoh: 2025-10-14T09:00:00.000Z)',
      })
      .transform((str) => new Date(str)),
    jenis: z.nativeEnum(JenisJadwal, {
      errorMap: () => ({ message: 'Jenis jadwal tidak valid' }),
    }),
    judul: z
      .string()
      .min(1, 'Judul tidak boleh kosong')
      .max(255, 'Judul maksimal 255 karakter'),
    nim: z
      .string()
      .min(1, 'NIM tidak boleh kosong')
      .max(11, 'NIM maksimal 11 karakter'),
    kode_ruangan: z
      .string()
      .min(1, 'Kode ruangan tidak boleh kosong')
      .max(10, 'Kode ruangan maksimal 10 karakter'),
    nip_pembimbing_1: z
      .string()
      .min(1, 'NIP Pembimbing 1 tidak boleh kosong')
      .max(18, 'NIP maksimal 18 karakter'),
    nip_pembimbing_2: z.string().max(18, 'NIP maksimal 18 karakter').optional(),
    nip_penguji_1: z
      .string()
      .min(1, 'NIP Penguji 1 tidak boleh kosong')
      .max(18, 'NIP maksimal 18 karakter'),
    nip_penguji_2: z.string().max(18, 'NIP maksimal 18 karakter').optional(),
    nip_ketua_sidang: z.string().max(18, 'NIP maksimal 18 karakter').optional(),
  })
  .refine((data) => data.waktu_selesai > data.waktu_mulai, {
    message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai',
    path: ['waktu_selesai'],
  })
  .refine(
    (data) => {
      const startTime = new Date(data.waktu_mulai);
      const endTime = new Date(data.waktu_selesai);
      const duration = endTime.getTime() - startTime.getTime();
      return duration >= 30 * 60 * 1000;
    },
    {
      message: 'Durasi seminar minimal 30 menit',
      path: ['waktu_selesai'],
    }
  )
  .refine(
    (data) => {
      const startTime = new Date(data.waktu_mulai);
      const hour = startTime.getHours();
      return hour >= 8 && hour <= 17;
    },
    {
      message: 'Jadwal hanya bisa pada jam kerja (08:00-17:00)',
      path: ['waktu_mulai'],
    }
  )
  .refine(
    (data) => {
      if (
        data.nip_pembimbing_2 &&
        data.nip_pembimbing_1 === data.nip_pembimbing_2
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Pembimbing 1 dan Pembimbing 2 tidak boleh sama',
      path: ['nip_pembimbing_2'],
    }
  )
  .refine(
    (data) => {
      if (data.nip_penguji_2 && data.nip_penguji_1 === data.nip_penguji_2) {
        return false;
      }
      return true;
    },
    {
      message: 'Penguji 1 dan Penguji 2 tidak boleh sama',
      path: ['nip_penguji_2'],
    }
  )
  .refine(
    (data) => {
      if (data.nip_ketua_sidang) {
        const ketuaSidang = data.nip_ketua_sidang;
        const penguji = [
          data.nip_penguji_1,
          data.nip_penguji_2,
        ].filter(Boolean);

        if (penguji.includes(ketuaSidang)) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Ketua sidang tidak boleh menjadi penguji',
      path: ['nip_ketua_sidang'],
    }
  )
  .refine(
    (data) => {
      if (data.jenis === 'SEMKP') {
        if (
          data.nip_pembimbing_2 ||
          data.nip_penguji_2 ||
          data.nip_ketua_sidang
        ) {
          return false;
        }
      } else {
        if (
          !data.nip_pembimbing_2 ||
          !data.nip_penguji_2 ||
          !data.nip_ketua_sidang
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Seminar KP memerlukan 1 pembimbing dan 1 penguji saja. Seminar lainnya memerlukan 2 pembimbing, 2 penguji, dan 1 ketua sidang',
      path: ['jenis'],
    }
  );
