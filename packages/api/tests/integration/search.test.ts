import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers/app.js';
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  isDatabaseAvailable,
} from '../helpers/db.js';
import { createTestUser, getAuthToken } from '../helpers/auth.js';

let dbAvailable = false;
const DATA_DIR = process.env.DATA_DIR || '/tmp/doc-store-test-data';

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (dbAvailable) {
    await setupTestDb();
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await teardownTestDb();
  }
});

afterEach(async () => {
  if (dbAvailable) {
    await cleanupTestDb();
  }
});

async function createTestVault(userId: string, token: string, name: string = 'Test Vault') {
  const res = await request(app)
    .post('/api/v1/vaults')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });

  return res.body.vault;
}

async function createTestDocument(
  vaultId: string,
  token: string,
  path: string,
  content: string
) {
  await request(app)
    .put(`/api/v1/vaults/${vaultId}/documents/${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content });
}

describe.skipIf(!dbAvailable)('GET /api/v1/search', () => {
  it('searches documents with matching query', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token, 'Search Vault');

    // Create documents with searchable content
    await createTestDocument(
      vault.id,
      token,
      'javascript-guide.md',
      '# JavaScript Guide\n\nThis is a comprehensive guide to JavaScript programming.'
    );

    await createTestDocument(
      vault.id,
      token,
      'python-tutorial.md',
      '# Python Tutorial\n\nLearn Python programming from scratch.'
    );

    // Search for "JavaScript"
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'JavaScript' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);

    const jsDoc = res.body.results.find((r: any) => r.path === 'javascript-guide.md');
    expect(jsDoc).toBeDefined();
    expect(jsDoc.snippet).toBeDefined();
  });

  it('filters search results by vault', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create two vaults with similar documents
    const vault1 = await createTestVault(user.id, token, 'Vault 1');
    const vault2 = await createTestVault(user.id, token, 'Vault 2');

    await createTestDocument(
      vault1.id,
      token,
      'doc.md',
      '# Document in Vault 1\n\nThis mentions TypeScript.'
    );

    await createTestDocument(
      vault2.id,
      token,
      'doc.md',
      '# Document in Vault 2\n\nThis also mentions TypeScript.'
    );

    // Search only in vault1
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'TypeScript', vault: vault1.id })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();

    // All results should be from vault1
    res.body.results.forEach((result: any) => {
      expect(result.vaultId).toBe(vault1.id);
    });
  });

  it('returns empty results for no matches', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token, 'Empty Search Vault');

    await createTestDocument(
      vault.id,
      token,
      'doc.md',
      '# Simple Document\n\nNo special keywords here.'
    );

    // Search for something that doesn't exist
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'xyznonexistentkeyword123' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(res.body.results).toHaveLength(0);
  });

  it('supports pagination with limit and offset', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token, 'Pagination Vault');

    // Create multiple documents with the same keyword
    for (let i = 1; i <= 5; i++) {
      await createTestDocument(
        vault.id,
        token,
        `doc${i}.md`,
        `# Document ${i}\n\nThis document contains the keyword programming.`
      );
    }

    // Get first page (limit 2)
    const res1 = await request(app)
      .get('/api/v1/search')
      .query({ q: 'programming', limit: 2, offset: 0 })
      .set('Authorization', `Bearer ${token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.results.length).toBeLessThanOrEqual(2);
    expect(res1.body.total).toBeGreaterThanOrEqual(5);
    expect(res1.body.limit).toBe(2);
    expect(res1.body.offset).toBe(0);

    // Get second page (limit 2, offset 2)
    const res2 = await request(app)
      .get('/api/v1/search')
      .query({ q: 'programming', limit: 2, offset: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.results.length).toBeLessThanOrEqual(2);
    expect(res2.body.offset).toBe(2);

    // Results should be different
    if (res1.body.results.length > 0 && res2.body.results.length > 0) {
      expect(res1.body.results[0].id).not.toBe(res2.body.results[0].id);
    }
  });

  it('rejects search without query parameter', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it('handles special characters in search query', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token, 'Special Chars Vault');

    await createTestDocument(
      vault.id,
      token,
      'nodejs.md',
      '# Node.js Guide\n\nLearn about Node.js and its features.'
    );

    // Search with special characters (dot in Node.js)
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Node.js' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
  });
});
