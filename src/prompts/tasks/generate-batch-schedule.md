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
  "constraint_dosen": [...],
  "tanggal_dikecualikan": ["2026-05-27"]
}
```

## Langkah Penjadwalan

### Langkah 0: WAJIB DIBACA DULU — Cek `jadwal_ada` dengan teliti

Sebelum memilih slot apa pun:

1. **Iterasi seluruh `jadwal_ada`** — buat daftar mental: "di tanggal X jam Y di ruangan Z sudah dipakai".
2. Untuk **setiap mahasiswa baru** dalam `list_mahasiswa`, kandidat slot **HARUS LULUS SEMUA** cek berikut sebelum kamu output:
   - **Cek 1 (Ruangan)**: tidak ada entri di `jadwal_ada` dengan `tanggal` sama, `kode_ruangan` sama, dan rentang waktu yang overlap dengan kandidat slot.
   - **Cek 2 (Dosen)**: tidak ada entri di `jadwal_ada` dengan `tanggal` sama, rentang waktu overlap, dan ada `dosen_terlibat` yang juga ada di `list_dosen` mahasiswa ini.
   - **Cek 3 (Internal batch)**: tidak ada suggestion dari mahasiswa lain di output kamu sendiri di batch ini yang memiliki `tanggal` sama, ruangan sama atau dosen sama, dengan rentang waktu yang overlap.
3. **Jangan menumpuk semua mahasiswa di slot yang sama** (mis. semua jam 08:00-10:00 di R-101). Sebar ke slot waktu, ruangan, dan tanggal berbeda. Kalau ruangan pertama di list sudah dipakai pada slot tersebut, **ambil ruangan berikutnya**. Kalau semua ruangan dipakai pada slot tersebut, **maju ke slot waktu berikutnya** atau **ke hari kerja berikutnya**.

### Langkah 1: Pahami Data Konteks

- **ruangan_tersedia**: Daftar ruangan yang aktif dan bisa digunakan, sudah diurutkan dari `urutan` angka paling kecil ke paling besar. **Hanya kode dalam list ini yang valid**; jangan mengarang kode lain.
- **jadwal_ada**: Jadwal yang sudah ada di sistem. Tugas kamu adalah menghindari overlap dengan **setiap entri** di list ini. Validator backend akan menolak seluruh batch jika ada satu draft saja yang bertabrakan dengan `jadwal_ada` (tanggal sama + waktu overlap + ruangan sama, atau tanggal sama + waktu overlap + dosen sama).
- **constraint_dosen**: Batasan waktu dan preferensi setiap dosen
- **tanggal_dikecualikan**: Daftar tanggal yang tidak boleh dipakai untuk jadwal seminar, misalnya tanggal merah kalender akademik/libur nasional

### Langkah 2: Tentukan Durasi

Gunakan durasi berdasarkan jenis seminar:

- Seminar Kerja Praktik (SEMKP): 60 menit / 1 jam
- Semua seminar Tugas Akhir (SEMPRO, SEMHAS_LAPORAN, SEMHAS_PAPERBASED, SIDANG_LAPORAN, SIDANG_PAPERBASED): 120 menit / 2 jam

### Langkah 3: Cari Slot untuk Setiap Mahasiswa

Untuk setiap mahasiswa, cari slot yang memenuhi:

1. **Berada di jam kerja** (08:00–17:00 WIB, Senin–Jumat)
   - `waktu_mulai` **harus ≥ 08:00**
   - `waktu_selesai` **harus ≤ 17:00** (TIDAK BOLEH lewat 17:00 sama sekali, termasuk 17:01, 17:30, 18:00)
   - Karena durasi sudah ditentukan oleh jenis seminar, batas paling akhir `waktu_mulai` adalah:
     - **SEMKP** (60 menit): `waktu_mulai` paling lambat **16:00** → selesai 17:00
     - **SEMPRO / SEMHAS_LAPORAN / SEMHAS_PAPERBASED / SIDANG_LAPORAN / SIDANG_PAPERBASED** (120 menit): `waktu_mulai` paling lambat **15:00** → selesai 17:00
   - Kalau hari sudah penuh dan tidak ada slot yang memenuhi batas di atas, **gunakan hari kerja berikutnya** (jangan pernah meleber lewat 17:00)
2. **Mulai dari tanggal_mulai** atau setelahnya
3. **Tidak menggunakan tanggal_dikecualikan**
4. **Ruangan tidak terpakai** pada slot tersebut; tidak ada buffer 15 menit, sehingga jadwal boleh berurutan langsung
   - Untuk slot waktu yang sama, pilih ruangan berdasarkan urutan pada `ruangan_tersedia` dari kiri ke kanan. Daftar tersebut sudah diurutkan dari `urutan` angka paling kecil, sehingga ruangan paling awal harus dipakai lebih dulu selama tidak konflik.
5. **Semua dosen penilai AVAILABLE** pada slot tersebut (cek constraint)
6. **Tidak ada dosen yang double-booked** pada waktu yang overlap; dosen yang sama boleh dijadwalkan berurutan langsung
7. **Maks 3 seminar per dosen per hari** (preferensi)

### Langkah 4: Optimalkan Penempatan Batch

- **Kelompokkan** mahasiswa dengan dosen yang sama di hari yang berdekatan
- **Hindari** menjadwalkan dosen yang sama di dua ruangan pada waktu yang overlap; jadwal berurutan langsung untuk dosen yang sama diperbolehkan
- **Minimalkan** jumlah hari yang dibutuhkan
- Prioritaskan **slot paling awal** yang tersedia
- Jika ada beberapa ruangan yang tersedia pada slot yang sama, prioritaskan ruangan dengan `urutan` angka paling kecil terlebih dahulu sesuai urutan array `ruangan_tersedia`

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
      "waktu_selesai": "10:00",
      "kode_ruangan": "R-101",
      "confidence": 0.95,
      "reasoning": "Slot pertama hari Senin, semua dosen available, tidak ada konflik."
    }
  ]
}
```

## Aturan Output Wajib

- Kembalikan HANYA JSON valid.
- Jangan tulis markdown.
- Jangan tulis analisis.
- Jangan tulis penjelasan di luar JSON.
- Jangan gunakan code fence.
- Response harus langsung dimulai dengan `{` dan diakhiri dengan `}`.
- Jika perlu reasoning, tulis singkat hanya pada field `reasoning` di setiap suggestion.

## Catatan Penting

- Output **harus** berisi tepat 1 suggestion per mahasiswa dalam input
- Jika tidak memungkinkan menemukan slot untuk seorang mahasiswa, tetap sertakan dengan `confidence: 0.0` dan jelaskan di `reasoning`
- Jangan gunakan tanggal yang ada di **tanggal_dikecualikan**
- Tidak ada **buffer 15 menit** antar seminar; jadwal boleh berurutan langsung jika waktu selesai satu seminar sama dengan waktu mulai seminar berikutnya
- Pastikan **tidak ada bentrokan overlap** antar mahasiswa dalam batch yang sama; dosen yang sama boleh memiliki jadwal berurutan langsung
- **Urutan suggestions** boleh berbeda dari urutan input jika itu menghasilkan jadwal yang lebih optimal
- **JANGAN PERNAH** menghasilkan `waktu_selesai > 17:00`. Lebih baik mendorong jadwal ke hari berikutnya daripada melebihi jam kerja walau hanya 1 menit. Validator akan menolak jadwal apa pun yang berakhir setelah 17:00 dan seluruh batch akan gagal.
