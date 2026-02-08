import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
} from './crypto.js';

describe('hashPassword', () => {
  it('should return a hash string', async () => {
    const hash = await hashPassword('mypassword');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should use argon2 format', async () => {
    const hash = await hashPassword('test123');
    // Argon2 hashes start with $argon2
    expect(hash).toMatch(/^\$argon2/);
  });
});

describe('verifyPassword', () => {
  it('should verify correct password', async () => {
    const password = 'mySecurePassword123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'correctPassword';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(hash, 'wrongPassword');
    expect(isValid).toBe(false);
  });

  it('should handle case-sensitive passwords', async () => {
    const password = 'Password';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(hash, 'password');
    expect(isValid).toBe(false);
  });
});

describe('generateToken', () => {
  it('should return hex string of correct length', () => {
    const token = generateToken(32);
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate different tokens', () => {
    const token1 = generateToken(32);
    const token2 = generateToken(32);
    expect(token1).not.toBe(token2);
  });

  it('should support custom byte length', () => {
    const token = generateToken(16);
    expect(token.length).toBe(32); // 16 bytes = 32 hex chars
  });
});

describe('hashToken', () => {
  it('should return SHA-256 hex hash', () => {
    const token = 'mytoken123';
    const hash = hashToken(token);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256 = 64 hex chars
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should be deterministic', () => {
    const token = 'testtoken';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashToken('input1');
    const hash2 = hashToken('input2');
    expect(hash1).not.toBe(hash2);
  });
});
