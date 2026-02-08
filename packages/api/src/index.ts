import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import { config } from './config.js';
import { API_PREFIX } from '@doc-store/shared';
import type { HealthCheckResponse } from '@doc-store/shared';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import vaultRoutes from './routes/vaults.routes.js';
import documentRoutes from './routes/documents.routes.js';

const logger = pino({
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

const app = express();

app.use(express.json());
app.use(cookieParser());

// Health check
app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
  const body: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

// Auth routes
app.use(`${API_PREFIX}/auth`, authRoutes);

// User routes
app.use(`${API_PREFIX}/users`, userRoutes);

// Vault routes (includes tree endpoint)
app.use(`${API_PREFIX}/vaults`, vaultRoutes);

// Document routes (nested under vaults)
app.use(`${API_PREFIX}/vaults/:vaultId/documents`, documentRoutes);

// Global error handler (must be registered last)
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info(`Server listening on port ${config.PORT}`);
  logger.info(`Health check: http://localhost:${config.PORT}${API_PREFIX}/health`);
});

export default app;
