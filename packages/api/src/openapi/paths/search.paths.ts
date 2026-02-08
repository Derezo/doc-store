import { z } from 'zod';
import { apiErrorResponseSchema } from '@doc-store/shared';
import { registry } from '../registry.js';
import { searchResponseSchema } from '../responses.js';

registry.registerPath({
  method: 'get',
  path: '/api/v1/search',
  tags: ['Search'],
  summary: 'Full-text search',
  description: 'Search across documents in vaults owned by the authenticated user. Uses PostgreSQL full-text search with natural language syntax (e.g., "typescript OR rust", "exact phrase"). API keys scoped to a vault only search that vault. Rate limited: 100 req/min.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    query: z.object({
      q: z.string().min(1).max(500).openapi({ description: 'Search query (natural language syntax)' }),
      vault: z.string().uuid().optional().openapi({ description: 'Filter to a specific vault' }),
      tags: z.string().optional().openapi({ description: 'Comma-separated tag filter' }),
      limit: z.coerce.number().min(1).max(100).default(20).openapi({ description: 'Results per page (default: 20)' }),
      offset: z.coerce.number().min(0).default(0).openapi({ description: 'Pagination offset (default: 0)' }),
    }),
  },
  responses: {
    200: {
      description: 'Search results with highlighted snippets',
      content: {
        'application/json': { schema: searchResponseSchema },
      },
    },
    400: {
      description: 'Invalid search query',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});
