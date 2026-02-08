import { test, expect } from '../fixtures/auth';

test.describe('API Keys', () => {
  test('navigate to settings and create API key', async ({ authenticatedPage }) => {
    // Navigate to settings/API keys page
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for API keys section or navigate to it
    const apiKeysLink = authenticatedPage.getByRole('link', { name: /api.*keys?/i });
    if (await apiKeysLink.isVisible()) {
      await apiKeysLink.click();
      await authenticatedPage.waitForLoadState('networkidle');
    }

    // Click create/new API key button
    const createButton = authenticatedPage.getByRole('button', {
      name: /create|new.*key|generate.*key/i,
    });
    await createButton.click();

    // Fill in API key details
    const nameInput = authenticatedPage.getByLabel(/name|label|description/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(`E2E Test Key ${Date.now()}`);

    // Submit form
    const submitButton = authenticatedPage.getByRole('button', { name: /create|generate|save/i });
    await submitButton.click();

    // Should show success message or the new key
    await expect(
      authenticatedPage.getByText(/created|success|ds_k_/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('copy key to clipboard', async ({ authenticatedPage }) => {
    // Navigate to API keys page
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');

    const apiKeysLink = authenticatedPage.getByRole('link', { name: /api.*keys?/i });
    if (await apiKeysLink.isVisible()) {
      await apiKeysLink.click();
      await authenticatedPage.waitForLoadState('networkidle');
    }

    // Create a new API key
    const createButton = authenticatedPage.getByRole('button', {
      name: /create|new.*key|generate.*key/i,
    });
    await createButton.click();

    const nameInput = authenticatedPage.getByLabel(/name|label|description/i);
    await nameInput.fill(`Copy Test Key ${Date.now()}`);

    const submitButton = authenticatedPage.getByRole('button', { name: /create|generate|save/i });
    await submitButton.click();

    // Wait for key to be displayed
    await authenticatedPage.waitForTimeout(2000);

    // Find and click copy button
    const copyButton = authenticatedPage.getByRole('button', { name: /copy/i }).first();
    await copyButton.click();

    // Should show copied confirmation
    await expect(
      authenticatedPage.getByText(/copied|copy.*success/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('delete/revoke key', async ({ authenticatedPage }) => {
    // Navigate to API keys page
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');

    const apiKeysLink = authenticatedPage.getByRole('link', { name: /api.*keys?/i });
    if (await apiKeysLink.isVisible()) {
      await apiKeysLink.click();
      await authenticatedPage.waitForLoadState('networkidle');
    }

    // Create a key to delete
    const createButton = authenticatedPage.getByRole('button', {
      name: /create|new.*key|generate.*key/i,
    });
    await createButton.click();

    const nameInput = authenticatedPage.getByLabel(/name|label|description/i);
    const keyName = `Delete Test Key ${Date.now()}`;
    await nameInput.fill(keyName);

    const submitButton = authenticatedPage.getByRole('button', { name: /create|generate|save/i });
    await submitButton.click();

    // Wait for modal to close
    await authenticatedPage.waitForTimeout(2000);

    // Find the created key and delete it
    const deleteButton = authenticatedPage.getByRole('button', {
      name: /delete|revoke|remove/i,
    }).first();
    await deleteButton.click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = authenticatedPage.getByRole('button', {
      name: /delete|confirm|yes|revoke/i,
    });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    // Should show success message
    await expect(
      authenticatedPage.getByText(/deleted|revoked|removed/i),
    ).toBeVisible({ timeout: 10000 });
  });
});
