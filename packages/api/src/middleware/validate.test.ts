import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validate } from './validate.js';

describe('validate', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should call next() with valid body', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    mockReq.body = { name: 'John', age: 30 };
    const middleware = validate(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should replace req.body with parsed data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      extra: z.string().optional(),
    });

    mockReq.body = { name: 'John', age: 30, unwanted: 'field' };
    const middleware = validate(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockReq.body).toEqual({ name: 'John', age: 30 });
    expect(mockReq.body.unwanted).toBeUndefined();
  });

  it('should respond with 400 for invalid body', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    mockReq.body = { name: 'John', age: 'not a number' };
    const middleware = validate(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should include validation error details', () => {
    const schema = z.object({
      email: z.string().email(),
    });

    mockReq.body = { email: 'invalid-email' };
    const middleware = validate(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    const jsonCall = mockRes.json.mock.calls[0][0];
    expect(jsonCall.error).toBe('Validation failed');
    expect(jsonCall.details).toBeDefined();
  });

  it('should handle missing required fields', () => {
    const schema = z.object({
      requiredField: z.string(),
    });

    mockReq.body = {};
    const middleware = validate(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
