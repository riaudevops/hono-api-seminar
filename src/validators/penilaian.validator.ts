import { z } from "zod";

export const detailPenilaianItemSchema = z.object({
  id_komponen: z.string().min(1, "ID Komponen wajib diisi"),
  nilai: z.number().min(0, "Nilai minimal 0").max(100, "Nilai maksimal 100"),
});

export const submitPenilaianSchema = z.object({
  details: z.array(detailPenilaianItemSchema).min(1, "Minimal harus ada 1 komponen yang dinilai"),
});
