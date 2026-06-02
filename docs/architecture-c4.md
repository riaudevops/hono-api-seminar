# Visualisasi Arsitektur — C4 Model

Project: **API SEMINAR TIF** (`hono-api-seminar`)  
Stack utama: **Bun**, **Hono/OpenAPIHono**, **Prisma**, **PostgreSQL**, **Redis**, **OpenRouter**, **Google Drive**, **SMTP Gmail**.

Dokumen ini memvisualisasikan arsitektur backend Sistem Manajemen Seminar KP & Tugas Akhir menggunakan pendekatan **C4 Model** yang dibatasi pada 3 level: **Context**, **Container**, dan **Component**.

---

## Level 1 — System Context

```mermaid
C4Context
    title System Context - API Seminar TIF

    Person(mahasiswa, "Mahasiswa", "Mendaftar seminar, upload berkas, melihat jadwal dan hasil")
    Person(dosen, "Dosen", "Melihat jadwal, mengatur constraint, menginput penilaian")
    Person(koordinator, "Koordinator", "Mengelola pendaftaran, jadwal, ruangan, dosen, template dokumen, dan approval draft")

    System(api, "API Seminar TIF", "Backend REST API untuk manajemen seminar KP/TA Teknik Informatika")

    System_Ext(postgres, "PostgreSQL", "Database utama")
    System_Ext(redis, "Redis", "Cache dan optimasi query/context")
    System_Ext(openrouter, "OpenRouter", "LLM provider untuk AI scheduling")
    System_Ext(gdrive, "Google Drive", "Penyimpanan dokumen pendaftaran")
    System_Ext(smtp, "SMTP Gmail", "Pengiriman email/notifikasi")
    System_Ext(swagger, "Swagger UI / OpenAPI", "Dokumentasi API interaktif")

    Rel(mahasiswa, api, "Mengakses endpoint mahasiswa/pendaftaran/upload", "HTTPS + JWT")
    Rel(dosen, api, "Mengakses endpoint dosen/jadwal/penilaian/constraint", "HTTPS + JWT")
    Rel(koordinator, api, "Mengakses endpoint koordinator/admin", "HTTPS + JWT")

    Rel(api, postgres, "Membaca/menulis data domain", "Prisma + PostgreSQL")
    Rel(api, redis, "Cache data list/statistik/context AI", "ioredis")
    Rel(api, openrouter, "Generate draft jadwal berbasis AI", "HTTP API")
    Rel(api, gdrive, "Upload/hapus file dokumen", "Google Drive API")
    Rel(api, smtp, "Kirim email pendaftaran/notifikasi", "Nodemailer SMTP")
    Rel(swagger, api, "Membaca spesifikasi OpenAPI", "GET /openapi.json")
```

---

## Level 2 — Container Diagram

```mermaid
C4Container
    title Container Diagram - API Seminar TIF

    Person(mahasiswa, "Mahasiswa")
    Person(dosen, "Dosen")
    Person(koordinator, "Koordinator")

    System_Boundary(system, "API Seminar TIF") {
        Container(hono, "Hono API Server", "Bun + Hono + TypeScript", "REST API, routing, middleware, OpenAPI docs, error handling")
        Container(di, "Core / DI Bootstrap", "TypeScript", "Load config, register singleton services, initialize Redis/OpenRouter")
        Container(modules, "Feature Modules", "Handlers + Services + Repositories", "Business capabilities: jadwal, pendaftaran, penilaian, dosen, mahasiswa, ruangan, dokumen, log")
        Container(aiPrompts, "Prompt Templates", "Markdown + TypeScript schemas", "Persona, rules, task prompts, output schema untuk AI scheduling")
        ContainerDb(prismaClient, "Prisma Client", "Prisma ORM", "Data access abstraction used by repositories")
    }

    ContainerDb(postgres, "PostgreSQL", "Relational DB", "Data dosen, mahasiswa, jadwal, penilaian, pendaftaran, dokumen, audit log")
    ContainerDb(redis, "Redis", "Key-value cache", "Cache list, dashboard, AI context, rate-limit support/fallback")
    Container_Ext(openrouter, "OpenRouter API", "LLM Gateway", "Model fallback untuk generate jadwal draft")
    Container_Ext(gdrive, "Google Drive API", "File storage", "Dokumen pendaftaran")
    Container_Ext(smtp, "Gmail SMTP", "Email service", "Email/notifikasi pendaftaran")

    Rel(mahasiswa, hono, "HTTP requests", "JWT Bearer")
    Rel(dosen, hono, "HTTP requests", "JWT Bearer")
    Rel(koordinator, hono, "HTTP requests", "JWT Bearer")

    Rel(hono, di, "Bootstraps dependencies")
    Rel(hono, modules, "Routes requests to feature handlers")
    Rel(modules, prismaClient, "Queries/mutations")
    Rel(prismaClient, postgres, "SQL", "Prisma adapter-pg")
    Rel(modules, redis, "Read/write cache", "ioredis")
    Rel(modules, aiPrompts, "Reads prompt files and schemas")
    Rel(modules, openrouter, "Chat completion for scheduling")
    Rel(modules, gdrive, "Upload/delete files")
    Rel(modules, smtp, "Send email")
```

---

## Level 3 — Component Diagram: Hono API Server

```mermaid
C4Component
    title Component Diagram - Hono API Server

    Container_Boundary(api, "Hono API Server") {
        Component(entry, "src/index.ts", "OpenAPIHono App", "Creates app, configures CORS, docs, global middleware, error handlers, /api router")
        Component(apiRouter, "src/api.ts", "API Router", "Aggregates all feature routes under /api")
        Component(authMw, "AuthMiddleware", "Middleware", "Extracts JWT bearer token and stores user payload")
        Component(rateMw, "RateLimitMiddleware", "Middleware", "Global/read/write/auth/AI rate limiting")
        Component(logMw, "LogMiddleware", "Middleware", "Structured request logging")
        Component(validators, "Validators", "Zod schemas", "Validates params/query/body/form before handlers")
        Component(handlers, "Handlers", "Controller layer", "Maps HTTP request/response to service calls")
        Component(services, "Services", "Business logic layer", "Rules, validation, orchestration, cache, integration calls")
        Component(repositories, "Repositories", "Data access layer", "Prisma queries and persistence")
        Component(utils, "Utils/Helpers", "Shared utilities", "APIError, logger, cache keys, tahun ajaran, jadwal helpers, crypto")
    }

    ContainerDb(postgres, "PostgreSQL", "Database")
    ContainerDb(redis, "Redis", "Cache")
    Container_Ext(openrouter, "OpenRouter", "AI service")
    Container_Ext(gdrive, "Google Drive", "File service")
    Container_Ext(smtp, "Gmail SMTP", "Email service")

    Rel(entry, apiRouter, "Mounts /api")
    Rel(entry, authMw, "Applies route-level auth via routes")
    Rel(entry, rateMw, "Applies /api/* global limiter")
    Rel(entry, logMw, "Applies structured logger")
    Rel(apiRouter, handlers, "Routes to handlers")
    Rel(apiRouter, validators, "Attaches zValidator")
    Rel(handlers, services, "Calls service methods")
    Rel(services, repositories, "Uses repositories")
    Rel(services, utils, "Uses helpers/errors/logging")
    Rel(repositories, postgres, "Prisma queries")
    Rel(services, redis, "Cache remember/get/set/invalidate")
    Rel(services, openrouter, "AI scheduling")
    Rel(services, gdrive, "File upload/delete")
    Rel(services, smtp, "Email sending")
```

---

## Level 3 — Component Diagram: Feature Modules

```mermaid
C4Component
    title Component Diagram - Feature Modules

    Person(mahasiswa, "Mahasiswa")
    Person(dosen, "Dosen")
    Person(koordinator, "Koordinator")

    Container_Boundary(features, "Feature Modules") {
        Component(global, "Global / Health Module", "Route + Handler", "Health check dan endpoint umum")
        Component(jadwal, "Jadwal Module", "Route + Validator + Handler + Service + Repository", "Manajemen jadwal seminar")
        Component(jadwalDraft, "Jadwal Draft AI Module", "Route + Validator + Handler + Service + Repository", "Generate, validasi, approval/rejection draft jadwal berbasis AI")
        Component(pendaftaran, "Pendaftaran Module", "Route + Validator + Handler + Service + Repository", "Pengajuan dan pengelolaan pendaftaran seminar")
        Component(penilaian, "Penilaian Module", "Route + Validator + Handler + Service + Repository", "Penilaian seminar dan detail komponen nilai")
        Component(dosenMod, "Dosen Module", "Route + Validator + Handler + Service + Repository", "Data dosen dan keahlian dosen")
        Component(mahasiswaMod, "Mahasiswa Module", "Route + Validator + Handler + Service + Repository", "Data mahasiswa")
        Component(ruangan, "Ruangan Module", "Route + Validator + Handler + Service + Repository", "Data ruangan seminar")
        Component(constraint, "Constraint Dosen Module", "Route + Validator + Handler + Service + Repository", "Batasan jadwal dosen")
        Component(master, "Master Data Modules", "Route + Validator + Handler + Service + Repository", "Jenis seminar, tahun ajaran, bobot penilai, bidang keahlian")
        Component(dokumen, "Dokumen Module", "Route + Validator + Handler + Service + Repository", "Template dan requirement dokumen")
        Component(upload, "Upload Module", "Route + Validator + Handler + Service", "Upload dokumen pendaftaran")
        Component(log, "Audit Log Module", "Route + Handler + Service + Repository", "Pencatatan perubahan entity domain")
    }

    ContainerDb(postgres, "PostgreSQL", "Relational DB")
    ContainerDb(redis, "Redis", "Key-value cache")
    Container_Ext(openrouter, "OpenRouter", "AI service")
    Container_Ext(gdrive, "Google Drive", "File storage")
    Container_Ext(smtp, "Gmail SMTP", "Email service")

    Rel(mahasiswa, pendaftaran, "Mengajukan pendaftaran")
    Rel(mahasiswa, jadwal, "Melihat jadwal")
    Rel(mahasiswa, upload, "Upload dokumen")
    Rel(mahasiswa, mahasiswaMod, "Mengelola data mahasiswa")
    Rel(dosen, jadwal, "Melihat jadwal")
    Rel(dosen, penilaian, "Input penilaian")
    Rel(dosen, constraint, "Mengatur constraint")
    Rel(dosen, dosenMod, "Mengelola data dosen")
    Rel(koordinator, jadwal, "Mengelola jadwal")
    Rel(koordinator, jadwalDraft, "Generate/approval draft AI")
    Rel(koordinator, pendaftaran, "Verifikasi pendaftaran")
    Rel(koordinator, master, "Mengelola master data")
    Rel(koordinator, dokumen, "Mengelola template/requirement")
    Rel(koordinator, ruangan, "Mengelola ruangan")
    Rel(koordinator, log, "Melihat audit log")

    Rel(jadwal, postgres, "Read/write jadwal")
    Rel(jadwalDraft, openrouter, "Generate draft jadwal")
    Rel(jadwalDraft, redis, "Cache context AI")
    Rel(jadwalDraft, postgres, "Persist draft")
    Rel(pendaftaran, postgres, "Read/write pendaftaran")
    Rel(pendaftaran, smtp, "Kirim notifikasi")
    Rel(upload, gdrive, "Upload/delete file")
    Rel(upload, postgres, "Simpan metadata file")
    Rel(penilaian, postgres, "Read/write penilaian")
    Rel(dosenMod, postgres, "Read/write dosen")
    Rel(mahasiswaMod, postgres, "Read/write mahasiswa")
    Rel(ruangan, postgres, "Read/write ruangan")
    Rel(constraint, postgres, "Read/write constraint")
    Rel(master, postgres, "Read/write master data")
    Rel(dokumen, postgres, "Read/write dokumen")
    Rel(log, postgres, "Persist audit log")
```

---

## Catatan Pembacaan Diagram

- Dokumentasi ini hanya memuat 3 level C4: **Context**, **Container**, dan **Component**.
- Diagram **C4Context**, **C4Container**, dan **C4Component** menggunakan sintaks Mermaid C4. Jika renderer Mermaid tidak memuat C4, gunakan Mermaid versi baru atau plugin yang mendukung C4.
- Dokumentasi ini disusun dari struktur source utama: `src/index.ts`, `src/api.ts`, `src/core/bootstrap.ts`, `src/infrastructures/*`, `src/modules/*`, dan `prisma/schema.prisma`.
