# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

Backend API for **API SEMINAR TIF** — Sistem Manajemen Seminar Kerja Praktik dan Tugas Akhir at TIF UIN Suska Riau. The API runs on **Bun** + **Hono v4/OpenAPIHono**, uses **Prisma 7** with PostgreSQL, **Redis/ioredis** for cache/rate-limit/worker queue, **OpenRouter** for AI workflows, **Nodemailer** for email, and **Google APIs** for Drive uploads and Calendar invitations.

The application has two runtime processes:

1. **HTTP API server** (`src/index.ts`) — request routing, validation, auth, docs, synchronous DB mutations.
2. **Background worker** (`src/worker.ts`) — Redis-backed queue consumer for long-running AI jobs, async audit-log writes, pendaftaran notification email, and jadwal/Google Calendar invitation delivery.

Both processes must point to the same PostgreSQL and Redis instances in production.

## Commands

```bash
bun run dev                              # API server with hot reload (src/index.ts)
bun run start                            # API server (production-style Bun run)
bun run dev:worker                       # Worker with hot reload (src/worker.ts)
bun run start:worker                     # Worker process
bun run demo:reset-db                    # DESTRUCTIVE demo reset: db push reset + seed + Redis clear

bunx prisma migrate dev                  # Create/apply migration locally
bunx prisma migrate deploy               # Apply migrations in production
bunx prisma db push                      # Push Prisma schema without migration (dev/demo only)
bunx prisma db seed                      # Run prisma/seed.ts
bunx prisma studio                       # Prisma GUI
bunx prisma generate                     # Regenerate Prisma client

bunx tsc --noEmit --skipLibCheck --pretty false  # Type-check project source
sh -n entrypoint.sh                              # Validate container entrypoint syntax
```

No test, lint, or build script is configured in `package.json`. Use `--skipLibCheck` for TypeScript checks because dependency declaration files can report external errors.

## Deployment / Runtime

The Docker image uses `entrypoint.sh` and `APP_PROCESS` to choose the process:

```bash
APP_PROCESS=server   # or api: starts src/index.ts
APP_PROCESS=worker   # starts src/worker.ts
```

Run at least one API process and one worker process when queue-backed features are enabled. If the API is running without a worker, AI/log jobs can be enqueued but will remain `queued` until a worker starts.

Important runtime env keys:

- `DATABASE_URL` — PostgreSQL connection string used by Prisma adapter-pg.
- `REDIS_ENABLED`, `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_KEY_PREFIX` — Redis cache/rate-limit/queue config.
- `WORKER_JOB_TTL_SECONDS` — how long job status/result records remain in Redis.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL(S)`, `OPENROUTER_TIMEOUT_MS`, `OPENROUTER_MAX_RETRIES` — AI gateway config.
- `EMAIL_USER`, `EMAIL_PASS`, `DEV_EMAIL_SINK` — mail sender config. Non-production email is redirected to `DEV_EMAIL_SINK` when set.
- `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` — Drive upload.
- `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` — Calendar invitations. Calendar sends attendee updates only in production; non-production creates/updates events with `sendUpdates=none`.

## Architecture

### Request Flow

```text
HTTP -> Hono route -> middleware -> zValidator -> handler -> service -> repository -> Prisma/PostgreSQL
```

`src/index.ts` builds the Hono app, applies CORS, structured request logging, a global `/api/*` rate limiter, global error handlers, OpenAPI docs at `/openapi.json`, Swagger UI at `/docs`, then mounts `apiRouter` under `/api`.

`src/api.ts` imports all route groups and mounts them at `/` relative to `/api`.

### Layering

- **Routes** define paths, auth/rate-limit middleware, and Zod validation.
- **Handlers** are static classes that extract `Context` params/body/user and call services.
- **Services** contain business rules, transactions, cache invalidation, logs, and external integrations.
- **Repositories** wrap Prisma queries. Many module repositories are static; legacy repositories may extend `BaseRepository`.

### Two Coexisting Layouts

- **Legacy flat layout**: `src/routes/`, `src/handlers/`, `src/services/`, `src/repositories/`, `src/validators/`, `src/types/`.
- **Preferred feature module layout**: `src/modules/<feature>/` colocates:
  - `<feature>.route.ts`
  - `<feature>.handler.ts`
  - `<feature>.service.ts`
  - `<feature>.repository.ts`
  - `<feature>.validator.ts`
  - `<feature>.type.ts`
  - `index.ts` barrel exports

Use the module layout for new features.

### Router Choice

`OpenAPIHono` is instantiated with **`RegExpRouter`** in both `src/index.ts` and route modules. Keep this. The default TrieRouter previously caused `UnsupportedPathError` when static and dynamic sibling paths conflicted at the same depth (for example `/x/static` next to `/x/:id`). Still define static routes before dynamic `:id` routes.

## Key Directories

- `src/core/` — config singleton (`config.ts`), lightweight DI container, bootstrap/shutdown.
- `src/infrastructures/` — Prisma DB, Redis, mail, OpenRouter, Google Drive, Google Calendar.
- `src/modules/` — current feature modules and preferred place for new work.
- `src/routes/`, `src/handlers/`, `src/services/`, `src/repositories/` — legacy/flat features still in use.
- `src/middlewares/` — JWT auth, rate limits, request logging.
- `src/prompts/` — LLM prompts and structured output schemas.
- `src/helpers/` — domain helpers for auth, jadwal, dosen, ruangan, tahun ajaran, crypto, etc.
- `src/utils/` — `APIError`, logger, OpenRouter helpers, cache utilities, Zod error formatter.
- `src/data/` — SQL seed data. `prisma/seed.ts` currently loads only `dosen.sql` and `mahasiswa.sql` from this directory; demo SQL files are intentionally separate.
- `scripts/` — operational scripts such as destructive demo DB reset.
- `prisma/schema.prisma` — database model/enums.

## Worker Queue

Worker infrastructure lives in `src/modules/worker-job/` and `src/worker.ts`.

Queue behavior:

- Queue and job records are stored in Redis with namespaced keys (`REDIS_KEY_PREFIX`).
- `WorkerJobService.enqueue()` writes a job JSON record and pushes the job id onto the Redis list.
- Worker uses `BRPOP` via `waitForNextJob()` and processes one job at a time in a loop.
- Job status values: `queued`, `running`, `completed`, `failed`.
- Progress events are appended with a monotonic `sequence` so SSE can stream only new events.
- Job records expire after `WORKER_JOB_TTL_SECONDS` (default 24 hours).

Current job types:

- `log.create` — async audit-log insert.
- `pendaftaran.email.send` — send pendaftaran notification email by worker.
- `jadwal.email.send` — send/sync jadwal invitation through Google Calendar by worker.
- `jadwal-draft.generate` — AI batch schedule draft generation.
- `constraint-dosen.chat` — AI parse/create dosen constraints from natural language.
- `constraint-dosen.chat-update` — AI parse/update one dosen constraint.

Status endpoint:

- `GET /api/worker/jobs/:job_id` — authenticated generic job status/result lookup.

Feature-specific job aliases:

- `GET /api/koordinator/jadwal-draft/generate/jobs/:job_id`
- `GET /api/dosen/constraint-saya/chat/jobs/:job_id`

SSE helper:

- `streamWorkerJob()` in `worker-job.sse.ts` polls job status/progress and emits `connected`, `heartbeat`, `job:status`, progress events, and terminal `job:done`/`job:error`.

## AI Workflows

### Schedule draft generation

`JadwalDraftService.generate()` gathers rooms, existing schedules, dosen constraints, and requested students, chunks generation (`GENERATE_CHUNK_SIZE = 8`), calls OpenRouter, validates the model output with Zod (`GenerateBatchOutputSchema`), and creates `jadwal_draft` records. Approve/reject workflow lives in the same module.

Generation tuning (keep small for reliability):

- `GENERATE_CHUNK_SIZE = 8` mahasiswa per request. Do not set to `Infinity` — a single giant request balloons context (30-50KB), forces large output/timeout, and increases AI hallucination of constraint conflicts. Cross-chunk awareness is preserved by `generatedBlockingSchedules`, which is appended after each valid chunk and fed into the next chunk's `jadwal_ada` context. Dosen constraints are auto-filtered per chunk via `getConstraintsForNipsCached([...chunkNips])`.
- `generateChunkSuggestions` uses `maxTokens: 8192`, `timeoutMs: 90_000`, and `response_format: { type: 'json_object' }` (structured output to reduce parse failures). `extractJsonFromAiContent` + `JSON.parse` remain as fallback.
- Mahasiswa/dosen validation at the start of `generate()` runs in parallel (`Promise.all`), not serially, before the AI request.
- After AI output, `repairGeneratedDraftsHardConstraints` (neuro-symbolic repair to first valid slot) runs before `validateGeneratedDraftsHardConstraints` (final hard-constraint guard). Keep both; structured output lowers parse failure, not hard-constraint failure.

Important routes:

- `POST /api/koordinator/jadwal-draft/generate` — enqueues worker job and returns `202` with `job_id`.
- `POST /api/koordinator/jadwal-draft/generate/stream` — enqueues worker job and streams Redis job progress.

Approve/reject:

- `JadwalDraftService.approveBatch()` turns DRAFT rows into real `jadwal` inside a `prisma.$transaction`. For each approved draft it must update `pendaftaran.status_jadwal` to `SUDAH_JADWAL` via `PendaftaranRepository.updateStatusJadwalByJadwalData(nim, id_jenis_seminar, kode_tahun_ajaran, StatusJadwal.SUDAH_JADWAL, tx)`. Any code path that creates a `jadwal` (here and `JadwalService.post()`) must keep `pendaftaran.status_jadwal` in sync, matched on `nim` + `id_jenis_seminar` + `kode_tahun_ajaran`.

Do not put long-running OpenRouter calls directly in HTTP handlers. Enqueue worker jobs instead.

### Constraint chat

`ConstraintDosenService.chat()` and `chatUpdate()` parse natural language into validated constraint data using OpenRouter + `ParseConstraintOutputSchema`.

Routes:

- `POST /api/dosen/constraint-saya/chat` — enqueues create-from-chat job.
- `PUT /api/dosen/constraint-saya/:id/chat` — enqueues update-from-chat job.

### OpenRouter gateway

Use `openRouterService.chatCompletion()` from `src/infrastructures/openrouter.infrastructure.ts`. It handles:

- Required `OPENROUTER_API_KEY` validation.
- Timeout/abort handling.
- Retry for transient upstream statuses (429/5xx/timeout etc.).
- Mapping upstream failures to `APIError`.
- Low-latency provider preferences where requested.
- Structured output via `response_format` (`{ type: 'json_object' }` or `json_schema`) when set in `ChatCompletionOptions`. Models that do not support it are gracefully ignored by OpenRouter, so keep caller-side JSON parsing as fallback.

Prompts live under `src/prompts/base`, `src/prompts/tasks`, `src/prompts/context`, and output schemas under `src/prompts/output`.

## Database, Cache, and Seeds

### Prisma / PostgreSQL

- Prisma uses `@prisma/adapter-pg` and `withAccelerate()` extension.
- DB singleton is lazy and exported through `src/infrastructures/db.infrastructure.ts`.
- Schema uses PostgreSQL provider; datasource URL comes from `DATABASE_URL` at runtime.
- Keep multi-table mutations in `prisma.$transaction()` and use transaction-scoped Prisma (`tx`) for all reads/writes that must be atomic.

Domain notes:

- `pendaftaran` stores document/form values in `data_pendaftaran` (EAV-style) and tracks both `status_berkas` and `status_jadwal`.
- `jadwal` has uniqueness constraints around `nim`, seminar type, and academic year.
- `jadwal_draft` stores AI suggestions by `batch_id`, with status `DRAFT`, `APPROVED`, or `REJECTED`.
- `tahun_ajaran` codes use `TahunAjaranHelper`: `YYYY1` for ganjil and `YYYY2` for genap.
- `constraint_dosen` stores parsed availability/preference/location constraints and raw AI data.

### Redis

Redis is used for:

- General caching via `redisService.remember/getJson/setJson`.
- Rate-limit counters.
- Worker queue and job state.

Redis is designed to degrade gracefully for cache/rate-limit paths, but the worker queue requires Redis. Some log enqueue paths fall back to synchronous DB writes when Redis is unavailable.

Use `CacheInvalidation` utilities after mutating cached entities.

### Seed/demo data

- `prisma/seed.ts` seeds base/reference data and optionally loads selected SQL files such as `dosen.sql` and `mahasiswa.sql`.
- Demo SQL files (`src/data/demo-*.sql`) are intentionally separate. Do not silently add them to normal seed unless the task explicitly asks for demo reset behavior.
- `bun run demo:reset-db` is destructive. It runs `prisma db push --force-reset --accept-data-loss`, `prisma db seed`, clears Redis cache, and prints a demo summary. It refuses `APP_ENV=production` unless `--allow-production` is passed. If demo-specific rows are required, explicitly review/wire the `src/data/demo-*.sql` files first; normal seed does not currently execute them.

## Authentication and Authorization

`AuthMiddleware.JWTBearerTokenExtraction` extracts a Bearer JWT, decodes payload, and stores it at `c.get('user')`.

Important: this middleware **does not verify JWT signatures**; it relies on an external auth service/trust boundary. Do not assume cryptographic verification exists unless you add it.

Known roles:

- `mahasiswa`
- `dosen`
- `koordinator`

Use `AuthMiddleware.requireRole(...)` where role enforcement is needed. Some existing routes only require a decoded token and enforce identity in service logic.

## Rate Limiting

Global rate limiting is applied to `/api/*` in `src/index.ts`. Additional route-level tiers are available in `RateLimitMiddleware`:

- `global`
- `read`
- `write`
- `authStrict`
- `aiExpensive`

`aiExpensive` routes share a Redis counter prefix so generate and stream endpoints cannot bypass each other by alternating. If Redis is unavailable, the limiter falls back to in-memory counting.

Health/docs/openapi paths bypass rate limits.

## Audit Logging

Audit logs are domain-level records in the `log` table.

Guidelines:

- For normal non-transactional mutations, use `LogService.createEntityLog(...)`, `createJadwalLog(...)`, or `createPenilaianLog(...)`. These enqueue `log.create` worker jobs.
- For transaction-critical logs, write through the transaction (`tx.log.create(...)`) or use `LogService.createEntityLogTx(...)`. Do not enqueue logs that must atomically commit/rollback with the domain mutation.
- Worker log processing calls `LogService.createEntityLogSync(...)` to avoid enqueue recursion.
- If the log queue is unavailable, `LogService` falls back to synchronous DB insert for log preservation.

## External Integrations

### Email

`mail.infrastructure.ts` uses Nodemailer. In non-production, when `DEV_EMAIL_SINK` is set, outbound recipients are overridden to the sink and original recipients are included in the message notice. Prefer the mail infrastructure over direct Nodemailer usage.

### Google Drive

`google-drive.infrastructure.ts` uploads registration files using a service-account JWT. `UploadService` validates file size/MIME and builds Drive folder paths/names.

### Google Calendar

`google-calendar.infrastructure.ts` creates/updates deterministic events for jadwal invitations. `JadwalService` enqueues `jadwal.email.send` after successful jadwal create/update; the worker then syncs Calendar invitations. Missing Google credentials cause Calendar sync to be skipped in the worker rather than blocking saved jadwal.

## Error Handling and Response Shape

Throw `APIError(message, statusCode, details?)` for expected business/API errors. `GlobalHandler.error` maps `APIError` to JSON and hides unknown server errors.

`APIError` carries an optional `details?: Record<string, unknown>` field for structured failure context. For AI validation failures (jadwal-draft and constraint-dosen workers), embed a short human-readable suffix in the message (`"<message> [Detail: ...]"`) AND populate `details`. The worker (`src/worker.ts`) logs both `error` (message) and `details`; `WorkerJobService.serializeError` persists `details` into the job record so SSE/poll responses expose it. Prefer the `buildAIError(message, detailText, details, statusCode)` helper pattern used in `jadwal-draft.service.ts` and `constraint-dosen.service.ts` instead of bare generic messages.

Common response shape:

```ts
{
  response: boolean,
  message: string,
  data?: unknown,
  pagination?: unknown,
}
```

Validation errors are formatted through `zodError`.

## Conventions

- Use **static classes** for handlers, services, and repositories unless following an existing instance-based infrastructure pattern.
- Use **singleton pattern** with `getInstance()`/`resetInstance()` for infrastructure utilities.
- Use **Zod** for env validation, request validation, and LLM output validation.
- Use `createLogger('ContextName')` instead of raw `console` for application logs.
- Environment config belongs in `src/core/config.ts`; avoid direct `process.env` reads outside infrastructure/bootstrap code unless the file already intentionally lazy-loads env.
- Keep route validators close to modules for new work (`*.validator.ts`).
- Apply `RateLimitMiddleware.write()` to mutating endpoints and `RateLimitMiddleware.aiExpensive()` to AI endpoints.
- Preserve audit logging and cache invalidation when changing mutating flows.
- Keep static routes before dynamic `:id` routes.
- For date/time scheduling, preserve Asia/Jakarta behavior and use existing helpers (`JadwalHelper`, `TahunAjaranHelper`) rather than ad-hoc formatting.
- For worker payloads, store JSON-serializable data only. Rehydrate dates/enums in `src/worker.ts` before calling services.

## Validation Checklist Before Finishing Changes

Run at minimum:

```bash
bunx tsc --noEmit --skipLibCheck --pretty false
```

Also run targeted checks depending on the change:

```bash
sh -n entrypoint.sh                         # if entrypoint/deploy scripts changed
bunx prisma generate                        # if Prisma schema changed
bunx prisma migrate dev                     # if schema migration is required
bunx prisma db seed                         # if seed files changed
bun run demo:reset-db                       # only for intentional destructive demo validation
```

For worker/AI changes, verify:

- API endpoint returns `202` + `job_id` for queued flows.
- Worker process consumes the job and sets terminal status.
- SSE emits progress and terminal events without duplicating progress sequence.
- Redis unavailable behavior is acceptable for the touched code path.

For seed safety, verify normal seed does not accidentally execute demo-only SQL unless explicitly intended.
