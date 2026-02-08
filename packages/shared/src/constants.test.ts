import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  API_VERSION,
  API_PREFIX,
  DEFAULT_PORT,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_VAULT_NAME_LENGTH,
  MAX_DOCUMENT_PATH_LENGTH,
} from './constants.js';

describe('constants', () => {
  it('should have correct APP_NAME', () => {
    expect(APP_NAME).toBe('doc-store');
  });

  it('should have correct API_VERSION', () => {
    expect(API_VERSION).toBe('v1');
  });

  it('should have correct API_PREFIX', () => {
    expect(API_PREFIX).toBe('/api/v1');
  });

  it('should have correct DEFAULT_PORT', () => {
    expect(DEFAULT_PORT).toBe(4000);
  });

  it('should have correct MAX_DOCUMENT_SIZE_BYTES (10MB)', () => {
    expect(MAX_DOCUMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_DOCUMENT_SIZE_BYTES).toBe(10485760);
  });

  it('should have correct MAX_VAULT_NAME_LENGTH', () => {
    expect(MAX_VAULT_NAME_LENGTH).toBe(128);
  });

  it('should have correct MAX_DOCUMENT_PATH_LENGTH', () => {
    expect(MAX_DOCUMENT_PATH_LENGTH).toBe(512);
  });
});
