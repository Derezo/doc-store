# doc-store

Self-hosted Markdown document storage with Obsidian sync via WebDAV.

## Features

- **Multi-user** with invitation-based registration and admin controls
- **Obsidian sync** via hand-implemented WebDAV server (compatible with the Remotely Save plugin)
- **Three editor modes** -- WYSIWYG (Tiptap), source Markdown (CodeMirror 6), and read-only rendered view (react-markdown)
- **Full-text search** powered by PostgreSQL `tsvector` with natural-language query syntax, ranked results, and highlighted snippets
- **Document version history** with per-document revision tracking
- **API key access** with configurable read/write scopes and optional vault restriction
- **Filesystem as source of truth** -- documents live on disk as `.md` files; PostgreSQL stores metadata for search and querying
- **Atomic writes** using temp-file-plus-rename to prevent partial reads
- **Real-time filesystem sync** via Chokidar watcher with 6-hour reconciliation job
- **Frontmatter-aware** -- tags and metadata extracted via `gray-matter` and indexed for search
- **Invite system** with optional email delivery via SMTP

## Architecture

```
                        +-------------------+
                        |   Browser / App   |
                        +--------+----------+
                                 |
                        +--------v----------+
                        |      Nginx        |
                        | (reverse proxy +  |
                        |  TLS termination) |
                        +---+----------+----+
                            |          |
               /api, /webdav          / (frontend)
                            |          |
                   +--------v---+  +---v-----------+
                   | Express 5  |  | Next.js 15    |
                   | API :4000  |  | Frontend :3000|
                   | (REST +    |  | (React 19)    |
                   |  WebDAV)   |  +---------------+
                   +--+------+--+
                      |      |
             +--------v--+ +-v-----------+
             |PostgreSQL  | | Filesystem  |
             |17 (metadata| | (Markdown   |
             | + search)  | |  files)     |
             +------------+ +-------------+
```

**Data flow:** Obsidian syncs via WebDAV (HTTP Basic auth with API keys). The browser connects through the Next.js frontend, which calls the REST API. Both write paths persist Markdown files to disk and update PostgreSQL metadata. A Chokidar watcher detects external filesystem changes and syncs them to the database.

## Prerequisites

- **Node.js** 20+
- **npm** 9+
- **Docker** (for PostgreSQL, or provide your own PostgreSQL 17 instance)

## Quick Start

1. **Clone the repository**

   ```bash
   git clone git@github.com:Derezo/doc-store.git
   cd doc-store
   ```

2. **Start PostgreSQL**

   ```bash
   docker compose up -d
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Configure environment** (optional for local development)

   The API ships with sensible defaults for development. For production, create `packages/api/.env` and set at least `JWT_SECRET` and `DATABASE_URL`. See [Environment Variables](#environment-variables) below.

5. **Run database migrations**

   ```bash
   cd packages/api && npx drizzle-kit migrate && cd ../..
   ```

6. **Create an admin user**

   ```bash
   npm run create-admin -w packages/api -- --email admin@example.com --password your-password --name Admin
   ```

7. **Start development servers**

   ```bash
   npm run dev
   ```

   This starts the API on `http://localhost:4000` and the web frontend on `http://localhost:3000`.

8. **Verify**

   ```bash
   curl http://localhost:4000/api/v1/health
   ```

## Environment Variables

All variables are configured in `packages/api/src/config.ts` and validated with Zod on startup.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | `4000` | API server port |
| `DATABASE_URL` | `postgresql://docstore:docstore_dev@localhost:5432/docstore` | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-me-in-production-please-32chars` | JWT signing secret (min 32 characters) |
| `DATA_DIR` | `./data/vaults` | Filesystem storage root for vault files |
| `BASE_URL` | `http://localhost:4000` | Public URL of the API server |
| `WEB_URL` | `http://localhost:3000` | Public URL of the web frontend |
| `SMTP_HOST` | -- | SMTP server hostname (optional, for invitation emails) |
| `SMTP_PORT` | -- | SMTP server port (optional) |
| `SMTP_USER` | -- | SMTP username (optional) |
| `SMTP_PASS` | -- | SMTP password (optional) |
| `SMTP_FROM` | -- | From address for outgoing emails (optional) |

## Development

### Running in development

```bash
# All workspaces in parallel
npm run dev

# Individual workspaces
npm run dev:api     # API on :4000 (tsx watch, auto-reload)
npm run dev:web     # Web on :3000 (next dev, hot reload)
```

### Database workflow

The project uses Drizzle ORM. Edit the schema at `packages/api/src/db/schema.ts`, then generate and apply migrations:

```bash
cd packages/api
npx drizzle-kit generate    # Generate SQL migration from schema diff
npx drizzle-kit migrate     # Apply pending migrations
npx drizzle-kit studio      # Open visual database explorer
```

Never edit the generated SQL migration files directly.

### Building

```bash
npm run build    # Builds shared, then api, then web (respects workspace ordering)
```

### Linting

```bash
npm run lint     # Runs next lint on the web package
```

### Admin CLI

```bash
# Create an admin user
npm run create-admin -w packages/api -- --email user@example.com --password secret --name "User Name"

# Rebuild the full-text search index
npm run backfill-search -w packages/api
```

## Obsidian Sync Setup

doc-store includes a WebDAV server that is compatible with the [Remotely Save](https://github.com/remotely-save/remotely-save) Obsidian plugin. To set up sync:

1. **Create an API key** -- Log into the web UI, navigate to Settings, and create an API key with both `read` and `write` scopes. Optionally scope it to a specific vault.

2. **Install Remotely Save** -- In Obsidian, go to Settings > Community Plugins and install "Remotely Save".

3. **Configure the plugin** -- In the Remotely Save settings, choose **WebDAV** as the remote type and enter:

   | Field | Value |
   |-------|-------|
   | Server URL | `https://your-domain/webdav/your-vault-slug/` |
   | Username | Your email address |
   | Password | The API key you created (starts with `ds_k_`) |

4. **Test the connection** -- Use the "Check" button in Remotely Save to verify connectivity.

5. **Sync** -- Trigger a manual sync or configure automatic sync on the schedule you prefer.

The WebDAV server supports the full set of methods Obsidian requires: OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, LOCK, and UNLOCK.

## API Overview

All REST endpoints are prefixed with `/api/v1`. Authentication is via JWT Bearer token (from login) or API key (via `Authorization: Bearer ds_k_...` header).

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None (invite token required) | Register a new account |
| POST | `/auth/login` | None | Log in, returns JWT + refresh cookie |
| POST | `/auth/refresh` | Cookie | Refresh access token (`X-Requested-With` header required) |
| POST | `/auth/logout` | Cookie | Log out, invalidates session |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | JWT | Current user profile |
| GET | `/users/me/storage` | JWT | Storage usage per vault |
| POST | `/users/invite` | JWT (admin) | Create an invitation |
| GET | `/users/invitations` | JWT (admin) | List invitations |
| DELETE | `/users/invitations/:id` | JWT (admin) | Revoke an invitation |

### Vaults

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vaults` | JWT or API key (read) | List vaults |
| POST | `/vaults` | JWT or API key (write) | Create a vault |
| GET | `/vaults/:vaultId` | JWT or API key (read) | Get vault details |
| PATCH | `/vaults/:vaultId` | JWT or API key (write) | Update a vault |
| DELETE | `/vaults/:vaultId` | JWT or API key (write) | Delete a vault |
| GET | `/vaults/:vaultId/tree` | JWT or API key (read) | Get full vault file tree |

### Documents

All document routes are nested under `/vaults/:vaultId/documents`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT or API key (read) | List documents (optional `?dir=path`) |
| GET | `/*path` | JWT or API key (read) | Get document content and metadata |
| GET | `/*path/versions` | JWT or API key (read) | Get version history |
| PUT | `/*path` | JWT or API key (write) | Create or update a document |
| DELETE | `/*path` | JWT or API key (write) | Delete a document |

### API Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api-keys` | JWT | List API keys |
| POST | `/api-keys` | JWT | Create an API key |
| GET | `/api-keys/:keyId` | JWT | Get key details |
| PATCH | `/api-keys/:keyId` | JWT | Update a key |
| DELETE | `/api-keys/:keyId` | JWT | Delete a key |

### Search

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search?q=...&vault=...&tags=...&limit=20&offset=0` | JWT or API key (read) | Full-text search across documents |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |

## API Documentation

Interactive API documentation is available via Swagger UI:

- **Swagger UI**: `http://localhost:4000/api/docs` -- browse and try out endpoints
- **OpenAPI JSON**: `http://localhost:4000/api/docs/json` -- raw OpenAPI 3.1 spec for tooling

The OpenAPI spec is generated from the Zod schemas used for request validation, so it is always in sync with the actual API.

For LLM/AI agent integration, see [LLM_GUIDE.md](./LLM_GUIDE.md) which provides a self-contained reference with curl examples and tips for programmatic access.

## Deployment

### Production build

```bash
npm run build
```

### Running with PM2

The repository includes a PM2 configuration at `ecosystem.config.cjs`:

```bash
pm2 start ecosystem.config.cjs
```

This starts two processes:

- `doc-store-api` -- Express API on port 4000 (max 512 MB)
- `doc-store-web` -- Next.js frontend on port 3000 (max 512 MB)

Logs are written to the `logs/` directory.

### Nginx reverse proxy

An example Nginx configuration is provided at `nginx/doc-store.conf`. To use it:

1. Copy to `/etc/nginx/sites-available/doc-store.conf`
2. Create a symlink: `ln -s /etc/nginx/sites-available/doc-store.conf /etc/nginx/sites-enabled/`
3. Update `server_name` and SSL certificate paths for your domain
4. Test and reload: `nginx -t && systemctl reload nginx`

The configuration handles:

- TLS termination with modern cipher suites
- `/webdav/` proxied to `:4000` with streaming enabled and 50 MB upload limit
- `/api/` proxied to `:4000` with 10 MB body limit
- `/` proxied to `:3000` (Next.js) with WebSocket support
- HTTP-to-HTTPS redirect
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)

### Production checklist

- Set a strong `JWT_SECRET` (at least 32 random characters)
- Set `NODE_ENV=production`
- Configure `BASE_URL` and `WEB_URL` to your public domain
- Ensure `DATA_DIR` points to a persistent, backed-up filesystem path
- Set up TLS certificates (e.g., via Let's Encrypt)
- Configure SMTP variables if you want invitation emails delivered

## Project Structure

```
doc-store/
├── docker-compose.yml          # PostgreSQL 17 container
├── ecosystem.config.cjs        # PM2 production config
├── nginx/
│   └── doc-store.conf          # Nginx reverse proxy config
├── scripts/
│   ├── backup.sh               # Backup script
│   └── deploy.sh               # Deployment script
├── packages/
│   ├── shared/                 # Shared package (@doc-store/shared)
│   │   └── src/
│   │       ├── constants.ts    # API prefix, shared constants
│   │       ├── schemas/        # Zod validation schemas
│   │       └── types/          # TypeScript type definitions
│   ├── api/                    # API server (@doc-store/api)
│   │   └── src/
│   │       ├── index.ts        # Express app entry point
│   │       ├── config.ts       # Environment variable validation
│   │       ├── cli/            # Admin CLI tools
│   │       ├── db/             # Drizzle schema and connection
│   │       ├── middleware/     # Auth, rate limiting, error handling
│   │       ├── routes/         # REST API route handlers
│   │       ├── services/       # Business logic layer
│   │       ├── utils/          # JWT, crypto, logging, errors
│   │       └── webdav/         # WebDAV server implementation
│   └── web/                    # Frontend (@doc-store/web)
│       └── src/
│           ├── app/            # Next.js App Router pages
│           │   ├── (auth)/     # Login and registration pages
│           │   └── (app)/      # Protected application pages
│           ├── components/     # React components
│           │   ├── browser/    # File browser
│           │   ├── editor/     # Tiptap + CodeMirror editors
│           │   ├── layout/     # Shell, sidebar, navigation
│           │   ├── search/     # Search modal (Cmd+K)
│           │   └── viewer/     # Read-only Markdown viewer
│           ├── hooks/          # Custom React hooks
│           └── lib/
│               ├── api-client.ts   # ky-based API client
│               ├── markdown/       # Markdown processing utilities
│               └── stores/         # Zustand state stores
└── package.json                # Root workspace configuration
```

## License

MIT
