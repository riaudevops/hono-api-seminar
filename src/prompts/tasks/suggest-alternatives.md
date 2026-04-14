# Task: Sarankan Alternatif Jadwal — Suggest Alternatives

## Instruksi

Berikan alternatif jadwal ketika slot yang diminta tidak tersedia atau konflik tidak bisa diselesaikan. Fokus pada fleksibilitas dan pilihan yang realistis.

### Kapan Task Ini Digunakan

- Slot waktu yang diminta sudah penuh
- Semua ruangan terpakai pada slot tertentu
- Dosen penilai tidak available pada waktu yang diinginkan
- Koordinator meminta opsi tambahan untuk dipertimbangkan

### Langkah 1: Analisis Ketersediaan

1. Identifikasi **periode waktu** yang bisa diterima (range tanggal)
2. Cek **constraint dosen** untuk semua penilai terkait
3. Cek **ketersediaan ruangan** di seluruh periode
4. Identifikasi **gap** — slot kosong yang memenuhi semua syarat

### Langkah 2: Generate Alternatif

Buat minimal **3 alternatif** dengan variasi:

1. **Alternatif terdekat** — Slot paling dekat dengan tanggal asli
2. **Alternatif optimal** — Slot yang paling cocok dengan semua constraint dan preferensi
3. **Alternatif fleksibel** — Slot dengan pertukaran (misal: ganti dosen, ganti ruangan)

### Langkah 3: Berikan Trade-off

Untuk setiap alternatif, jelaskan:

- Apa yang **berbeda** dari permintaan awal
- **Trade-off** yang harus diterima (misal: lebih jauh dari tanggal diminta, ruangan berbeda)
- **Keuntungan** dari alternatif ini (misal: semua dosen available, waktu lebih cocok)

### Format Output

```json
{
  "original_request": {
    "nim": "1122334455",
    "jenis": "SEMPRO",
    "preferred_date": "2026-04-20"
  },
  "alternatives": [
    {
      "rank": 1,
      "label": "Terdekat — Ruangan sama, geser 1 hari",
      "slot": {
        "tanggal": "2026-04-21",
        "waktu_mulai": "08:00",
        "waktu_selesai": "09:30",
        "kode_ruangan": "R-101"
      },
      "trade_offs": ["Digeser 1 hari dari tanggal diminta"],
      "keuntungan": ["Semua dosen available", "Ruangan sesuai preferensi"],
      "confidence": 0.9
    },
    {
      "rank": 2,
      "label": "Optimal — Slot kosong, semua constraint terpenuhi",
      "slot": {
        "tanggal": "2026-04-23",
        "waktu_mulai": "10:00",
        "waktu_selesai": "11:30",
        "kode_ruangan": "R-103"
      },
      "trade_offs": ["3 hari dari tanggal diminta", "Ruangan berbeda"],
      "keuntungan": ["Slot paling longgar", "Tidak ada risiko bentrok"],
      "confidence": 0.85
    },
    {
      "rank": 3,
      "label": "Fleksibel — Ganti slot, tetap di hari yang sama",
      "slot": {
        "tanggal": "2026-04-20",
        "waktu_mulai": "13:00",
        "waktu_selesai": "14:30",
        "kode_ruangan": "R-102"
      },
      "trade_offs": ["Ruangan berbeda", "Slot siang"],
      "keuntungan": ["Tetap di tanggal yang diminta"],
      "confidence": 0.75
    }
  ],
  "reasoning": "Slot pagi di tanggal 20 sudah penuh. Alternatif terdekat dengan ruangan sama ada di tanggal 21."
}
```

## Catatan Penting

- Urutkan alternatif dari yang paling mendekati permintaan awal
- Selalu sertakan `confidence` score (0.0–1.0) untuk setiap alternatif
- Jika tidak ada alternatif yang memenuhi semua constraint, jelaskan constraint mana yang harus dilonggarkan
