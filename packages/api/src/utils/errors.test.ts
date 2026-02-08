import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from './errors.js';

describe('AppError', () => {
  it('should create an error with message, statusCode, and code', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('AppError');
  });

  it('should be instanceof Error', () => {
    const error = new AppError('Test', 500, 'TEST');
    expect(error).toBeInstanceOf(Error);
  });

  it('should be instanceof AppError', () => {
    const error = new AppError('Test', 500, 'TEST');
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('should have statusCode 400', () => {
    const error = new ValidationError();
    expect(error.statusCode).toBe(400);
  });

  it('should have code VALIDATION_ERROR', () => {
    const error = new ValidationError();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should have default message', () => {
    const error = new ValidationError();
    expect(error.message).toBe('Validation failed');
  });

  it('should accept custom message', () => {
    const error = new ValidationError('Custom validation error');
    expect(error.message).toBe('Custom validation error');
  });

  it('should be instanceof AppError', () => {
    const error = new ValidationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('AuthenticationError', () => {
  it('should have statusCode 401', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
  });

  it('should have code AUTHENTICATION_ERROR', () => {
    const error = new AuthenticationError();
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('should have default message', () => {
    const error = new AuthenticationError();
    expect(error.message).toBe('Authentication required');
  });

  it('should accept custom message', () => {
    const error = new AuthenticationError('Invalid token');
    expect(error.message).toBe('Invalid token');
  });

  it('should be instanceof AppError', () => {
    const error = new AuthenticationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('AuthorizationError', () => {
  it('should have statusCode 403', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
  });

  it('should have code AUTHORIZATION_ERROR', () => {
    const error = new AuthorizationError();
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('should have default message', () => {
    const error = new AuthorizationError();
    expect(error.message).toBe('Insufficient permissions');
  });

  it('should accept custom message', () => {
    const error = new AuthorizationError('Admin only');
    expect(error.message).toBe('Admin only');
  });

  it('should be instanceof AppError', () => {
    const error = new AuthorizationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('NotFoundError', () => {
  it('should have statusCode 404', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
  });

  it('should have code NOT_FOUND', () => {
    const error = new NotFoundError();
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should have default message', () => {
    const error = new NotFoundError();
    expect(error.message).toBe('Resource not found');
  });

  it('should accept custom message', () => {
    const error = new NotFoundError('User not found');
    expect(error.message).toBe('User not found');
  });

  it('should be instanceof AppError', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ConflictError', () => {
  it('should have statusCode 409', () => {
    const error = new ConflictError();
    expect(error.statusCode).toBe(409);
  });

  it('should have code CONFLICT', () => {
    const error = new ConflictError();
    expect(error.code).toBe('CONFLICT');
  });

  it('should have default message', () => {
    const error = new ConflictError();
    expect(error.message).toBe('Resource already exists');
  });

  it('should accept custom message', () => {
    const error = new ConflictError('Email already taken');
    expect(error.message).toBe('Email already taken');
  });

  it('should be instanceof AppError', () => {
    const error = new ConflictError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('RateLimitError', () => {
  it('should have statusCode 429', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
  });

  it('should have code RATE_LIMIT', () => {
    const error = new RateLimitError();
    expect(error.code).toBe('RATE_LIMIT');
  });

  it('should have default message', () => {
    const error = new RateLimitError();
    expect(error.message).toBe('Too many requests');
  });

  it('should accept custom message', () => {
    const error = new RateLimitError('Rate limit exceeded');
    expect(error.message).toBe('Rate limit exceeded');
  });

  it('should be instanceof AppError', () => {
    const error = new RateLimitError();
    expect(error).toBeInstanceOf(AppError);
  });
});
