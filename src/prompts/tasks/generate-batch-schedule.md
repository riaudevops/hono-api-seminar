# Task: Generate Batch Jadwal Seminar

## Instruksi

Buat jadwal seminar untuk **beberapa mahasiswa sekaligus** dalam satu batch. Kamu akan menerima daftar mahasiswa beserta jenis seminar dan dosen penilai masing-masing, serta data konteks (ruangan tersedia, jadwal yang sudah ada, constraint dosen).

## Input

Kamu akan menerima JSON dengan format:

```json
{
  "tanggal_mulai": "2026-04-20",
  "list_mahasiswa": [
    {
      "nim": "2024001001",
      "jenis": "SEMPRO",
      "list_dosen": [
        { "nip": "198501012010011001", "role": "TA_PEMBIMBING_1" },
        { "nip": "197803052005011002", "role": "TA_PEMBIMBING_2" },
        { "nip": "198002142006041003", "role": "TA_PENGUJI_1" }
      ]
    }
  ],
  "ruangan_tersedia": [...],
  "jadwal_ada": [...],
  "constraint_dosen": [...]
}
```

## Langkah Penjadwalan

### Langkah 1: Pahami Data Konteks

- **ruangan_tersedia**: Daftar ruangan yang aktif dan bisa digunakan
- **jadwal_ada**: Jadwal yang sudah ada (perhatikan waktu dan ruangan agar tidak bentrok)
- **constraint_dosen**: Batasan waktu dan preferensi setiap dosen

### Langkah 2: Tentukan Durasi

Gunakan durasi berdasarkan jenis seminar:
- SEMKP: 60 menit
- SEMPRO, SEMHAS_LAPORAN, SEMHAS_PAPERBASED: 90 menit
- SIDANG_TA_LAPORAN, SIDANG_TA_PAPERBASED: 120 menit

### Langkah 3: Cari Slot untuk Setiap Mahasiswa

Untuk setiap mahasiswa, cari slot yang memenuhi:

1. **Berada di jam kerja** (08:00–17:00 WIB, Senin–Jumat)
2. **Mulai dari tanggal_mulai** atau setelahnya
3. **Ruangan tidak terpakai** pada slot tersebut (+ buffer 15 menit dari jadwal yang sudah ada)
4. **Semua dosen penilai AVAILABLE** pada slot tersebut (cek constraint)
5. **Tidak ada dosen yang double-booked** antar mahasiswa dalam batch ini
6. **Maks 3 seminar per dosen per hari** (preferensi)

### Langkah 4: Optimalkan Penempatan Batch

- **Kelompokkan** mahasiswa dengan dosen yang sama di hari yang berdekatan
- **Hindari** menjadwalkan dosen yang sama di dua ruangan bersamaan
- **Minimalkan** jumlah hari yang dibutuhkan
- Prioritaskan **slot paling awal** yang tersedia

### Langkah 5: Buat Output

Untuk setiap mahasiswa, berikan tepat **1 suggestion**:

```json
{
  "suggestions": [
    {
      "nim": "2024001001",
      "jenis": "SEMPRO",
      "tanggal": "2026-04-20",
      "waktu_mulai": "08:00",
      "waktu_selesai": "09:30",
      "kode_ruangan": "R-101",
      "confidence": 0.95,
      "reasoning": "Slot pertama hari Senin, semua dosen available, tidak ada konflik."
    }
  ]
}
```

## Catatan Penting

- Output **harus** berisi tepat 1 suggestion per mahasiswa dalam input
- Jika tidak memungkinkan menemukan slot untuk seorang mahasiswa, tetap sertakan dengan `confidence: 0.0` dan jelaskan di `reasoning`
- Selalu pertimbangkan **buffer 15 menit** antar seminar di ruangan yang sama
- Pastikan **tidak ada bentrokan** antar mahasiswa dalam batch yang sama (dosen sama tidak dijadwalkan bersamaan)
- **Urutan suggestions** boleh berbeda dari urutan input jika itu menghasilkan jadwal yang lebih optimal
