import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers/app.js';
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  isDatabaseAvailable,
  getDb,
} from '../helpers/db.js';
import { createTestUser, getAuthToken } from '../helpers/auth.js';
import { apiKeys } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

let dbAvailable = false;

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

describe.skipIf(!dbAvailable)('POST /api/v1/api-keys', () => {
  it('creates an API key with default scopes', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test API Key',
      });

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toBeDefined();
    expect(res.body.fullKey).toBeDefined();
    expect(res.body.fullKey).toMatch(/^ds_k_[a-z0-9]{40}$/);
    expect(res.body.apiKey.name).toBe('Test API Key');
    expect(res.body.apiKey.keyPrefix).toBeDefined();
    expect(res.body.apiKey.scopes).toContain('read');
    expect(res.body.apiKey.scopes).toContain('write');
  });

  it('creates an API key with custom scopes', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Read-Only Key',
        scopes: ['read'],
      });

    expect(res.status).toBe(201);
    expect(res.body.apiKey.scopes).toEqual(['read']);
  });

  it('creates a vault-scoped API key', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);
    const vault = await createTestVault(user.id, token, 'Scoped Vault');

    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vault-Scoped Key',
        vaultId: vault.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.apiKey.vaultId).toBe(vault.id);
  });

  it('creates an API key with expiration', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Expiring Key',
        expiresAt: expiresAt.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.apiKey.expiresAt).toBeDefined();
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/api-keys', () => {
  it('lists user API keys without secrets', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create multiple keys
    await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Key 1' });

    await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Key 2' });

    const res = await request(app)
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.apiKeys).toBeDefined();
    expect(res.body.apiKeys).toHaveLength(2);
    expect(res.body.apiKeys[0].name).toBeDefined();
    expect(res.body.apiKeys[0].keyPrefix).toBeDefined();

    // Verify that full keys are NOT returned
    expect(res.body.apiKeys[0].fullKey).toBeUndefined();
    expect(res.body.apiKeys[0].keyHash).toBeUndefined();
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/api-keys/:keyId', () => {
  it('gets API key details', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Key' });

    const keyId = createRes.body.apiKey.id;

    const res = await request(app)
      .get(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.apiKey).toBeDefined();
    expect(res.body.apiKey.id).toBe(keyId);
    expect(res.body.apiKey.name).toBe('Test Key');
  });

  it('returns 404 for non-existent key', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .get('/api/v1/api-keys/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe.skipIf(!dbAvailable)('PATCH /api/v1/api-keys/:keyId', () => {
  it('updates API key name', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original Name' });

    const keyId = createRes.body.apiKey.id;

    const res = await request(app)
      .patch(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.apiKey.name).toBe('Updated Name');
  });

  it('deactivates API key', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Active Key' });

    const keyId = createRes.body.apiKey.id;

    const res = await request(app)
      .patch(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.apiKey.isActive).toBe(false);
  });
});

describe.skipIf(!dbAvailable)('DELETE /api/v1/api-keys/:keyId', () => {
  it('deletes an API key', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Key to Delete' });

    const keyId = createRes.body.apiKey.id;

    const res = await request(app)
      .delete(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify key is deleted from DB
    const db = getDb();
    const [deletedKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    expect(deletedKey).toBeUndefined();
  });
});

describe.skipIf(!dbAvailable)('API Key Authentication', () => {
  it('authenticates with valid API key', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create API key
    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Auth Test Key' });

    const fullKey = createRes.body.fullKey;

    // Use API key to list vaults
    const res = await request(app)
      .get('/api/v1/vaults')
      .set('Authorization', `Bearer ${fullKey}`);

    expect(res.status).toBe(200);
  });

  it('enforces read-only scope', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create read-only API key
    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Read-Only Key',
        scopes: ['read'],
      });

    const fullKey = createRes.body.fullKey;

    // Try to create a vault with read-only key (should fail)
    const res = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${fullKey}`)
      .send({ name: 'Test Vault' });

    expect(res.status).toBe(403);
  });

  it('enforces vault scoping', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create two vaults
    const vault1 = await createTestVault(user.id, token, 'Vault 1');
    const vault2 = await createTestVault(user.id, token, 'Vault 2');

    // Create API key scoped to vault1
    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vault 1 Key',
        vaultId: vault1.id,
      });

    const fullKey = createRes.body.fullKey;

    // Try to access vault1 (should succeed)
    const res1 = await request(app)
      .get(`/api/v1/vaults/${vault1.id}`)
      .set('Authorization', `Bearer ${fullKey}`);

    expect(res1.status).toBe(200);

    // Try to access vault2 (should fail)
    const res2 = await request(app)
      .get(`/api/v1/vaults/${vault2.id}`)
      .set('Authorization', `Bearer ${fullKey}`);

    expect(res2.status).toBe(403);
  });
});
