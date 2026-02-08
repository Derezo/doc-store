import { test, expect } from '../fixtures/auth';
import { createTestVault, createTestDocument, loginUser } from '../helpers/api';

test.describe('Search', () => {
  test('Cmd+K opens search modal', async ({ authenticatedPage }) => {
    // Create a test vault to ensure user has data
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Search Test Vault ${Date.now()}`);
    await createTestDocument(token, vault.id, 'searchable.md', '# Searchable Content\n\nFind me!');

    await authenticatedPage.goto(`/vaults/${vault.id}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Press Cmd+K (or Ctrl+K on Windows/Linux)
    const isMac = process.platform === 'darwin';
    await authenticatedPage.keyboard.press(isMac ? 'Meta+K' : 'Control+K');

    // Search modal should open
    await expect(
      authenticatedPage.getByPlaceholder(/search|find/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('type query and see results', async ({ authenticatedPage }) => {
    // Create test data
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Query Test Vault ${Date.now()}`);
    const uniqueWord = `unique${Date.now()}`;
    await createTestDocument(
      token,
      vault.id,
      'query-test.md',
      `# Query Test\n\nThis document contains ${uniqueWord}.`,
    );

    await authenticatedPage.goto(`/vaults/${vault.id}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Open search
    const isMac = process.platform === 'darwin';
    await authenticatedPage.keyboard.press(isMac ? 'Meta+K' : 'Control+K');

    // Type query
    const searchInput = authenticatedPage.getByPlaceholder(/search|find/i);
    await searchInput.fill(uniqueWord);

    // Wait for results to appear
    await expect(
      authenticatedPage.getByText(/query.*test|results/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('click result navigates to document', async ({ authenticatedPage }) => {
    // Create test data
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Navigate Test Vault ${Date.now()}`);
    const uniqueWord = `navigate${Date.now()}`;
    await createTestDocument(
      token,
      vault.id,
      'navigate-test.md',
      `# Navigate Test\n\nClick to navigate with ${uniqueWord}.`,
    );

    await authenticatedPage.goto(`/vaults/${vault.id}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Open search
    const isMac = process.platform === 'darwin';
    await authenticatedPage.keyboard.press(isMac ? 'Meta+K' : 'Control+K');

    // Type query
    const searchInput = authenticatedPage.getByPlaceholder(/search|find/i);
    await searchInput.fill(uniqueWord);

    // Wait for and click on result
    const resultItem = authenticatedPage.getByText(/navigate.*test/i).first();
    await expect(resultItem).toBeVisible({ timeout: 10000 });
    await resultItem.click();

    // Should navigate to document
    await authenticatedPage.waitForURL(/documents\/navigate-test\.md/, { timeout: 10000 });
    await expect(authenticatedPage.getByText(/Navigate Test/i)).toBeVisible();
  });

  test('search page with filters (/search?q=...)', async ({ authenticatedPage }) => {
    // Create test data
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Filter Test Vault ${Date.now()}`);
    const searchTerm = `filter${Date.now()}`;
    await createTestDocument(
      token,
      vault.id,
      'filter-test.md',
      `# Filter Test\n\nSearch term: ${searchTerm}.`,
    );

    // Navigate directly to search page with query
    await authenticatedPage.goto(`/search?q=${encodeURIComponent(searchTerm)}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Should show search results
    await expect(
      authenticatedPage.getByText(/filter.*test|results/i),
    ).toBeVisible({ timeout: 10000 });

    // Check that search input is populated
    const searchInput = authenticatedPage.getByRole('textbox', { name: /search|query/i });
    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveValue(searchTerm);
    }
  });
});
