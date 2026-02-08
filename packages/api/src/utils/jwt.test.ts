import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt.js';

describe('signAccessToken', () => {
  it('should return a JWT format string', async () => {
    const token = await signAccessToken({
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    });
    expect(typeof token).toBe('string');
    // JWT format: header.payload.signature (3 parts separated by dots)
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });

  it('should include email and role in claims', async () => {
    const token = await signAccessToken({
      userId: 'user123',
      email: 'test@example.com',
      role: 'admin',
    });
    const payload = await verifyAccessToken(token);
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('admin');
  });
});

describe('verifyAccessToken', () => {
  it('should decode valid token with correct claims', async () => {
    const token = await signAccessToken({
      userId: 'user456',
      email: 'user@example.com',
      role: 'user',
    });
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('user456');
    expect(payload.email).toBe('user@example.com');
    expect(payload.role).toBe('user');
  });

  it('should include standard JWT claims', async () => {
    const token = await signAccessToken({
      userId: 'user789',
      email: 'test@example.com',
      role: 'user',
    });
    const payload = await verifyAccessToken(token);
    expect(payload.iss).toBe('doc-store');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('should reject token with wrong secret', async () => {
    const token = await signAccessToken({
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    });

    // Tamper with the signature part more significantly
    // JWT has 3 parts: header.payload.signature
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, -10) + 'XXXXXXXXXX'; // Change more characters
    const tamperedToken = parts.join('.');

    await expect(verifyAccessToken(tamperedToken)).rejects.toThrow();
  });

  it('should reject malformed token', async () => {
    await expect(verifyAccessToken('not.a.valid.jwt')).rejects.toThrow();
  });

  it('should reject expired token', async () => {
    // Note: Mocking Date.now doesn't affect jose's internal time handling
    // Instead, we'll use vi.useFakeTimers to control time
    vi.useFakeTimers();

    const token = await signAccessToken({
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    });

    // Advance time by 20 minutes (token expires in 15 minutes)
    vi.advanceTimersByTime(20 * 60 * 1000);

    // Token should be expired
    await expect(verifyAccessToken(token)).rejects.toThrow();

    vi.useRealTimers();
  });
});
