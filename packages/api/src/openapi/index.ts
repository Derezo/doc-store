import { Router, type Request, type Response } from 'express';
import { createRequire } from 'node:module';
import { generateOpenApiDocument } from './generator.js';

// swagger-ui-express is CJS-only — use createRequire for ESM compat
const require = createRequire(import.meta.url);
const swaggerUi = require('swagger-ui-express');

const router = Router();

// Generate the spec once at startup
const spec = generateOpenApiDocument();

// Serve raw OpenAPI JSON
router.get('/json', (_req: Request, res: Response) => {
  res.json(spec);
});

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'doc-store API Docs',
}));

export default router;
