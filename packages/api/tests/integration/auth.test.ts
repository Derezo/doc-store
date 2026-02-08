import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../helpers/app.js';
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  isDatabaseAvailable,
} from '../helpers/db.js';
import {
  createTestUser,
  createTestAdmin,
  createInvitation,
  getAuthToken,
} from '../helpers/auth.js';

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

describe.skipIf(!dbAvailable)('POST /api/v1/auth/register', () => {
  it('registers a new user with valid invitation', async () => {
    const admin = await createTestAdmin();
    const invitation = await createInvitation('newuser@example.com', admin.id);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        displayName: 'New User',
        inviteToken: invitation.token,
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.displayName).toBe('New User');
    expect(res.body.user.role).toBe('user');
    expect(res.body.accessToken).toBeDefined();

    // Check that refresh cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('doc_store_refresh='))).toBe(true);
  });

  it('rejects registration with invalid invitation token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        displayName: 'Test User',
        inviteToken: 'invalid-token-12345',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('rejects registration with expired invitation', async () => {
    const admin = await createTestAdmin();
    const invitation = await createInvitation('expired@example.com', admin.id);

    // Manually expire the invitation by updating it
    const { getDb } = await import('../helpers/db.js');
    const db = getDb();
    const { invitations } = await import('../../src/db/schema.js');
    const { eq } = await import('drizzle-orm');

    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(invitations.id, invitation.id));

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'expired@example.com',
        password: 'SecurePassword123!',
        displayName: 'Expired User',
        inviteToken: invitation.token,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('expired');
  });

  it('rejects registration when email already exists', async () => {
    const admin = await createTestAdmin();
    await createTestUser({ email: 'existing@example.com' });
    const invitation = await createInvitation('existing@example.com', admin.id);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        displayName: 'Duplicate User',
        inviteToken: invitation.token,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already exists');
  });

  it('rejects registration when email does not match invitation', async () => {
    const admin = await createTestAdmin();
    const invitation = await createInvitation('invited@example.com', admin.id);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'different@example.com',
        password: 'SecurePassword123!',
        displayName: 'Wrong Email',
        inviteToken: invitation.token,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('does not match');
  });
});

describe.skipIf(!dbAvailable)('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const user = await createTestUser({
      email: 'login@example.com',
      password: 'MyPassword123!',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login@example.com',
        password: 'MyPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('login@example.com');
    expect(res.body.accessToken).toBeDefined();

    // Check that refresh cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('doc_store_refresh='))).toBe(true);
  });

  it('rejects login with wrong password', async () => {
    await createTestUser({
      email: 'test@example.com',
      password: 'CorrectPassword123!',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid email or password');
  });

  it('rejects login with nonexistent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid email or password');
  });

  it('rejects login for inactive user', async () => {
    await createTestUser({
      email: 'inactive@example.com',
      password: 'Password123!',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'inactive@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('disabled');
  });
});

describe.skipIf(!dbAvailable)('POST /api/v1/auth/refresh', () => {
  it('refreshes token with valid refresh cookie', async () => {
    const user = await createTestUser();

    // First, login to get a refresh token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.rawPassword,
      });

    const cookies = loginRes.headers['set-cookie'];
    const refreshCookie = cookies.find((c: string) => c.startsWith('doc_store_refresh='));

    expect(refreshCookie).toBeDefined();

    // Now use that refresh token to get a new access token
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.accessToken).not.toBe(loginRes.body.accessToken); // New token

    // Check that a new refresh cookie is set
    const newCookies = res.headers['set-cookie'];
    expect(newCookies).toBeDefined();
    expect(newCookies.some((c: string) => c.startsWith('doc_store_refresh='))).toBe(true);
  });

  it('rejects refresh without X-Requested-With header (CSRF protection)', async () => {
    const user = await createTestUser();

    // Login first
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.rawPassword,
      });

    const cookies = loginRes.headers['set-cookie'];
    const refreshCookie = cookies.find((c: string) => c.startsWith('doc_store_refresh='));

    // Try to refresh without the CSRF header
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_ERROR');
  });

  it('rejects refresh without refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('No refresh token');
  });
});

describe.skipIf(!dbAvailable)('POST /api/v1/auth/logout', () => {
  it('logs out and clears refresh cookie', async () => {
    const user = await createTestUser();
    const token = await getAuthToken(user.id, user.email, user.role);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Logged out');

    // Check that refresh cookie is cleared
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const clearedCookie = cookies.find((c: string) => c.startsWith('doc_store_refresh='));
    expect(clearedCookie).toContain('Max-Age=0'); // Cookie cleared
  });
});
