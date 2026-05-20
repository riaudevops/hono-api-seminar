import { z } from 'zod';
import { LogActionType, PenilaiRole } from '@prisma/client';

const kodeJenisSchema = z
  .string()
  .min(1, 'Kode jenis seminar tidak boleh kosong')
  .max(20, 'Kode jenis seminar maksimal 20 karakter')
  .refine((val) => !/\s/.test(val), {
    message: 'Kode jenis seminar tidak boleh mengandung spasi',
  })
  .refine((val) => val === val.toUpperCase(), {
    message: 'Kode jenis seminar harus huruf besar semua',
  });

const idSchema = z.string().min(1, 'ID tidak boleh kosong');

const dateTimeSchema = (field: string, example: string) =>
  z
    .string()
    .datetime({
      message: `Format ${field} harus dalam format ISO-8601 DateTime (contoh: ${example})`,
    })
    .transform((str) => new Date(str));

const penilaiSchema = z.object({
  nip: z.string().min(1, 'NIP tidak boleh kosong').max(18, 'NIP maksimal 18 karakter'),
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: 'Role penilai tidak valid' }),
  }),
});

const baseJadwalSchema = z.object({
  tanggal: dateTimeSchema('tanggal', '2025-10-14T00:00:00.000Z'),
  waktu_mulai: dateTimeSchema('waktu mulai', '2025-10-14T08:00:00.000Z'),
  waktu_selesai: dateTimeSchema('waktu selesai', '2025-10-14T09:00:00.000Z'),
  kode_jenis: kodeJenisSchema.optional(),
  id_jenis_seminar: z.string().min(1, 'ID jenis seminar tidak boleh kosong').optional(),
  nim: z.string().min(1, 'NIM tidak boleh kosong').max(11, 'NIM maksimal 11 karakter'),
  kode_ruangan: z
    .string()
    .min(1, 'Kode ruangan tidak boleh kosong')
    .max(10, 'Kode ruangan maksimal 10 karakter'),
  penilai: z.array(penilaiSchema).min(1, 'Minimal 1 dosen penilai'),
});

function validateJadwalTime(data: {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
}) {
  if (!data.tanggal || !data.waktu_mulai || !data.waktu_selesai) return true;

  const tanggal = data.tanggal.toISOString().slice(0, 10);
  const mulaiTanggal = data.waktu_mulai.toISOString().slice(0, 10);
  const selesaiTanggal = data.waktu_selesai.toISOString().slice(0, 10);

  return tanggal === mulaiTanggal && tanggal === selesaiTanggal;
}

function validateWorkingHours(data: { waktu_mulai?: Date; waktu_selesai?: Date }) {
  if (!data.waktu_mulai || !data.waktu_selesai) return true;

  const startHour = data.waktu_mulai.getHours();
  const startMinute = data.waktu_mulai.getMinutes();
  const endHour = data.waktu_selesai.getHours();
  const endMinute = data.waktu_selesai.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return startMinutes >= 8 * 60 && endMinutes <= 17 * 60;
}

function validateMinimumDuration(data: { waktu_mulai?: Date; waktu_selesai?: Date }) {
  if (!data.waktu_mulai || !data.waktu_selesai) return true;
  return data.waktu_selesai.getTime() - data.waktu_mulai.getTime() >= 30 * 60 * 1000;
}

function validateFutureSchedule(data: { waktu_mulai?: Date }) {
  if (!data.waktu_mulai) return true;
  return data.waktu_mulai >= new Date();
}

function validateUniquePenilai(data: { penilai?: Array<{ nip: string }> }) {
  if (!data.penilai) return true;
  const nips = data.penilai.map((item) => item.nip);
  return new Set(nips).size === nips.length;
}

const jadwalRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((data: any) => data.kode_jenis || data.id_jenis_seminar, {
      message: 'Field kode_jenis atau id_jenis_seminar wajib diisi',
      path: ['kode_jenis'],
    })
    .refine((data: any) => !data.waktu_mulai || !data.waktu_selesai || data.waktu_selesai > data.waktu_mulai, {
      message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai',
      path: ['waktu_selesai'],
    })
    .refine(validateMinimumDuration, {
      message: 'Durasi seminar minimal 30 menit',
      path: ['waktu_selesai'],
    })
    .refine(validateWorkingHours, {
      message: 'Jadwal hanya bisa pada jam kerja (08:00-17:00)',
      path: ['waktu_mulai'],
    })
    .refine(validateJadwalTime, {
      message: 'Tanggal, waktu mulai, dan waktu selesai harus berada pada tanggal yang sama',
      path: ['tanggal'],
    })
    .refine(validateFutureSchedule, {
      message: 'Jadwal tidak boleh dibuat di masa lalu',
      path: ['waktu_mulai'],
    })
    .refine(validateUniquePenilai, {
      message: 'Dosen penilai tidak boleh duplikat',
      path: ['penilai'],
    });

export const postJadwalSchema = jadwalRules(baseJadwalSchema);

export const putJadwalSchema = jadwalRules(baseJadwalSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu field harus diisi' }
));

export const jadwalIdParamSchema = z.object({
  id: idSchema,
});

export const getJadwalQuerySchema = z
  .object({
    jenis: kodeJenisSchema.optional(),
    tanggal_mulai: z.string().datetime('Format tanggal mulai harus ISO-8601 DateTime').optional(),
    tanggal_selesai: z.string().datetime('Format tanggal selesai harus ISO-8601 DateTime').optional(),
    kode_ruangan: z.string().max(10, 'Kode ruangan maksimal 10 karakter').optional(),
    nim: z.string().max(11, 'NIM maksimal 11 karakter').optional(),
    nip_dosen: z.string().max(18, 'NIP maksimal 18 karakter').optional(),
    tahun_ajaran: z.string().max(5, 'Kode tahun ajaran maksimal 5 karakter').optional(),
    page: z.coerce.number().int('Page harus bilangan bulat').min(1, 'Page minimal 1').optional(),
    limit: z.coerce
      .number()
      .int('Limit harus bilangan bulat')
      .min(1, 'Limit minimal 1')
      .max(100, 'Limit maksimal 100')
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.tanggal_mulai || !data.tanggal_selesai) return true;
      return new Date(data.tanggal_selesai) >= new Date(data.tanggal_mulai);
    },
    {
      message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
      path: ['tanggal_selesai'],
    }
  );

export const getJadwalLogsQuerySchema = z.object({
  action: z.nativeEnum(LogActionType).optional(),
  start_date: z.string().datetime('Format start_date harus ISO-8601 DateTime').optional(),
  end_date: z.string().datetime('Format end_date harus ISO-8601 DateTime').optional(),
  limit: z.coerce
    .number()
    .int('Limit harus bilangan bulat')
    .min(1, 'Limit minimal 1')
    .max(100, 'Limit maksimal 100')
    .optional(),
  offset: z.coerce.number().int('Offset harus bilangan bulat').min(0, 'Offset minimal 0').optional(),
});

export const postPutJadwalSchema = postJadwalSchema;
