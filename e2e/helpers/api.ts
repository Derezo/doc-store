const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
  accessToken: string;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  return res.json();
}

export async function createTestVault(token: string, name: string) {
  const res = await fetch(`${API_URL}/vaults`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw new Error(`Create vault failed: ${res.status}`);
  }

  return res.json();
}

export async function createTestDocument(
  token: string,
  vaultId: string,
  path: string,
  content: string,
) {
  const res = await fetch(`${API_URL}/vaults/${vaultId}/documents/${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, createIntermediateFolders: true }),
  });

  if (!res.ok) {
    throw new Error(`Create document failed: ${res.status}`);
  }

  return res.json();
}
