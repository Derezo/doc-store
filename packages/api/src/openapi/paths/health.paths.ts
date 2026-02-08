import { healthCheckResponseSchema } from '@doc-store/shared';
import { registry } from '../registry.js';

registry.registerPath({
  method: 'get',
  path: '/api/v1/health',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Returns server health status. No authentication required.',
  responses: {
    200: {
      description: 'Server is healthy',
      content: {
        'application/json': { schema: healthCheckResponseSchema },
      },
    },
  },
});
