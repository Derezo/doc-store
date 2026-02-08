import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/vaults');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('login with valid credentials navigates to vaults', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/vaults/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/vaults/);
  });

  test('register page requires invite token', async ({ page }) => {
    await page.goto('/register');
    // Should show error or redirect about missing token
    await expect(page.getByText(/invitation|token|required/i)).toBeVisible({ timeout: 5000 });
  });

  test('logout returns to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/vaults/, { timeout: 10000 });

    // Find and click logout
    // Open user menu if needed
    const userMenu = page.getByRole('button', { name: /user|menu|profile|account/i });
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    await page.getByRole('button', { name: /log\s*out|sign\s*out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('session expired redirects to login', async ({ page }) => {
    // Set an expired/invalid token in localStorage
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { accessToken: 'expired-token', user: { id: '1', email: 'test@test.com' } },
        }),
      );
    });
    await page.goto('/vaults');
    // Should redirect back to login on 401
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
