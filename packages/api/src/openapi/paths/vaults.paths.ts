import { z } from 'zod';
import {
  createVaultSchema,
  updateVaultSchema,
  apiErrorResponseSchema,
} from '@doc-store/shared';
import { registry } from '../registry.js';
import { vaultSchema, treeNodeResponseSchema } from '../responses.js';

const vaultIdParam = z.object({
  vaultId: z.string().uuid(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/vaults',
  tags: ['Vaults'],
  summary: 'List vaults',
  description: 'List all vaults owned by the authenticated user. API keys scoped to a specific vault only see that vault.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  responses: {
    200: {
      description: 'Vault list',
      content: {
        'application/json': {
          schema: z.object({ vaults: z.array(vaultSchema) }),
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
  path: '/api/v1/vaults',
  tags: ['Vaults'],
  summary: 'Create vault',
  description: 'Create a new vault. Requires write scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createVaultSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Vault created',
      content: {
        'application/json': {
          schema: z.object({ vault: vaultSchema }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    409: {
      description: 'Vault name already exists',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/vaults/{vaultId}',
  tags: ['Vaults'],
  summary: 'Get vault',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: vaultIdParam,
  },
  responses: {
    200: {
      description: 'Vault details',
      content: {
        'application/json': {
          schema: z.object({ vault: vaultSchema }),
        },
      },
    },
    404: {
      description: 'Vault not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/vaults/{vaultId}',
  tags: ['Vaults'],
  summary: 'Update vault',
  description: 'Update vault name and/or description. Requires write scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: vaultIdParam,
    body: {
      content: {
        'application/json': { schema: updateVaultSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Vault updated',
      content: {
        'application/json': {
          schema: z.object({ vault: vaultSchema }),
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
      description: 'Vault not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/vaults/{vaultId}',
  tags: ['Vaults'],
  summary: 'Delete vault',
  description: 'Delete a vault and all its documents. Requires write scope. This action is irreversible.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: vaultIdParam,
  },
  responses: {
    200: {
      description: 'Vault deleted',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Vault not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/vaults/{vaultId}/tree',
  tags: ['Vaults'],
  summary: 'Get vault file tree',
  description: 'Returns the full directory tree of a vault. Requires read scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: vaultIdParam,
  },
  responses: {
    200: {
      description: 'Vault tree',
      content: {
        'application/json': {
          schema: z.object({ tree: z.array(treeNodeResponseSchema) }),
        },
      },
    },
    404: {
      description: 'Vault not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});
