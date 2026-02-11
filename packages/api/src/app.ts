import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { API_PREFIX } from '@doc-store/shared';
import type { HealthCheckResponse } from '@doc-store/shared';
import { config } from './config.js';
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
import swaggerRouter from './openapi/index.js';

const app = express();

// Trust first proxy (Nginx) so X-Forwarded-For works for rate limiting and logging
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Global middleware ────────────────────────────────────────────────
app.use(securityHeaders);
app.use(requestLogger);

// ── CORS for REST API ───────────────────────────────────────────────
// In production, Nginx proxies everything through the same origin so CORS
// isn't needed. In development, the frontend (WEB_URL) runs on a different port.
app.use('/api', cors({
  origin: config.WEB_URL,
  credentials: true,
}));

// ── WebDAV routes (mounted BEFORE express.json() to allow raw body streaming) ──
// WebDAV PUT requests send raw file content that should not be parsed as JSON.
app.use('/webdav', webdavLimiter, webdavRouter);

app.use(express.json());
app.use(cookieParser());

// ── API documentation (no auth required) ─────────────────────────────
app.use('/api/docs', swaggerRouter);

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

export default app;
