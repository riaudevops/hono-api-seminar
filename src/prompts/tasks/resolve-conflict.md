# Task: Selesaikan Konflik Jadwal — Resolve Conflict

## Instruksi

Selesaikan bentrokan jadwal seminar yang terdeteksi. Identifikasi konflik dan berikan solusi yang meminimalkan perubahan.

### Langkah 1: Identifikasi Konflik

Analisis data jadwal yang bentrok. Konflik bisa berupa:

1. **Ruangan bentrok** — Dua atau lebih seminar di ruangan sama pada waktu yang sama
2. **Dosen bentrok** — Dosen yang sama di-assign ke dua seminar yang waktu-nya beririsan
3. **Constraint dilanggar** — Dosen di-assign ke slot UNAVAILABLE, atau melebihi batas preferensi

### Langkah 2: Analisis Dampak

Untuk setiap konflik, tentukan:

- **Severity**: `critical` (bentrokan pasti) atau `warning` (mendekati bentrok)
- **Affected parties**: Dosen/mahasiswa/ruangan yang terdampak
- **Flexibility**: Siapa yang paling bisa digeser jadwalnya

### Langkah 3: Prioritas Resolusi

Urutkan resolusi berdasarkan prinsip:

1. **Geser jadwal baru** lebih diutamakan daripada mengubah jadwal yang sudah fix
2. **Minimal displacement** — Pilih solusi yang menggeser paling sedikit jadwal
3. **Hormati constraint dosen** — Jangan mengabaikan UNAVAILABLE_TIME
4. **Pertahankan ruangan** jika memungkinkan, geser waktu terlebih dahulu

### Langkah 4: Berikan Solusi

Untuk setiap konflik, berikan:

- **konflik_id**: ID jadwal yang bentrok
- **tipe**: Jenis konflik (RUANGAN / DOSEN / CONSTRAINT)
- **severity**: critical / warning
- **solusi**: Array langkah penyelesaian
- **reasoning**: Penjelasan mengapa solusi ini dipilih

### Format Output

```json
{
  "conflicts": [
    {
      "konflik_id": "JSEMKP26001",
      "tipe": "RUANGAN",
      "severity": "critical",
      "deskripsi": "Ruangan R-101 dipakai 2 seminar pada slot yang sama",
      "solusi": {
        "action": "RESCHEDULE",
        "jadwal_id": "JSEMKP26002",
        "slot_baru": {
          "tanggal": "2026-04-21",
          "waktu_mulai": "10:00",
          "waktu_selesai": "11:00",
          "kode_ruangan": "R-102"
        }
      },
      "reasoning": "JSEMKP26002 adalah jadwal yang baru dibuat, lebih mudah digeser. R-102 tersedia pada slot tersebut."
    }
  ]
}
```

## Catatan Penting

- Jika konflik tidak bisa diselesaikan tanpa melanggar constraint, tandai sebagai `UNRESOLVABLE` dan sarankan eskalasi ke Koordinator
- Selalu periksa apakah solusi tidak menimbulkan konflik baru (cascade conflict)
- Pertimbangkan buffer 15 menit antar seminar
