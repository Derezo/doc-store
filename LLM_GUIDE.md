# doc-store API Guide for LLMs

This document is a self-contained reference for LLMs and AI agents that have been given a `ds_k_` API key to interact with a doc-store instance. It covers authentication, every available endpoint, common workflows with examples, and best practices.

doc-store is a multi-user Markdown document storage service. Documents are organized into **vaults** (collections), each containing Markdown files arranged in a directory hierarchy. The API provides full CRUD operations on vaults and documents, plus full-text search.

---

## Authentication

All authenticated requests use a Bearer token in the `Authorization` header:

```
Authorization: Bearer ds_k_...
```

### API Key Properties

| Property | Description |
|----------|-------------|
| **Prefix** | All API keys start with `ds_k_` |
| **Scopes** | `read` (list, get, search) and/or `write` (create, update, delete) |
| **Vault scoping** | A key may be scoped to a single vault, or grant access to all vaults owned by the user |

If your key is vault-scoped, any request targeting a different vault will return a `403 AUTHORIZATION_ERROR`. If your key lacks the required scope for an operation (e.g., `write` for a PUT request), the API returns `403 AUTHORIZATION_ERROR`.

---

## Base URL and Request Format

All REST endpoints are prefixed with `/api/v1`. Construct the full URL as:

```
{BASE_URL}/api/v1/{endpoint}
```

For example, if the server runs at `http://localhost:4000`:

```
http://localhost:4000/api/v1/vaults
```

**Content-Type:** Send `application/json` for all request bodies. Responses are always JSON.

**Rate limit:** 100 requests per minute per IP address. When exceeded, the API returns a `429` response.

---

## Error Format

All errors follow this JSON structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of the problem",
  "statusCode": 400
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Invalid request body, query parameters, or path |
| `AUTHENTICATION_ERROR` | 401 | Missing, invalid, or expired API key |
| `AUTHORIZATION_ERROR` | 403 | API key lacks required scope or vault access |
| `NOT_FOUND` | 404 | Vault or document does not exist |
| `CONFLICT` | 409 | Resource already exists (e.g., duplicate vault name) |
| `RATE_LIMIT` | 429 | Too many requests; wait and retry |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

## Endpoint Quick Reference

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/health` | none | Health check (public) |
| GET | `/api/v1/vaults` | read | List all accessible vaults |
| POST | `/api/v1/vaults` | write | Create a new vault |
| GET | `/api/v1/vaults/:vaultId` | read | Get vault details |
| PATCH | `/api/v1/vaults/:vaultId` | write | Update vault name/description |
| DELETE | `/api/v1/vaults/:vaultId` | write | Delete a vault and all its documents |
| GET | `/api/v1/vaults/:vaultId/tree` | read | Get full directory tree of a vault |
| GET | `/api/v1/vaults/:vaultId/documents` | read | List documents (optional `?dir=` filter) |
| GET | `/api/v1/vaults/:vaultId/documents/{path}` | read | Get document metadata and content |
| PUT | `/api/v1/vaults/:vaultId/documents/{path}` | write | Create or update a document (upsert) |
| DELETE | `/api/v1/vaults/:vaultId/documents/{path}` | write | Delete a document |
| GET | `/api/v1/vaults/:vaultId/documents/{path}/versions` | read | Get version history for a document |
| GET | `/api/v1/search` | read | Full-text search across documents |

---

## Common Workflows

### 1. Discover Vaults

Start here. You need a vault ID for almost every other operation.

**Request:**

```bash
curl -s http://localhost:4000/api/v1/vaults \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "vaults": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "u1234567-89ab-cdef-0123-456789abcdef",
      "name": "Personal Notes",
      "slug": "personal-notes",
      "description": "My daily notes and journal entries",
      "createdAt": "2025-03-15T10:30:00.000Z",
      "updatedAt": "2025-06-20T14:15:00.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "userId": "u1234567-89ab-cdef-0123-456789abcdef",
      "name": "Work Projects",
      "slug": "work-projects",
      "description": null,
      "createdAt": "2025-04-01T08:00:00.000Z",
      "updatedAt": "2025-04-01T08:00:00.000Z"
    }
  ]
}
```

If your API key is vault-scoped, only the scoped vault will appear in the list.

---

### 2. Browse Vault Tree

Get the full directory structure of a vault at a glance. Useful for understanding how documents are organized before reading or writing.

**Request:**

```bash
curl -s http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tree \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "tree": [
    {
      "name": "inbox.md",
      "path": "inbox.md",
      "type": "file"
    },
    {
      "name": "projects",
      "path": "projects",
      "type": "directory",
      "children": [
        {
          "name": "api-redesign.md",
          "path": "projects/api-redesign.md",
          "type": "file"
        },
        {
          "name": "quarterly-review.md",
          "path": "projects/quarterly-review.md",
          "type": "file"
        }
      ]
    },
    {
      "name": "daily",
      "path": "daily",
      "type": "directory",
      "children": [
        {
          "name": "2025-06-20.md",
          "path": "daily/2025-06-20.md",
          "type": "file"
        }
      ]
    }
  ]
}
```

Files have `type: "file"` and no `children` property. Directories have `type: "directory"` and a `children` array.

---

### 3. List Documents

Get a flat list of documents with metadata. Optionally filter by directory path using the `?dir=` query parameter.

**Request (all documents):**

```bash
curl -s http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Request (filtered to a directory):**

```bash
curl -s "http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents?dir=projects" \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "documents": [
    {
      "path": "projects/api-redesign.md",
      "title": "API Redesign",
      "tags": ["project", "engineering"],
      "sizeBytes": 4521,
      "fileModifiedAt": "2025-06-20T14:15:00.000Z"
    },
    {
      "path": "projects/quarterly-review.md",
      "title": "Q2 Quarterly Review",
      "tags": ["review"],
      "sizeBytes": 2103,
      "fileModifiedAt": "2025-06-18T09:00:00.000Z"
    }
  ]
}
```

The `dir` filter matches documents whose path starts with the given prefix followed by `/`. It does not return the directory itself; only documents within it (including nested subdirectories).

---

### 4. Read a Document

Retrieve full document content and metadata by path.

**Request:**

```bash
curl -s http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents/projects/api-redesign.md \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "document": {
    "id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
    "vaultId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "path": "projects/api-redesign.md",
    "title": "API Redesign",
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "sizeBytes": 4521,
    "frontmatter": {
      "title": "API Redesign",
      "tags": ["project", "engineering"],
      "status": "in-progress"
    },
    "tags": ["project", "engineering"],
    "fileCreatedAt": "2025-05-10T08:00:00.000Z",
    "fileModifiedAt": "2025-06-20T14:15:00.000Z",
    "createdAt": "2025-05-10T08:00:00.000Z",
    "updatedAt": "2025-06-20T14:15:00.000Z"
  },
  "content": "---\ntitle: API Redesign\ntags:\n  - project\n  - engineering\nstatus: in-progress\n---\n\n# API Redesign\n\nThis document outlines the plan for redesigning the REST API...\n"
}
```

The `content` field contains the full raw Markdown, including any YAML frontmatter.

---

### 5. Create or Update a Document

PUT is an **upsert** operation. If the document exists, it updates it. If it does not exist, it creates it. The API computes a SHA-256 hash of the content; if the hash matches the existing document, no write occurs and the existing document is returned.

**Request:**

```bash
curl -s -X PUT http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents/notes/meeting-notes.md \
  -H "Authorization: Bearer ds_k_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": "---\ntitle: Meeting Notes\ntags:\n  - meetings\n  - weekly\n---\n\n# Meeting Notes\n\n## 2025-06-20\n\n- Discussed API key scoping\n- Agreed on vault-level permissions\n",
    "createIntermediateFolders": true
  }'
```

**Response (200):**

```json
{
  "document": {
    "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "vaultId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "path": "notes/meeting-notes.md",
    "title": "Meeting Notes",
    "contentHash": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    "sizeBytes": 195,
    "frontmatter": {
      "title": "Meeting Notes",
      "tags": ["meetings", "weekly"]
    },
    "tags": ["meetings", "weekly"],
    "fileCreatedAt": "2025-06-20T16:00:00.000Z",
    "fileModifiedAt": "2025-06-20T16:00:00.000Z",
    "createdAt": "2025-06-20T16:00:00.000Z",
    "updatedAt": "2025-06-20T16:00:00.000Z"
  }
}
```

**Request body fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `content` | string | yes | -- | Full Markdown content (max 10MB) |
| `createIntermediateFolders` | boolean | no | `false` | When `true`, creates parent directories if they do not exist |

Set `createIntermediateFolders: true` when writing to nested paths (e.g., `notes/2025/june/entry.md`) where the parent directories may not yet exist.

---

### 6. Delete a Document

**Request:**

```bash
curl -s -X DELETE http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents/notes/meeting-notes.md \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "message": "Document deleted successfully"
}
```

If the document does not exist, the response is `404 NOT_FOUND`.

---

### 7. Search Documents

Full-text search across all accessible vaults, powered by PostgreSQL `tsvector`. Supports natural query syntax (AND, OR, quoted phrases, negation with `-`).

**Request:**

```bash
curl -s "http://localhost:4000/api/v1/search?q=API%20redesign&limit=5&offset=0" \
  -H "Authorization: Bearer ds_k_abc123..."
```

**With optional filters:**

```bash
curl -s "http://localhost:4000/api/v1/search?q=meeting%20notes&vault=a1b2c3d4-e5f6-7890-abcd-ef1234567890&tags=weekly,meetings&limit=10&offset=0" \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "results": [
    {
      "documentId": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "vaultId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "vaultName": "Personal Notes",
      "path": "projects/api-redesign.md",
      "title": "API Redesign",
      "snippet": "...plan for redesigning the <b>REST</b> <b>API</b>...",
      "tags": ["project", "engineering"],
      "rank": 0.75,
      "fileModifiedAt": "2025-06-20T14:15:00.000Z"
    }
  ],
  "total": 1,
  "query": "API redesign"
}
```

**Query parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | yes | -- | Search query (1-500 chars). Supports PostgreSQL `websearch_to_tsquery` syntax |
| `vault` | UUID | no | -- | Restrict search to a specific vault |
| `tags` | string | no | -- | Comma-separated list of tags to filter by |
| `limit` | integer | no | 20 | Results per page (1-100) |
| `offset` | integer | no | 0 | Number of results to skip (for pagination) |

The `snippet` field contains an HTML fragment with `<b>` tags around matched terms. The `rank` field is a relevance score (higher is more relevant). Results are sorted by rank descending.

If your API key is vault-scoped, search is automatically restricted to that vault regardless of the `vault` parameter.

---

### 8. Create a Vault

**Request:**

```bash
curl -s -X POST http://localhost:4000/api/v1/vaults \
  -H "Authorization: Bearer ds_k_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research",
    "description": "Papers and reading notes"
  }'
```

**Response (201):**

```json
{
  "vault": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "userId": "u1234567-89ab-cdef-0123-456789abcdef",
    "name": "Research",
    "slug": "research",
    "description": "Papers and reading notes",
    "createdAt": "2025-06-20T17:00:00.000Z",
    "updatedAt": "2025-06-20T17:00:00.000Z"
  }
}
```

**Request body fields:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1-100 characters |
| `description` | string | no | max 1000 characters |

Note: If your API key is vault-scoped, you can create a new vault, but you will not be able to access it afterward (your key is scoped to a different vault). Only use this with keys that have access to all vaults.

---

### 9. Check Version History

Every document write (create or update) produces a version record. Versions are returned in reverse chronological order (newest first).

**Request:**

```bash
curl -s http://localhost:4000/api/v1/vaults/a1b2c3d4-e5f6-7890-abcd-ef1234567890/documents/projects/api-redesign.md/versions \
  -H "Authorization: Bearer ds_k_abc123..."
```

**Response (200):**

```json
{
  "versions": [
    {
      "id": "v2a3b4c5-d6e7-8901-2345-678901abcdef",
      "documentId": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "versionNum": 3,
      "contentHash": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
      "sizeBytes": 4521,
      "changeSource": "api",
      "changedBy": "u1234567-89ab-cdef-0123-456789abcdef",
      "createdAt": "2025-06-20T14:15:00.000Z"
    },
    {
      "id": "v1b2c3d4-e5f6-7890-1234-567890abcdef",
      "documentId": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "versionNum": 2,
      "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "sizeBytes": 3200,
      "changeSource": "web",
      "changedBy": "u1234567-89ab-cdef-0123-456789abcdef",
      "createdAt": "2025-06-15T10:00:00.000Z"
    },
    {
      "id": "v0a1b2c3-d4e5-6789-0123-456789abcdef",
      "documentId": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "versionNum": 1,
      "contentHash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      "sizeBytes": 1500,
      "changeSource": "webdav",
      "changedBy": "u1234567-89ab-cdef-0123-456789abcdef",
      "createdAt": "2025-05-10T08:00:00.000Z"
    }
  ]
}
```

The `changeSource` field indicates how the version was created: `"api"` (REST API), `"web"` (browser editor), or `"webdav"` (Obsidian sync).

---

## Markdown Document Format

### Frontmatter

Documents may include YAML frontmatter delimited by `---` at the very beginning of the file:

```markdown
---
title: My Document Title
tags:
  - research
  - important
status: draft
---

# My Document Title

Body content here...
```

The frontmatter is parsed and stored as structured metadata. You can include any arbitrary key-value pairs. The `tags` and `title` keys receive special treatment (see below).

### Title Extraction

The document title is extracted using the following priority:

1. `title` field in frontmatter
2. First `# heading` in the Markdown body
3. Filename (without `.md` extension)

### Tag Extraction

Tags are collected from two sources:

- **Frontmatter:** `tags: [tag1, tag2]` or `tags:\n  - tag1\n  - tag2`
- **Inline hashtags:** `#tagname` in the body text

Tags are normalized to lowercase. Both sources are merged and deduplicated.

### Path Constraints

| Constraint | Rule |
|------------|------|
| Extension | Paths **must** end with `.md` |
| Max length | 512 characters |
| No traversal | `..` segments are forbidden |
| No leading slash | Paths must be relative (e.g., `notes/hello.md`, not `/notes/hello.md`) |
| No backslashes | Use forward slashes only |
| No empty segments | Double slashes (`//`) are forbidden |
| No null bytes | Null characters are rejected |

Valid path examples: `hello.md`, `notes/daily/2025-06-20.md`, `projects/api/design-doc.md`

Invalid path examples: `../secret.md`, `/absolute/path.md`, `notes\\file.md`, `hello.txt`

### Content Limits

- Maximum content size: **10 MB**
- Content is always UTF-8 encoded plain text

---

## Error Handling

### Recovery Strategies by Error Code

| Error Code | HTTP | Cause | Recovery |
|------------|------|-------|----------|
| `VALIDATION_ERROR` | 400 | Malformed request body, invalid path, missing required field, content too large | Check request body against schema. Verify path constraints. Ensure content is under 10MB. |
| `AUTHENTICATION_ERROR` | 401 | API key is missing, malformed, revoked, expired, or invalid | Verify the `Authorization: Bearer ds_k_...` header is present and the key is active. |
| `AUTHORIZATION_ERROR` | 403 | Key lacks required scope (e.g., `write` for PUT) or is vault-scoped and targeting a different vault | Check key scopes. If vault-scoped, only access the authorized vault. |
| `NOT_FOUND` | 404 | Vault ID or document path does not exist | Verify the vault ID exists via GET /vaults. Verify the document path via GET /documents or /tree. |
| `CONFLICT` | 409 | Attempting to create a resource that already exists (e.g., vault with duplicate name) | Use a different name or check for existing resources first. |
| `RATE_LIMIT` | 429 | Exceeded 100 requests per minute | Implement exponential backoff. Wait at least 60 seconds before retrying. |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server failure | Retry after a brief delay. If persistent, the issue is server-side. |

### General Error Handling Advice

- Always check the `statusCode` field in the response to determine the error category.
- The `message` field provides a human-readable explanation that may contain specifics (e.g., which field failed validation).
- For `429` errors, respect the `RateLimit-Remaining` and `RateLimit-Reset` response headers if present.

---

## Tips for LLMs

1. **Always list vaults first.** You need a vault UUID for nearly every operation. Start with `GET /vaults` to discover available vault IDs.

2. **PUT is upsert.** You do not need to check if a document exists before writing. `PUT /vaults/:id/documents/{path}` creates the document if it is new and updates it if it already exists. If the content is identical (same SHA-256 hash), no write occurs.

3. **Preserve existing frontmatter when updating.** Before updating a document, read it first with GET to retrieve the current content. Merge your changes with the existing frontmatter rather than replacing it, unless the user explicitly asks you to replace it.

4. **Use search for discovery.** When you need to find documents by topic, keyword, or tag, use `GET /search?q=...` rather than listing and reading every document. The search endpoint supports natural language queries.

5. **Respect rate limits.** You have 100 requests per minute. For bulk operations, batch your work and add delays between requests. Avoid tight loops of read-modify-write across many documents.

6. **Paths must include the `.md` extension.** When constructing document paths for the API, always include `.md` at the end. For example, use `notes/hello.md`, not `notes/hello`.

7. **Use `createIntermediateFolders: true` for nested paths.** When writing a document to a path like `projects/2025/q2/report.md`, set `createIntermediateFolders: true` in the PUT body to ensure parent directories are created automatically.

8. **Use the tree endpoint for structure, list for metadata.** `GET /tree` gives you the directory hierarchy (names and paths only). `GET /documents` gives you a flat list with metadata (title, tags, size, modification date). Use whichever fits your need.

9. **Search supports PostgreSQL websearch syntax.** You can use:
   - `word1 word2` -- both words must match (implicit AND)
   - `"exact phrase"` -- phrase match
   - `word1 OR word2` -- either word matches
   - `-word` -- exclude documents containing this word

10. **Check your key's scope before attempting writes.** If you only have `read` scope, all write operations (PUT, POST, DELETE, PATCH) will fail with `403`. Plan your workflow accordingly.

11. **Vault IDs are UUIDs.** Always use the `id` field from vault responses (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`), not the `slug` or `name`.

12. **Document paths in the URL are literal.** The path after `/documents/` is the exact file path within the vault. For a document at `daily/2025-06-20.md`, the URL is `/api/v1/vaults/:id/documents/daily/2025-06-20.md`.

13. **Tags filter on search is comma-separated.** Pass multiple tags as `tags=tag1,tag2` in the query string. Documents must match all specified tags.

14. **Pagination for search.** Use `limit` and `offset` query parameters. The `total` field in the response tells you how many results exist in total, so you can compute whether more pages are available: `hasMore = offset + results.length < total`.
