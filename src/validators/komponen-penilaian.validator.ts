import { z } from "zod";
import { PenilaiRole } from "@prisma/client";

export const createKomponenPenilaianSchema = z.object({
  id: z.string().min(1, "ID Komponen wajib diisi").max(7, "ID Komponen maksimal 7 karakter"),
  nama: z.string().min(1, "Nama komponen wajib diisi").max(50, "Nama komponen maksimal 50 karakter"),
  persentase: z.number().int("Persentase harus berupa bilangan bulat").min(1, "Persentase minimal 1%").max(100, "Persentase maksimal 100%"),
  is_aktif: z.boolean().default(true),
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: "Role penilai tidak valid" }),
  }),
});

export const updateKomponenPenilaianSchema = z.object({
  nama: z.string().min(1, "Nama komponen wajib diisi").max(50, "Nama komponen maksimal 50 karakter").optional(),
  persentase: z.number().int("Persentase harus berupa bilangan bulat").min(1, "Persentase minimal 1%").max(100, "Persentase maksimal 100%").optional(),
  is_aktif: z.boolean().optional(),
  role: z.nativeEnum(PenilaiRole, {
    errorMap: () => ({ message: "Role penilai tidak valid" }),
  }).optional(),
});

export const toggleStatusKomponenSchema = z.object({
  is_aktif: z.boolean({
    required_error: "Status aktif wajib diisi",
  }),
});
