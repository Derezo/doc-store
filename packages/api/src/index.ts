import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { API_PREFIX } from '@doc-store/shared';
import type { HealthCheckResponse } from '@doc-store/shared';
import { errorHandler } from './middleware/error-handler.js';
import { securityHeaders } from './middleware/security-headers.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiLimiter, authLimiter, webdavLimiter } from './middleware/rate-limit.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import vaultRoutes from './routes/vaults.routes.js';
import documentRoutes from './routes/documents.routes.js';
import apiKeyRoutes from './routes/api-keys.routes.js';
import searchRoutes from './routes/search.routes.js';
import webdavRouter from './webdav/index.js';
import * as syncService from './services/sync.service.js';
import { pool } from './db/index.js';

const app = express();

// ── Global middleware ────────────────────────────────────────────────
app.use(securityHeaders);
app.use(requestLogger);

// ── WebDAV routes (mounted BEFORE express.json() to allow raw body streaming) ──
// WebDAV PUT requests send raw file content that should not be parsed as JSON.
app.use('/webdav', webdavLimiter, webdavRouter);

app.use(express.json());
app.use(cookieParser());

// ── Rate limiting ────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// Health check
app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
  const body: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

// Auth routes (with stricter rate limiting on login/register)
app.use(`${API_PREFIX}/auth/login`, authLimiter);
app.use(`${API_PREFIX}/auth/register`, authLimiter);
app.use(`${API_PREFIX}/auth`, authRoutes);

// User routes
app.use(`${API_PREFIX}/users`, userRoutes);

// Vault routes (includes tree endpoint)
app.use(`${API_PREFIX}/vaults`, vaultRoutes);

// Document routes (nested under vaults)
app.use(`${API_PREFIX}/vaults/:vaultId/documents`, documentRoutes);

// API key routes
app.use(`${API_PREFIX}/api-keys`, apiKeyRoutes);

// Search routes
app.use(`${API_PREFIX}/search`, searchRoutes);

// Global error handler (must be registered last)
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  logger.info(`Server listening on port ${config.PORT}`);
  logger.info(`Health check: http://localhost:${config.PORT}${API_PREFIX}/health`);
  logger.info(`WebDAV endpoint: http://localhost:${config.PORT}/webdav/:vaultSlug/`);

  // Start filesystem watcher
  syncService.start();

  // Run initial reconciliation (async, don't block startup)
  syncService.reconcile().catch((err) => {
    logger.error({ err }, 'Initial reconciliation failed');
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────

function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');

  syncService.stop().then(() => {
    server.close(() => {
      // Close the database connection pool
      pool.end().then(() => {
        logger.info('Database pool closed');
        logger.info('Server shut down gracefully');
        process.exit(0);
      }).catch((err) => {
        logger.error({ err }, 'Error closing database pool');
        process.exit(1);
      });
    });

    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }).catch((err) => {
    logger.error({ err }, 'Error during sync service shutdown');
    process.exit(1);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
