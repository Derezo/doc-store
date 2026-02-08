import { z } from 'zod';
import { apiErrorResponseSchema, userSchema } from '@doc-store/shared';
import { registry } from '../registry.js';
import { storageResponseSchema, invitationSchema } from '../responses.js';

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/me',
  tags: ['Users'],
  summary: 'Get current user profile',
  security: [{ BearerJWT: [] }],
  responses: {
    200: {
      description: 'Current user',
      content: {
        'application/json': {
          schema: z.object({ user: userSchema }),
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
  method: 'get',
  path: '/api/v1/users/me/storage',
  tags: ['Users'],
  summary: 'Get storage usage',
  description: 'Returns total bytes and per-vault storage breakdown.',
  security: [{ BearerJWT: [] }],
  responses: {
    200: {
      description: 'Storage usage',
      content: {
        'application/json': { schema: storageResponseSchema },
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
  path: '/api/v1/users/invite',
  tags: ['Users'],
  summary: 'Create invitation (admin only)',
  description: 'Send an invitation email to a new user. Requires admin role.',
  security: [{ BearerJWT: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Invitation created',
      content: {
        'application/json': {
          schema: z.object({ invitation: invitationSchema }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    403: {
      description: 'Not an admin',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/invitations',
  tags: ['Users'],
  summary: 'List invitations (admin only)',
  security: [{ BearerJWT: [] }],
  responses: {
    200: {
      description: 'All invitations',
      content: {
        'application/json': {
          schema: z.object({ invitations: z.array(invitationSchema) }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    403: {
      description: 'Not an admin',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/users/invitations/{id}',
  tags: ['Users'],
  summary: 'Revoke invitation (admin only)',
  security: [{ BearerJWT: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Invitation revoked',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    403: {
      description: 'Not an admin',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    404: {
      description: 'Invitation not found',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});
