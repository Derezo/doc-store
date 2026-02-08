import { describe, it, expect } from 'vitest';
import { parseBasicAuth } from './authenticator.js';
import { AuthenticationError } from '../utils/errors.js';

describe('parseBasicAuth', () => {
  it('should parse valid Basic auth header', () => {
    const email = 'test@example.com';
    const apiKey = 'ds_k_abc123';
    const encoded = Buffer.from(`${email}:${apiKey}`).toString('base64');
    const authHeader = `Basic ${encoded}`;

    const result = parseBasicAuth(authHeader);

    expect(result.email).toBe(email);
    expect(result.apiKey).toBe(apiKey);
  });

  it('should throw error for non-Basic scheme', () => {
    expect(() => parseBasicAuth('Bearer token123')).toThrow(AuthenticationError);
    expect(() => parseBasicAuth('Bearer token123')).toThrow('Basic authentication');
  });

  it('should throw error for invalid base64', () => {
    // Note: Node's Buffer.from() is lenient and won't throw for most invalid base64
    // It will decode what it can, which may result in a string without a colon
    // So this will actually throw "Invalid Basic auth format" instead of "encoding"
    expect(() => parseBasicAuth('Basic !!!invalid!!!')).toThrow(AuthenticationError);
    expect(() => parseBasicAuth('Basic !!!invalid!!!')).toThrow('Invalid Basic auth format');
  });

  it('should throw error for missing colon separator', () => {
    const encoded = Buffer.from('emailwithoutcolon').toString('base64');
    const authHeader = `Basic ${encoded}`;

    expect(() => parseBasicAuth(authHeader)).toThrow(AuthenticationError);
    expect(() => parseBasicAuth(authHeader)).toThrow('Invalid Basic auth format');
  });

  it('should throw error for empty email', () => {
    const encoded = Buffer.from(':apikey123').toString('base64');
    const authHeader = `Basic ${encoded}`;

    expect(() => parseBasicAuth(authHeader)).toThrow(AuthenticationError);
    expect(() => parseBasicAuth(authHeader)).toThrow('Email and API key are required');
  });

  it('should throw error for empty API key', () => {
    const encoded = Buffer.from('test@example.com:').toString('base64');
    const authHeader = `Basic ${encoded}`;

    expect(() => parseBasicAuth(authHeader)).toThrow(AuthenticationError);
    expect(() => parseBasicAuth(authHeader)).toThrow('Email and API key are required');
  });
});
