import app from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { API_PREFIX } from '@doc-store/shared';
import * as syncService from './services/sync.service.js';
import { pool } from './db/index.js';

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
