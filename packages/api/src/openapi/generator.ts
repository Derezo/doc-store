import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Import all path registrations (side-effect imports)
import './responses.js';
import './paths/health.paths.js';
import './paths/auth.paths.js';
import './paths/users.paths.js';
import './paths/vaults.paths.js';
import './paths/documents.paths.js';
import './paths/api-keys.paths.js';
import './paths/search.paths.js';

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'doc-store API',
      version: '1.0.0',
      description:
        'Multi-user Markdown document storage service with Obsidian sync via WebDAV. ' +
        'Authenticate with JWT (login flow) or API keys (ds_k_ prefix) for programmatic access.',
    },
    servers: [
      {
        url: '{baseUrl}',
        variables: {
          baseUrl: {
            default: 'http://localhost:4000',
            description: 'API server URL',
          },
        },
      },
    ],
    tags: [
      { name: 'Health', description: 'Server health check' },
      { name: 'Auth', description: 'Authentication and session management' },
      { name: 'Users', description: 'User profile and admin operations' },
      { name: 'Vaults', description: 'Vault management and file tree' },
      { name: 'Documents', description: 'Document CRUD and version history' },
      { name: 'API Keys', description: 'API key management (JWT auth only)' },
      { name: 'Search', description: 'Full-text document search' },
    ],
  });
}
