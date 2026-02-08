import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from '../helpers/app.js';
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  isDatabaseAvailable,
  getDb,
} from '../helpers/db.js';
import { createTestUser, getAuthToken } from '../helpers/auth.js';
import { documents } from '../../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

let dbAvailable = false;
const DATA_DIR = process.env.DATA_DIR || '/tmp/doc-store-test-data';

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (dbAvailable) {
    await setupTestDb();
    // Ensure test data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await teardownTestDb();
    // Clean up test data directory
    await fs.rm(DATA_DIR, { recursive: true, force: true });
  }
});

afterEach(async () => {
  if (dbAvailable) {
    await cleanupTestDb();
    // Clean up test files
    await fs.rm(DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
});

async function createTestVault(userId: string, token: string, name: string = 'Test Vault') {
  const res = await request(app)
    .post('/api/v1/vaults')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });

  return res.body.vault;
}

describe.skipIf(!dbAvailable)('PUT /api/v1/vaults/:vaultId/documents/*path', () => {
  it('creates a new document', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Hello World\n\nThis is a test document.';

    const res = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/test.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(res.status).toBe(200);
    expect(res.body.document).toBeDefined();
    expect(res.body.document.path).toBe('test.md');
    expect(res.body.document.title).toBe('Hello World');
    expect(res.body.document.contentHash).toBeDefined();
  });

  it('creates nested documents with intermediate directories', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Nested Document';

    const res = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/folder/subfolder/nested.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(res.status).toBe(200);
    expect(res.body.document.path).toBe('folder/subfolder/nested.md');

    // Verify file exists on filesystem
    const filePath = path.join(DATA_DIR, user.id, vault.slug, 'folder/subfolder/nested.md');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('rejects path traversal attempts', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Malicious Document';

    const res = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/../../../etc/passwd.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('path');
  });

  it('updates document when content changes', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const originalContent = '# Original Content';

    // Create document
    const createRes = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/update-test.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: originalContent });

    const originalHash = createRes.body.document.contentHash;

    // Update document
    const updatedContent = '# Updated Content\n\nNew paragraph.';

    const updateRes = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/update-test.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: updatedContent });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.document.contentHash).not.toBe(originalHash);
    expect(updateRes.body.document.title).toBe('Updated Content');
  });

  it('no-ops when content hash is unchanged', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Same Content';

    // Create document
    const createRes = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/same.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    const createdAt = createRes.body.document.createdAt;

    // Wait a bit to ensure timestamp would differ
    await new Promise(resolve => setTimeout(resolve, 10));

    // Put same content again
    const updateRes = await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/same.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.document.createdAt).toBe(createdAt);
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults/:vaultId/documents/*path', () => {
  it('retrieves document content and metadata', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Test Document\n\nContent here.';

    // Create document
    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/retrieve.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    // Retrieve document
    const res = await request(app)
      .get(`/api/v1/vaults/${vault.id}/documents/retrieve.md`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.document).toBeDefined();
    expect(res.body.content).toBe(content);
    expect(res.body.document.path).toBe('retrieve.md');
    expect(res.body.document.title).toBe('Test Document');
  });

  it('returns 404 for non-existent document', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const res = await request(app)
      .get(`/api/v1/vaults/${vault.id}/documents/nonexistent.md`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe.skipIf(!dbAvailable)('DELETE /api/v1/vaults/:vaultId/documents/*path', () => {
  it('deletes a document', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    const content = '# Document to Delete';

    // Create document
    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/delete-me.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    // Delete document
    const res = await request(app)
      .delete(`/api/v1/vaults/${vault.id}/documents/delete-me.md`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify document is deleted from DB
    const db = getDb();
    const [doc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.vaultId, vault.id),
          eq(documents.path, 'delete-me.md')
        )
      );

    expect(doc).toBeUndefined();

    // Verify file is deleted from filesystem
    const filePath = path.join(DATA_DIR, user.id, vault.slug, 'delete-me.md');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(false);
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults/:vaultId/documents', () => {
  it('lists documents in vault', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    // Create multiple documents
    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/doc1.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Doc 1' });

    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/doc2.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Doc 2' });

    const res = await request(app)
      .get(`/api/v1/vaults/${vault.id}/documents`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toBeDefined();
    expect(res.body.documents.length).toBeGreaterThanOrEqual(2);
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults/:vaultId/documents/*path/versions', () => {
  it('lists document versions', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token);

    // Create document
    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/versioned.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Version 1' });

    // Update to create a new version
    await request(app)
      .put(`/api/v1/vaults/${vault.id}/documents/versioned.md`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Version 2' });

    const res = await request(app)
      .get(`/api/v1/vaults/${vault.id}/documents/versioned.md/versions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.versions).toBeDefined();
    expect(Array.isArray(res.body.versions)).toBe(true);
    expect(res.body.versions.length).toBeGreaterThanOrEqual(1);
  });
});
