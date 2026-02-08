export function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user' as const,
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockVault(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Test Vault',
    slug: 'test-vault',
    description: 'A test vault',
    userId: '00000000-0000-0000-0000-000000000001',
    documentCount: 5,
    totalSizeBytes: 10240,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    path: 'notes/hello.md',
    title: 'Hello',
    content: '# Hello\n\nWorld',
    contentHash: 'abc123',
    sizeBytes: 15,
    tags: ['greeting'],
    vaultId: '00000000-0000-0000-0000-000000000010',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockTreeNode(overrides: Record<string, unknown> = {}) {
  return {
    name: '',
    type: 'directory' as const,
    children: [
      {
        name: 'notes',
        type: 'directory' as const,
        children: [
          {
            name: 'hello.md',
            type: 'file' as const,
            path: 'notes/hello.md',
          },
        ],
      },
    ],
    ...overrides,
  };
}

export function mockSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    path: 'notes/hello.md',
    title: 'Hello',
    snippet: 'This is a <mark>test</mark> snippet',
    vaultId: '00000000-0000-0000-0000-000000000010',
    vaultName: 'Test Vault',
    tags: ['greeting'],
    rank: 0.5,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000001000',
    name: 'Test Key',
    prefix: 'ds_k_abc',
    scopes: ['read', 'write'],
    vaultId: null,
    isActive: true,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}
