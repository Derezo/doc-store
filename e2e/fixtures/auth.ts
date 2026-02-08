import { test as base, type Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login as regular user
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/vaults/);
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    // Login as admin
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('adminpassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/vaults/);
    await use(page);
  },
});

export { expect } from '@playwright/test';
