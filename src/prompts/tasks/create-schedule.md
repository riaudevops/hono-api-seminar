# Task: Buat Jadwal Seminar — Create Schedule

## Instruksi

Buat jadwal seminar baru berdasarkan data yang diberikan. Ikuti langkah-langkah berikut:

### Langkah 1: Validasi Input

Pastikan data berikut tersedia dan valid:

- **Mahasiswa**: NIM dan jenis seminar yang akan diikuti
- **Jenis seminar**: Tentukan durasi berdasarkan jenis (SEMKP: 60 menit, SEMPRO/SEMHAS: 90 menit, SIDANG TA: 120 menit)
- **Dosen penilai**: Daftar NIP beserta role masing-masing

### Langkah 2: Cari Slot Tersedia

1. Ambil daftar jadwal yang sudah ada pada periode tanggal yang diminta
2. Ambil daftar constraint dosen yang aktif (UNAVAILABLE_TIME, AVAILABLE_TIME, PREFERENCE)
3. Cari slot kosong yang memenuhi:
   - Berada di jam kerja (08:00–17:00 WIB, Senin–Jumat)
   - Ruangan tidak terpakai pada slot tersebut (+ buffer 15 menit)
   - Semua dosen penilai AVAILABLE pada slot tersebut
   - Tidak melanggar preferensi dosen (maks 3 seminar/hari, dll)

### Langkah 3: Prioritaskan Slot

Urutkan slot yang tersedia berdasarkan:

1. **Tidak ada bentrokan** dengan dosen manapun (prioritas tertinggi)
2. **Jarak waktu terdekat** dari tanggal yang diminta
3. **Preferensi dosen** terpenuhi
4. **Ruangan yang sesuai** kapasitas

### Langkah 4: Buat Output

Untuk setiap slot yang diusulkan, berikan:

- **tanggal**: Format YYYY-MM-DD
- **waktu_mulai**: Format HH:mm WIB
- **waktu_selesai**: Format HH:mm WIB (otomatis dari durasi jenis seminar)
- **kode_ruangan**: Ruangan yang tersedia
- **confidence**: Skor keyakinan 0.0–1.0
- **reasoning**: Penjelasan singkat mengapa slot ini dipilih

### Format Output

```json
{
  "suggestions": [
    {
      "tanggal": "2026-04-20",
      "waktu_mulai": "08:00",
      "waktu_selesai": "09:30",
      "kode_ruangan": "R-101",
      "confidence": 0.95,
      "reasoning": "Slot pertama hari Senin, semua dosen available, ruangan kosong."
    }
  ]
}
```

## Catatan Penting

- Jika tidak ada slot tersedia, jelaskan alasannya dan sarankan alternatif periode
- Selalu pertimbangkan buffer 15 menit antar seminar di ruangan yang sama
- Mahasiswa tidak boleh punya jadwal ganda untuk jenis seminar yang sama
