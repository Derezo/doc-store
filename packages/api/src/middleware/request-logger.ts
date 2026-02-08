import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

/**
 * Simple request logging middleware.
 * Logs method, url, status code, and duration for each request.
 * Skips health checks in production to reduce noise.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Skip health checks in production
    if (
      config.NODE_ENV === 'production' &&
      originalUrl.endsWith('/health')
    ) {
      return;
    }

    const logData = {
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    if (statusCode >= 500) {
      logger.error(logData, 'request completed');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'request completed');
    } else {
      logger.info(logData, 'request completed');
    }
  });

  next();
}
