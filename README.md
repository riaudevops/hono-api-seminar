<h1 align="center">ZRAES AI API</h1>

<p align="center">
  <strong>Backend untuk Sistem Manajemen Seminar KP & Tugas Akhir</strong><br>
  <em>Teknik Informatika — UIN Sultan Syarif Kasim Riau</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-000?logo=bun&logoColor=fff" alt="Bun">
  <img src="https://img.shields.io/badge/framework-Hono-E3602F?logo=hono&logoColor=fff" alt="Hono">
  <img src="https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=fff" alt="Prisma">
  <img src="https://img.shields.io/badge/database-PostgreSQL-4169E1?logo=postgresql&logoColor=fff" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/validation-Zod-3068B7?logo=zod&logoColor=fff" alt="Zod">
  <img src="https://img.shields.io/badge/docs-OpenAPI-6BA539?logo=openapiinitiative&logoColor=fff" alt="OpenAPI">
</p>

---

## Ringkasan

API backend untuk mengelola seluruh administrasi **Seminar Kerja Praktik (KP)** dan **Tugas Akhir (TA)** di lingkungan Jurusan Teknik Informatika UIN Suska Riau. Sistem ini menangani penjadwalan seminar, penilaian oleh dosen, manajemen ruangan, hingga penjadwalan berbasis AI menggunakan LLM via OpenRouter.

## Arsitektur

```
src/
├── core/               # Bootstrap, config, dependency injection
├── handlers/           # HTTP request handlers (controllers)
├── helpers/            # Utility helpers (auth, jadwal, crypto)
├── infrastructures/    # Database, email, Google Sheets
├── middlewares/        # JWT auth, structured logging
├── prompts/            # AI prompt templates
├── repositories/       # Data access layer (Prisma queries)
├── routes/             # Route definitions
├── services/           # Business logic layer
├── types/              # TypeScript interfaces
├── utils/              # Shared utilities (error, logger, zod)
└── validators/         # Zod validation schemas
```

**Alur request:** `Route -> Middleware -> Validator -> Handler -> Service -> Repository -> Prisma`

## Fitur Utama

| Modul                 | Deskripsi                                                                   |
| --------------------- | --------------------------------------------------------------------------- |
| **Jadwal Seminar**    | CRUD jadwal dengan validasi konflik ruangan & dosen, deteksi overlap waktu  |
| **Penilaian**         | Input nilai per komponen oleh dosen penguji/pembimbing, audit log perubahan |
| **Dosen**             | Pencarian fuzzy berbasis Fuse.js, riwayat penilaian lengkap                 |
| **Mahasiswa**         | Melihat jadwal seminar pribadi via JWT-scoped endpoint                      |
| **Constraint Dosen**  | Dosen mengatur ketersediaan waktu & preferensi secara mandiri               |
| **Jadwal Draft (AI)** | Penjadwalan otomatis menggunakan LLM, confidence scoring, approval workflow |
| **Audit Log**         | Tracking semua perubahan jadwal & penilaian dengan actor identification     |

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [Hono](https://hono.dev/) dengan `OpenAPIHono`
- **ORM:** [Prisma](https://www.prisma.io/) + PostgreSQL
- **Validation:** [Zod](https://zod.dev/) + `@hono/zod-validator`
- **API Docs:** Swagger UI auto-generated via OpenAPI 3.1
- **AI:** [OpenRouter](https://openrouter.ai/) (GPT-4o-mini, Gemma 3, DeepSeek, Llama 4)
- **Search:** [Fuse.js](https://www.fusejs.io/) untuk fuzzy search dosen
- **Email:** Nodemailer untuk notifikasi

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1+
- PostgreSQL database

### Instalasi

```bash
# Clone repository
git clone <repo-url>
cd hono-api-seminar

# Install dependencies
bun install

# Setup database
bunx prisma migrate dev --name init
bunx prisma db seed

# Salin dan konfigurasi environment
cp .env.example .env
```

### Konfigurasi `.env`

```env
# Application
APP_NAME="ZRAES AI API"
APP_VERSION="1.0.0"
APP_ENV=development

# Server
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hono_seminar

# CORS
CORS_ORIGINS=["*"]

# Crypto
HANZ_CRYPTO_KEY=your-secret-key

# OpenRouter (opsional, untuk fitur AI scheduling)
OPENROUTER_API_KEY=sk-or-...
```

### Menjalankan Server

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

Server berjalan di `http://localhost:8000` dan Swagger UI tersedia di `/docs`.

## API Endpoints

### Global

| Method | Endpoint  | Deskripsi    |
| ------ | --------- | ------------ |
| `GET`  | `/`       | Info layanan |
| `GET`  | `/health` | Health check |

### Dosen

| Method | Endpoint           | Deskripsi             |
| ------ | ------------------ | --------------------- |
| `GET`  | `/dosen`           | Daftar semua dosen    |
| `GET`  | `/dosen/search?q=` | Pencarian fuzzy dosen |

### Mahasiswa

| Method | Endpoint          | Deskripsi                 |
| ------ | ----------------- | ------------------------- |
| `GET`  | `/mahasiswa-saya` | Data mahasiswa yang login |
| `GET`  | `/mahasiswa`      | Daftar semua mahasiswa    |
| `GET`  | `/mahasiswa/:nim` | Detail mahasiswa          |

### Jadwal

| Method   | Endpoint       | Deskripsi                          |
| -------- | -------------- | ---------------------------------- |
| `GET`    | `/jadwal-saya` | Jadwal mahasiswa yang login        |
| `GET`    | `/jadwal`      | Semua jadwal (filter by `?jenis=`) |
| `GET`    | `/jadwal/:id`  | Detail jadwal                      |
| `POST`   | `/jadwal`      | Buat jadwal baru                   |
| `PUT`    | `/jadwal/:id`  | Update jadwal                      |
| `DELETE` | `/jadwal/:id`  | Hapus jadwal                       |

### Constraint Dosen

| Method   | Endpoint               | Deskripsi                   |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/constraint-saya`     | Constraint dosen yang login |
| `GET`    | `/constraint-saya/:id` | Detail constraint           |
| `POST`   | `/constraint-saya`     | Tambah constraint           |
| `PUT`    | `/constraint-saya/:id` | Update constraint           |
| `DELETE` | `/constraint-saya/:id` | Hapus constraint            |

### Penilaian

| Method | Endpoint                | Deskripsi                 |
| ------ | ----------------------- | ------------------------- |
| `GET`  | `/penilaian/:id_jadwal` | Data penilaian per jadwal |
| `POST` | `/penilaian`            | Input penilaian           |
| `PUT`  | `/penilaian/:id`        | Update penilaian          |

### Ruangan & Komponen Penilaian

| Method | Endpoint              | Deskripsi                       |
| ------ | --------------------- | ------------------------------- |
| `GET`  | `/ruangan`            | Daftar ruangan                  |
| `GET`  | `/komponen-penilaian` | Daftar komponen penilaian aktif |

> Semua endpoint membutuhkan JWT token via header `Authorization: Bearer <token>`.

## Jenis Seminar yang Didukung

| Kode                   | Jenis                       |
| ---------------------- | --------------------------- |
| `SEMKP`                | Seminar KP                  |
| `SEMPRO`               | Seminar Proposal TA         |
| `SEMHAS_LAPORAN`       | Seminar Hasil (Laporan)     |
| `SEMHAS_PAPERBASED`    | Seminar Hasil (Paper-based) |
| `SIDANG_LAPORAN`    | Sidang TA (Laporan)         |
| `SIDANG_PAPERBASED` | Sidang TA (Paper-based)     |

## Constraint Dosen

Dosen dapat mengatur batasan ketersediaan mereka melalui endpoint `/constraint-saya` dengan tipe:

| Tipe               | Deskripsi                             |
| ------------------ | ------------------------------------- |
| `AVAILABLE_TIME`   | Waktu tersedia                        |
| `UNAVAILABLE_TIME` | Waktu berhalangan                     |
| `PREFERENCE`       | Preferensi (misal: maks 3 ujian/hari) |
| `LOCATION`         | Batasan lokasi fisik                  |

## Lisensi

Proyek internal — Teknik Informatika, UIN Sultan Syarif Kasim Riau.
