import { describe, it, expect } from 'vitest';
import { computeHash } from './document.service.js';

describe('computeHash', () => {
  it('should return SHA-256 hex hash', () => {
    const content = 'test content';
    const hash = computeHash(content);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should be deterministic', () => {
    const content = 'same content';
    const hash1 = computeHash(content);
    const hash2 = computeHash(content);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = computeHash('content 1');
    const hash2 = computeHash('content 2');
    expect(hash1).not.toBe(hash2);
  });
});
