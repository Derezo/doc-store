import { describe, it, expect } from 'vitest';
import { generateAlphanumeric } from './api-key.service.js';

describe('generateAlphanumeric', () => {
  it('should return string of correct length', () => {
    const result = generateAlphanumeric(20);
    expect(result.length).toBe(20);
  });

  it('should contain only lowercase letters and digits', () => {
    const result = generateAlphanumeric(100);
    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it('should generate unique values', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generateAlphanumeric(40));
    }
    // All should be unique
    expect(results.size).toBe(100);
  });
});
