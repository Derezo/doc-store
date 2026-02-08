import { describe, it, expect } from 'vitest';
import { slugify } from './vault.service.js';

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('MyVault')).toBe('myvault');
    expect(slugify('UPPERCASE')).toBe('uppercase');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('My Vault Name')).toBe('my-vault-name');
    expect(slugify('multiple   spaces')).toBe('multiple-spaces');
  });

  it('should remove special characters', () => {
    expect(slugify('vault@#$%name')).toBe('vaultname');
    expect(slugify('test!vault?')).toBe('testvault');
  });

  it('should deduplicate hyphens', () => {
    expect(slugify('vault---name')).toBe('vault-name');
    expect(slugify('test--vault')).toBe('test-vault');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(slugify('-vault-')).toBe('vault');
    expect(slugify('--test--')).toBe('test');
  });

  it('should handle alphanumeric with hyphens', () => {
    expect(slugify('vault-123')).toBe('vault-123');
    expect(slugify('my-vault-2024')).toBe('my-vault-2024');
  });

  it('should trim whitespace before processing', () => {
    expect(slugify('  vault  ')).toBe('vault');
    expect(slugify('  My Vault  ')).toBe('my-vault');
  });

  it('should handle empty result from special chars', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
  });
});
