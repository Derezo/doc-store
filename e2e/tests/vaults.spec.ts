import { test, expect } from '../fixtures/auth';
import { createTestVault, loginUser } from '../helpers/api';

test.describe('Vaults', () => {
  test('vault cards display after login', async ({ authenticatedPage }) => {
    // Should be on vaults page after authentication
    await expect(authenticatedPage).toHaveURL(/\/vaults/);

    // Wait for vaults to load (there should be at least a heading or empty state)
    await expect(
      authenticatedPage.getByRole('heading', { name: /vaults|my vaults/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('create vault via modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/vaults');

    // Click create/new vault button
    const createButton = authenticatedPage.getByRole('button', {
      name: /create|new.*vault|add vault/i,
    });
    await createButton.click();

    // Fill in vault name in modal
    const nameInput = authenticatedPage.getByLabel(/name|vault name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(`E2E Test Vault ${Date.now()}`);

    // Submit form
    const submitButton = authenticatedPage.getByRole('button', { name: /create|save/i });
    await submitButton.click();

    // Modal should close and new vault should appear
    await expect(nameInput).not.toBeVisible({ timeout: 5000 });
  });

  test('browse vault (click into it)', async ({ authenticatedPage }) => {
    // Create a test vault first
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Browse Test Vault ${Date.now()}`);

    await authenticatedPage.goto('/vaults');

    // Click on the vault card
    const vaultCard = authenticatedPage.getByText(vault.name);
    await vaultCard.click();

    // Should navigate to vault's documents page
    await authenticatedPage.waitForURL(new RegExp(`/vaults/${vault.id}`), { timeout: 10000 });
    await expect(authenticatedPage).toHaveURL(new RegExp(`/vaults/${vault.id}`));
  });

  test('vault switcher changes active vault', async ({ authenticatedPage }) => {
    // Create two test vaults
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault1 = await createTestVault(token, `Switcher Vault 1 ${Date.now()}`);
    const vault2 = await createTestVault(token, `Switcher Vault 2 ${Date.now()}`);

    // Navigate to first vault
    await authenticatedPage.goto(`/vaults/${vault1.id}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Open vault switcher (could be a dropdown, select, or button)
    const switcher = authenticatedPage.getByRole('button', {
      name: /vault|switch vault|select vault/i,
    });

    if (await switcher.isVisible()) {
      await switcher.click();

      // Select second vault from dropdown
      const vault2Option = authenticatedPage.getByText(vault2.name);
      await vault2Option.click();

      // Should navigate to second vault
      await authenticatedPage.waitForURL(new RegExp(`/vaults/${vault2.id}`), { timeout: 10000 });
      await expect(authenticatedPage).toHaveURL(new RegExp(`/vaults/${vault2.id}`));
    }
  });
});
