# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-user Markdown document storage service with Obsidian sync via WebDAV. Monorepo with three npm workspaces:

- **packages/shared** — Zod schemas, TypeScript types, constants (consumed by both api and web)
- **packages/api** — Express 5 REST API + WebDAV server (ESM, `"type": "module"`)
- **packages/web** — Next.js 15 frontend with React 19

## Commands

```bash
# Prerequisites
docker compose up -d                    # Start PostgreSQL 17

# Development (runs all workspaces in parallel)
npm run dev

# Individual workspace dev
npm run dev:api                         # API on :4000 (tsx watch)
npm run dev:web                         # Web on :3000 (next dev)

# Build all workspaces
npm run build

# Lint (web only, via next lint)
npm run lint

# Database (run from packages/api)
cd packages/api && npx drizzle-kit generate   # Generate migration from schema changes
cd packages/api && npx drizzle-kit migrate    # Apply pending migrations
cd packages/api && npx drizzle-kit studio     # Visual DB explorer

# Admin CLI
npm run create-admin -w packages/api -- --email X --password Y --name Z
npm run backfill-search -w packages/api       # Rebuild search index

# Self-hosting (build + PM2)
npm run build && pm2 start ecosystem.config.cjs
```

### Testing

```bash
# Run all tests across workspaces
npm test

# Run tests for a specific package
npm test -w packages/shared
npm test -w packages/api
npm test -w packages/web

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# API: unit vs integration tests
npm run test:unit -w packages/api          # Pure function + middleware tests
npm run test:integration -w packages/api   # Supertest integration tests (requires test DB)

# E2E tests (requires running dev servers + DB)
npm run test:e2e
```

Test framework: **Vitest** (unit/integration) + **Playwright** (E2E). Integration tests skip gracefully when the test database is unavailable.

## Architecture

### API (Express 5)

**Middleware mount order matters** — WebDAV routes are registered *before* `express.json()` to allow raw body streaming for file uploads. The full chain:

1. Security headers + request logger
2. **WebDAV** (`/webdav`) with its own rate limiter
3. `express.json()` + `cookieParser()`
4. API rate limiter (`/api`)
5. Auth routes with stricter rate limiter on login/register
6. Resource routes: users, vaults, documents, api-keys, search
7. Global error handler (must be last)

**Route prefix:** All REST routes use `API_PREFIX` = `/api/v1` from shared constants.

**Document routes** are nested: `/api/v1/vaults/:vaultId/documents/*path` — the wildcard captures the document's file path.

### Auth Flow

- Passwords hashed with **argon2**; JWTs signed with **jose** (HS256, 15min expiry)
- Login returns access token in body + refresh token as httpOnly cookie
- Refresh endpoint requires `X-Requested-With` header (CSRF protection)
- API keys use `ds_k_` prefix, looked up by prefix for fast verification
- API keys support scope restriction (`read`/`write`) and optional vault scoping

### File Storage & Sync

- **Filesystem is source of truth**, PostgreSQL stores metadata for search/querying
- Layout: `{DATA_DIR}/{userId}/{vaultSlug}/{path.md}`
- Atomic writes: temp file + rename to prevent partial reads
- **Chokidar** watches DATA_DIR; debounce 500ms; ignores `.obsidian/` and non-`.md` files
- Recently-written set (5s TTL) prevents double-processing files the API just wrote
- 6-hour reconciliation job syncs filesystem state to database

### WebDAV

Hand-implemented (not nephele) for Express 5 compatibility. Supports OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, LOCK, UNLOCK. CORS restricted to Obsidian origins only (`app://obsidian.md`, `capacitor://`).

### Web Frontend

- **Routing:** `(auth)` group for login/register, `(app)` group for protected pages
- **Editor:** Three modes — Tiptap (WYSIWYG), CodeMirror 6 (source markdown), react-markdown (read-only view)
- **State:** Zustand stores for auth, vault, and editor state
- **API client:** `ky` with automatic Bearer token injection and 401 retry via token refresh
- **Styling:** Tailwind v4 — uses CSS-based config (`@import "tailwindcss"` in CSS), NOT `tailwind.config.js`

### Shared Package

Exports Zod schemas (auth, vault, document, api-key, search) and TypeScript types used by both API and web. Must be built before other packages can consume it (`npm run build` handles this via workspace ordering).

### Database (Drizzle ORM + PostgreSQL 17)

Schema at `packages/api/src/db/schema.ts`. Tables: users, invitations, sessions, vaults, documents, document_versions, api_keys. Uses custom Drizzle `customType` for PostgreSQL `tsvector` columns. Full-text search via `websearch_to_tsquery` + `ts_rank_cd` + `ts_headline`.

### Error Handling

Custom `AppError` base class in `packages/api/src/utils/errors.ts` with subclasses: `ValidationError` (400), `AuthenticationError` (401), `AuthorizationError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429). The global error handler also catches Zod validation errors.

## Key Patterns & Gotchas

- **Express 5 wildcard routes:** Use `/*splat` syntax; captured as `req.params.splat` (may be an array)
- **ESM imports:** All API imports require `.js` extensions (e.g., `import { config } from './config.js'`)
- **Drizzle migrations:** Edit `schema.ts`, then `generate` + `migrate` (never edit SQL files directly)
- **Markdown processing:** Frontmatter extracted via `gray-matter`; tags and stripped content stored in DB for search
- **rehype pipeline:** `rehype-raw` must be followed by `rehype-sanitize` to prevent script injection
- **SQL LIKE patterns:** Escape `%` and `_` to prevent wildcard injection
- **Environment validation:** `packages/api/src/config.ts` validates all env vars via Zod on startup with sensible defaults for development
