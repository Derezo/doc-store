import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

/**
 * Global error handler for Express 5.
 * Handles known AppError subclasses with structured responses,
 * and falls back to 500 for unknown errors.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // Zod validation errors that slip through
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
    });
    return;
  }

  // Log unexpected errors
  logger.error({ err }, 'Unhandled error');

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: isProd ? 'Internal server error' : err.message,
    statusCode: 500,
  });
}
