import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from './error-handler.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from '../utils/errors.js';

describe('errorHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should handle AppError with correct status code', () => {
    const error = new ValidationError('Invalid input');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input',
      statusCode: 400,
    });
  });

  it('should handle AuthenticationError', () => {
    const error = new AuthenticationError('Token expired');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'AUTHENTICATION_ERROR',
      message: 'Token expired',
      statusCode: 401,
    });
  });

  it('should handle NotFoundError', () => {
    const error = new NotFoundError('Resource not found');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
    });
  });

  it('should handle ZodError', () => {
    const error = new Error('Validation error');
    error.name = 'ZodError';
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
    });
  });

  it('should handle unknown error in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Something went wrong');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      statusCode: 500,
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should expose error message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Detailed error message');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Detailed error message',
      statusCode: 500,
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle custom AppError subclass', () => {
    class CustomError extends AppError {
      constructor() {
        super('Custom error', 418, 'CUSTOM_ERROR');
      }
    }

    const error = new CustomError();
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(418);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'CUSTOM_ERROR',
      message: 'Custom error',
      statusCode: 418,
    });
  });
});
