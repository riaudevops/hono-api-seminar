# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Backend API for **API SEMINAR TIF** — Sistem Manajemen Seminar Kerja Praktik dan Tugas Akhir at TIF UIN Suska Riau. Built with **Hono v4** (OpenAPIHono) on **Bun** runtime with **Prisma** (PostgreSQL) and **OpenRouter** for AI-powered schedule generation.

## Commands

```bash
bun run dev                         # Dev server with hot reload (src/index.ts)
bun run start                       # Production server
bun run dev:worker                  # Background worker with hot reload (src/worker.ts)
bun run start:worker                # Production worker
bunx prisma migrate dev             # Create and apply migration
bunx prisma migrate deploy          # Apply migrations (production)
bunx prisma db seed                 # Seed database
bunx prisma studio                  # Database GUI
bunx prisma generate                # Regenerate Prisma client after schema changes
bunx tsc --noEmit --skipLibCheck    # Type-check project source
```

No test, lint, or build script is configured in `package.json`. `bunx tsc --noEmit` currently reports dependency declaration errors unless `--skipLibCheck` is used.

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
- **`src/utils/`** — `APIError`, custom `Logger`, Zod error formatter, OpenRouter helpers, crypto utilities
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

`JadwalDraftService` gathers context (rooms, existing schedules, dosen constraints), sends chunked requests to OpenRouter with structured prompts, validates output against Zod schemas, and creates draft schedule records. Supports approve/reject workflow. Prompts are in `src/prompts/`. `OpenRouterService.chatCompletion()` is the gateway for AI calls and applies bounded timeout/retry handling for transient upstream errors.

### Database

PostgreSQL via Prisma with `@prisma/adapter-pg`. Connection is a lazy-initialized singleton with a Proxy for backward-compatible imports. Schema in `prisma/schema.prisma`. Seed data in `prisma/seed.ts` and `src/data/*.sql`.

`pendaftaran` stores document/form values in the `data_pendaftaran` EAV-style table and tracks both `status_berkas` and `status_jadwal`. `tahun_ajaran` codes use `TahunAjaranHelper` format `YYYY1` for ganjil and `YYYY2` for genap.

## Conventions

- **Static classes** for handlers, services, and repositories (no DI injection into these layers)
- **Singleton pattern** with `getInstance()`/`resetInstance()` for infrastructure and utility classes
- **Zod everywhere**: env validation, request validation, LLM output validation
- **Custom logger**: use `createLogger('ContextName')` from `src/utils/logger.util.ts`
- Validators use `.refine()` for cross-field business rules
- Mutating module operations generally create audit logs via `LogService.createEntityLog` or `tx.log.create`; preserve this when adding `POST`, `PUT/PATCH`, or `DELETE` flows
- Environment config via `src/core/config.ts` singleton — avoid reading `process.env` directly outside infrastructure/bootstrap code that intentionally lazy-loads environment values
- New features go under `src/modules/<feature>/` with a barrel `index.ts`; mount the route in `src/index.ts` under `/api`
