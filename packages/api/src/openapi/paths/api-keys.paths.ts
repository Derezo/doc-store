import { z } from 'zod';
import {
  createApiKeySchema,
  updateApiKeySchema,
  apiErrorResponseSchema,
} from '@doc-store/shared';
import { registry } from '../registry.js';
import { apiKeyMetaSchema, createApiKeyResponseSchema } from '../responses.js';

registry.registerPath({
  method: 'get',
  path: '/api/v1/api-keys',
  tags: ['API Keys'],
  summary: 'List API keys',
  description: 'List all API keys for the current user. Secret tokens are never included. Requires JWT auth (not API key).',
  security: [{ BearerJWT: [] }],
  responses: {
    200: {
      description: 'API key list',
      content: {
        'application/json': {
          schema: z.object({ apiKeys: z.array(apiKeyMetaSchema) }),
        },
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

registry.registerPath({
  method: 'post',
  path: '/api/v1/api-keys',
  tags: ['API Keys'],
  summary: 'Create API key',
  description: 'Create a new API key. The full key (with ds_k_ prefix) is only returned once in the response. Requires JWT auth.',
  security: [{ BearerJWT: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createApiKeySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'API key created. Save the fullKey — it will not be shown again.',
      content: {
        'application/json': { schema: createApiKeyResponseSchema },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/api-keys/{keyId}',
  tags: ['API Keys'],
  summary: 'Get API key details',
  description: 'Get metadata for a specific API key (does not include the secret). Requires JWT auth.',
  security: [{ BearerJWT: [] }],
  request: {
    params: z.object({
      keyId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'API key details',
      content: {
        'application/json': {
          schema: z.object({ apiKey: apiKeyMetaSchema }),
        },
      },
    },
    404: {
      description: 'API key not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/api-keys/{keyId}',
  tags: ['API Keys'],
  summary: 'Update API key',
  description: 'Update name or active status of an API key. Requires JWT auth.',
  security: [{ BearerJWT: [] }],
  request: {
    params: z.object({
      keyId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': { schema: updateApiKeySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'API key updated',
      content: {
        'application/json': {
          schema: z.object({ apiKey: apiKeyMetaSchema }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    404: {
      description: 'API key not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/api-keys/{keyId}',
  tags: ['API Keys'],
  summary: 'Delete API key',
  description: 'Permanently delete an API key. Requires JWT auth.',
  security: [{ BearerJWT: [] }],
  request: {
    params: z.object({
      keyId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'API key deleted',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'API key not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});
