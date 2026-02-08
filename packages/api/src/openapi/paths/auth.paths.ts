import { z } from 'zod';
import {
  loginRequestSchema,
  registerRequestSchema,
  authResponseSchema,
  apiErrorResponseSchema,
  userSchema,
} from '@doc-store/shared';
import { registry } from '../registry.js';

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  description: 'Register with an invitation token. Returns JWT access token and sets httpOnly refresh cookie. Rate limited: 5 req/15min.',
  request: {
    body: {
      content: {
        'application/json': { schema: registerRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'User registered successfully',
      content: {
        'application/json': { schema: authResponseSchema },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    409: {
      description: 'Email already registered',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  description: 'Authenticate with email and password. Returns JWT access token (15min expiry) and sets httpOnly refresh cookie (7 days). Rate limited: 5 req/15min.',
  request: {
    body: {
      content: {
        'application/json': { schema: loginRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': { schema: authResponseSchema },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  description: 'Exchange refresh cookie for a new access token. Requires X-Requested-With header for CSRF protection.',
  responses: {
    200: {
      description: 'Token refreshed',
      content: {
        'application/json': { schema: authResponseSchema },
      },
    },
    401: {
      description: 'Invalid or missing refresh token',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
    403: {
      description: 'Missing X-Requested-With header',
      content: {
        'application/json': { schema: apiErrorResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Log out',
  description: 'Invalidate the current session and clear the refresh cookie.',
  security: [{ BearerJWT: [] }],
  responses: {
    200: {
      description: 'Logged out',
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
  },
});
