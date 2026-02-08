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
import { vaults } from '../../src/db/schema.js';
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

describe.skipIf(!dbAvailable)('POST /api/v1/vaults', () => {
  it('creates a vault with valid data', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'My First Vault',
        description: 'Test vault description',
      });

    expect(res.status).toBe(201);
    expect(res.body.vault).toBeDefined();
    expect(res.body.vault.name).toBe('My First Vault');
    expect(res.body.vault.slug).toBeDefined();
    expect(res.body.vault.description).toBe('Test vault description');
  });

  it('generates unique slugs for duplicate names', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create first vault
    const res1 = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Vault' });

    expect(res1.status).toBe(201);
    const slug1 = res1.body.vault.slug;

    // Create second vault with same name
    const res2 = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Vault' });

    expect(res2.status).toBe(201);
    const slug2 = res2.body.vault.slug;

    expect(slug1).not.toBe(slug2);
    expect(slug2).toMatch(/^test-vault-\d+$/);
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults', () => {
  it('lists user vaults', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    // Create multiple vaults
    await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vault 1' });

    await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vault 2' });

    const res = await request(app)
      .get('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.vaults).toBeDefined();
    expect(res.body.vaults).toHaveLength(2);
    expect(res.body.vaults[0].name).toBeDefined();
  });

  it('enforces cross-user isolation', async () => {
    const user1 = await createTestUser({ email: 'user1@example.com' });
    const user2 = await createTestUser({ email: 'user2@example.com' });
    const token1 = await getAuthToken(user1.id, user1.email, user1.role);
    const token2 = await getAuthToken(user2.id, user2.email, user2.role);

    // User1 creates a vault
    await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'User1 Vault' });

    // User2 creates a vault
    await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'User2 Vault' });

    // User1 should only see their vault
    const res1 = await request(app)
      .get('/api/v1/vaults')
      .set('Authorization', `Bearer ${token1}`);

    expect(res1.body.vaults).toHaveLength(1);
    expect(res1.body.vaults[0].name).toBe('User1 Vault');

    // User2 should only see their vault
    const res2 = await request(app)
      .get('/api/v1/vaults')
      .set('Authorization', `Bearer ${token2}`);

    expect(res2.body.vaults).toHaveLength(1);
    expect(res2.body.vaults[0].name).toBe('User2 Vault');
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults/:vaultId', () => {
  it('gets vault details by ID', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Vault', description: 'Test description' });

    const vaultId = createRes.body.vault.id;

    const res = await request(app)
      .get(`/api/v1/vaults/${vaultId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.vault).toBeDefined();
    expect(res.body.vault.id).toBe(vaultId);
    expect(res.body.vault.name).toBe('Test Vault');
  });

  it('returns 404 for non-existent vault', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .get('/api/v1/vaults/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('prevents access to other users vaults', async () => {
    const user1 = await createTestUser({ email: 'user1@example.com' });
    const user2 = await createTestUser({ email: 'user2@example.com' });
    const token1 = await getAuthToken(user1.id, user1.email, user1.role);
    const token2 = await getAuthToken(user2.id, user2.email, user2.role);

    // User1 creates a vault
    const createRes = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Private Vault' });

    const vaultId = createRes.body.vault.id;

    // User2 tries to access user1's vault
    const res = await request(app)
      .get(`/api/v1/vaults/${vaultId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });
});

describe.skipIf(!dbAvailable)('PATCH /api/v1/vaults/:vaultId', () => {
  it('updates vault name and description', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original Name' });

    const vaultId = createRes.body.vault.id;

    const res = await request(app)
      .patch(`/api/v1/vaults/${vaultId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
        description: 'Updated description',
      });

    expect(res.status).toBe(200);
    expect(res.body.vault.name).toBe('Updated Name');
    expect(res.body.vault.description).toBe('Updated description');
  });
});

describe.skipIf(!dbAvailable)('DELETE /api/v1/vaults/:vaultId', () => {
  it('deletes a vault', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vault to Delete' });

    const vaultId = createRes.body.vault.id;

    const res = await request(app)
      .delete(`/api/v1/vaults/${vaultId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify vault is deleted
    const db = getDb();
    const [deletedVault] = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));

    expect(deletedVault).toBeUndefined();
  });
});

describe.skipIf(!dbAvailable)('GET /api/v1/vaults/:vaultId/tree', () => {
  it('returns vault tree structure', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const createRes = await request(app)
      .post('/api/v1/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tree Vault' });

    const vaultId = createRes.body.vault.id;

    const res = await request(app)
      .get(`/api/v1/vaults/${vaultId}/tree`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    expect(Array.isArray(res.body.tree)).toBe(true);
  });
});
