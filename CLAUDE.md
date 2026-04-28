# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Backend API for **ZRAES AI** — Sistem Manajemen Seminar Kerja Praktik dan Tugas Akhir at TIF UIN Suska Riau. Built with **Hono v4** (OpenAPIHono) on **Bun** runtime with **Prisma** (PostgreSQL) and **OpenRouter** for AI-powered schedule generation.

## Commands

```bash
bun run dev                    # Dev server with hot reload
bun run start                  # Production server
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
src/routes/*.route.ts       # Hono route definitions + middleware chain (auth + zod validation)
src/handlers/*.handler.ts   # Static classes, extract params from Context, delegate to services
src/services/*.service.ts   # Business logic, throw APIError for violations
src/repositories/*.repository.ts  # Prisma query wrappers, extend BaseRepository
```

All route groups are mounted under `/api` in `src/index.ts`:
```ts
app.route('/api', globalRoute);
app.route('/api', jadwalRoute);
// etc.
```

### Key Directories

- **`src/core/`** — DI container (`container.ts`), Zod-validated config singleton (`config.ts`), bootstrap (`bootstrap.ts`)
- **`src/infrastructures/`** — Singleton infrastructure: Prisma DB, Nodemailer, OpenRouter LLM gateway
- **`src/middlewares/`** — JWT Bearer auth + role-based access (`auth.middleware.ts`), structured request logging (`log.middleware.ts`)
- **`src/validators/`** — Zod schemas for request validation, applied via `zValidator()` in routes
- **`src/prompts/`** — LLM prompt engineering: markdown persona/task prompts (`base/`, `tasks/`), typed rule constants (`context/`), Zod structured output schemas (`output/`)
- **`src/helpers/`** — Domain-specific data transformation utilities
- **`src/utils/`** — `APIError` class, custom `Logger`, Zod error formatter, OpenRouter helpers
- **`src/types/`** — TypeScript interfaces and type definitions

### Response Format

All endpoints return: `{ response: boolean, message: string, data?: any }`

Errors use `APIError` (from `src/utils/api-error.util.ts`) with a `statusCode` field. The global error handler in `GlobalHandler.error()` catches these and returns structured JSON.

### Authentication

JWT Bearer token extracted in middleware (`AuthMiddleware.JWTBearerTokenExtraction`). **No signature verification** — relies on an external auth service. Roles: `mahasiswa`, `dosen`, `koordinator`. Use `AuthMiddleware.requireRole(...)` for role-based guards. User payload accessed via `c.get('user')`.

### AI Schedule Generation

`JadwalDraftService` gathers context (rooms, existing schedules, dosen constraints), sends to OpenRouter LLM with structured prompts, validates output against Zod schemas, and creates draft schedule records. Supports approve/reject workflow. Prompts are in `src/prompts/`.

### Database

PostgreSQL via Prisma with `@prisma/adapter-pg`. Connection is a lazy-initialized singleton with a Proxy for backward-compatible imports. Schema in `prisma/schema.prisma` — 11 models, 6 enums. Seed data in `prisma/seed.ts` and `src/data/*.sql`.

## Conventions

- **Static classes** for handlers, services, and repositories (no DI injection into these layers)
- **Singleton pattern** with `getInstance()`/`resetInstance()` for infrastructure and utility classes
- **Zod everywhere**: env validation, request validation, LLM output validation
- **Custom logger**: use `createLogger('ContextName')` from `src/utils/logger.util.ts`
- Validators use `.refine()` for cross-field business rules
- Environment config via `src/core/config.ts` singleton — never read `process.env` directly
