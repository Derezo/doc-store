import { z } from 'zod';
import { putDocumentSchema, apiErrorResponseSchema } from '@doc-store/shared';
import { registry } from '../registry.js';
import {
  documentSchema,
  documentListItemSchema,
  documentVersionSchema,
} from '../responses.js';

const vaultIdParam = z.object({
  vaultId: z.string().uuid(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/vaults/{vaultId}/documents',
  tags: ['Documents'],
  summary: 'List documents',
  description: 'List documents in a vault. Optionally filter by directory with the `dir` query parameter. Requires read scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: vaultIdParam,
    query: z.object({
      dir: z.string().optional().openapi({ description: 'Filter by directory path' }),
    }),
  },
  responses: {
    200: {
      description: 'Document list',
      content: {
        'application/json': {
          schema: z.object({ documents: z.array(documentListItemSchema) }),
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
  path: '/api/v1/vaults/{vaultId}/documents/{path}',
  tags: ['Documents'],
  summary: 'Get document',
  description: 'Get document content and metadata by path. The path should not include the .md extension. Requires read scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: z.object({
      vaultId: z.string().uuid(),
      path: z.string().openapi({ description: 'Document path (without .md extension)' }),
    }),
  },
  responses: {
    200: {
      description: 'Document content and metadata',
      content: {
        'application/json': {
          schema: z.object({
            document: documentSchema,
            content: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Document not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/vaults/{vaultId}/documents/{path}',
  tags: ['Documents'],
  summary: 'Create or update document',
  description: 'Upsert a document at the given path. Creates the document if it does not exist, updates if it does. Set `createIntermediateFolders: true` to create parent directories. Requires write scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: z.object({
      vaultId: z.string().uuid(),
      path: z.string().openapi({ description: 'Document path (without .md extension)' }),
    }),
    body: {
      content: {
        'application/json': { schema: putDocumentSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Document created or updated',
      content: {
        'application/json': {
          schema: z.object({ document: documentSchema }),
        },
      },
    },
    400: {
      description: 'Validation error or invalid path',
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
  path: '/api/v1/vaults/{vaultId}/documents/{path}',
  tags: ['Documents'],
  summary: 'Delete document',
  description: 'Delete a document by path. Requires write scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: z.object({
      vaultId: z.string().uuid(),
      path: z.string().openapi({ description: 'Document path (without .md extension)' }),
    }),
  },
  responses: {
    200: {
      description: 'Document deleted',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Document not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/vaults/{vaultId}/documents/{path}/versions',
  tags: ['Documents'],
  summary: 'Get document version history',
  description: 'Get the version history of a document. Requires read scope.',
  security: [{ BearerJWT: [] }, { BearerApiKey: [] }],
  request: {
    params: z.object({
      vaultId: z.string().uuid(),
      path: z.string().openapi({ description: 'Document path (without .md extension)' }),
    }),
  },
  responses: {
    200: {
      description: 'Version history',
      content: {
        'application/json': {
          schema: z.object({ versions: z.array(documentVersionSchema) }),
        },
      },
    },
    404: {
      description: 'Document not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});
