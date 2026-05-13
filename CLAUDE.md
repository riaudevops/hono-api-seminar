# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Backend API for **ZRAES AI** — Sistem Manajemen Seminar Kerja Praktik dan Tugas Akhir at TIF UIN Suska Riau. Built with **Hono v4** (OpenAPIHono) on **Bun** runtime with **Prisma** (PostgreSQL) and **OpenRouter** for AI-powered schedule generation.

## Commands

```bash
bun run dev                    # Dev server with hot reload (src/index.ts)
bun run start                  # Production server
bun run dev:worker             # Background worker with hot reload (src/worker.ts)
bun run start:worker           # Production worker
bunx prisma migrate dev        # Create and apply migration
bunx prisma migrate deploy     # Apply migrations (production)
bunx prisma db seed            # Seed database
bunx prisma studio             # Database GUI
bunx prisma generate           # Regenerate Prisma client
```

No test or lint framework is configured.

## Architecture

### Layered Structure: Route → Handler → Service → Repository

```
src/routes/*.route.ts             # Hono route definitions + middleware chain (auth + zod validation)
src/handlers/*.handler.ts         # Static classes, extract params from Context, delegate to services
src/services/*.service.ts         # Business logic, throw APIError for violations
src/repositories/*.repository.ts  # Prisma query wrappers, extend BaseRepository
```

All route groups are mounted under `/api` in `src/index.ts`.

### Two Coexisting Layouts

- **Flat layout (legacy)** — files split by layer under `src/routes/`, `src/handlers/`, `src/services/`, `src/repositories/`, `src/validators/`, `src/types/`.
- **Feature modules (preferred for new work)** — under `src/modules/<feature>/`, colocating `*.route.ts`, `*.handler.ts`, `*.service.ts`, `*.repository.ts`, `*.validator.ts`, `*.type.ts`, with a barrel `index.ts` that exports `{Feature}Route`, `{Feature}Handler`, etc. Example: `src/modules/jenis-seminar/`, `src/modules/dokumen-template/`, `src/modules/mahasiswa/`. New features should follow this pattern.

### Router

`OpenAPIHono` is instantiated with **`RegExpRouter`** (not the default TrieRouter) in `src/index.ts`. This was a deliberate choice — the default TrieRouter caused `UnsupportedPathError` when dynamic `:id` routes conflicted with static sibling routes at the same depth. When adding routes, be mindful that mixing dynamic and static paths under the same prefix is what triggered the original incident.

### Key Directories

- **`src/core/`** — DI container (`container.ts`), Zod-validated config singleton (`config.ts`), bootstrap (`bootstrap.ts`)
- **`src/infrastructures/`** — Singleton infrastructure: Prisma DB, Nodemailer, OpenRouter LLM gateway
- **`src/middlewares/`** — JWT Bearer auth + role-based access (`auth.middleware.ts`), structured request logging (`log.middleware.ts`)
- **`src/validators/`** — Zod schemas for request validation, applied via `zValidator()` in routes (legacy; new features colocate validators inside their module folder)
- **`src/prompts/`** — LLM prompt engineering: markdown persona/task prompts (`base/`, `tasks/`), typed rule constants (`context/`), Zod structured output schemas (`output/`)
- **`src/helpers/`** — Domain-specific data transformation utilities
- **`src/utils/`** — `APIError`, custom `Logger`, Zod error formatter, OpenRouter helpers, crypto utilities, spreadsheet (sheetsy) helpers
- **`src/types/`** — TypeScript interfaces and type definitions (legacy; new features colocate types inside their module folder)
- **`src/modules/`** — Feature modules (see layout above)
- **`src/worker.ts`** — Standalone background worker entry point (separate from HTTP server)

### Response Format

All endpoints return: `{ response: boolean, message: string, data?: any }`

Errors use `APIError` (from `src/utils/api-error.util.ts`) with a `statusCode` field. The global error handler in `GlobalHandler.error()` catches these and returns structured JSON.

### OpenAPI / Swagger

OpenAPI spec served at `/openapi.json`, Swagger UI at `/docs`. Route files using `@hono/zod-openapi` contribute to the spec automatically when registered via `createRoute()`.

### Authentication

JWT Bearer token extracted in middleware (`AuthMiddleware.JWTBearerTokenExtraction`). **No signature verification** — relies on an external auth service. Roles: `mahasiswa`, `dosen`, `koordinator`. Use `AuthMiddleware.requireRole(...)` for role-based guards. User payload accessed via `c.get('user')`.

### AI Schedule Generation

`JadwalDraftService` gathers context (rooms, existing schedules, dosen constraints), sends to OpenRouter LLM with structured prompts, validates output against Zod schemas, and creates draft schedule records. Supports approve/reject workflow. Prompts are in `src/prompts/`.

### Database

PostgreSQL via Prisma with `@prisma/adapter-pg`. Connection is a lazy-initialized singleton with a Proxy for backward-compatible imports. Schema in `prisma/schema.prisma`. Seed data in `prisma/seed.ts` and `src/data/*.sql`.

Note: The schema has a known drift issue — `pendaftaran.service.ts` still references legacy flat columns (`nama`, `semester`, `no_wa`, `judul`) that have been migrated to an EAV structure. Treat service/schema mismatches as a likely bug site when editing pendaftaran code.

## Conventions

- **Static classes** for handlers, services, and repositories (no DI injection into these layers)
- **Singleton pattern** with `getInstance()`/`resetInstance()` for infrastructure and utility classes
- **Zod everywhere**: env validation, request validation, LLM output validation
- **Custom logger**: use `createLogger('ContextName')` from `src/utils/logger.util.ts`
- Validators use `.refine()` for cross-field business rules
- Environment config via `src/core/config.ts` singleton — never read `process.env` directly
- New features go under `src/modules/<feature>/` with a barrel `index.ts`; mount the route in `src/index.ts` under `/api`
