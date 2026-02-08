const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

/**
 * Seed database with test data via API calls.
 * Uses admin credentials to create test users, vaults, etc.
 */
export async function seedTestData(adminToken: string) {
  // Create a test user invitation
  const inviteRes = await fetch(`${API_URL}/users/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email: 'test@example.com' }),
  });

  if (!inviteRes.ok && inviteRes.status !== 409) {
    throw new Error(`Failed to create invitation: ${inviteRes.status}`);
  }

  return inviteRes.json();
}

/**
 * Clean up test data via API.
 */
export async function cleanupTestData(adminToken: string) {
  // Cleanup is handled by truncating test data
  // This is intentionally simple for E2E tests
}

/**
 * Login and return access token.
 */
export async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'adminpassword123',
    }),
  });

  if (!res.ok) {
    throw new Error(`Admin login failed: ${res.status}`);
  }

  const data = await res.json();
  return data.accessToken;
}
