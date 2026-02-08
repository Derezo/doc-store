import { test, expect } from '../fixtures/auth';
import { createTestVault, createTestDocument, loginUser } from '../helpers/api';

test.describe('Documents', () => {
  test('create document via new file dialog', async ({ authenticatedPage }) => {
    // Create a test vault first
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Doc Test Vault ${Date.now()}`);

    await authenticatedPage.goto(`/vaults/${vault.id}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Click new/create document button
    const newButton = authenticatedPage.getByRole('button', {
      name: /new|create.*document|add.*file/i,
    });
    await newButton.click();

    // Fill in document name
    const nameInput = authenticatedPage.getByLabel(/name|file.*name|document.*name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const docName = `test-doc-${Date.now()}.md`;
    await nameInput.fill(docName);

    // Submit
    const submitButton = authenticatedPage.getByRole('button', { name: /create|save/i });
    await submitButton.click();

    // Should navigate to the new document or show it in the editor
    await authenticatedPage.waitForURL(new RegExp(`/vaults/${vault.id}/`), { timeout: 10000 });
  });

  test('view document content', async ({ authenticatedPage }) => {
    // Create a test vault and document
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `View Test Vault ${Date.now()}`);
    const docContent = '# Test Document\n\nThis is test content.';
    const doc = await createTestDocument(token, vault.id, 'view-test.md', docContent);

    // Navigate to document
    await authenticatedPage.goto(`/vaults/${vault.id}/documents/${encodeURIComponent('view-test.md')}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Should display content (either in editor or viewer)
    await expect(authenticatedPage.getByText(/Test Document/i)).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByText(/test content/i)).toBeVisible();
  });

  test('switch between editor modes (view/edit/source)', async ({ authenticatedPage }) => {
    // Create a test vault and document
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Mode Test Vault ${Date.now()}`);
    const docContent = '# Mode Test\n\nSwitch modes.';
    await createTestDocument(token, vault.id, 'mode-test.md', docContent);

    await authenticatedPage.goto(`/vaults/${vault.id}/documents/${encodeURIComponent('mode-test.md')}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for mode switcher buttons (view, edit, source)
    const viewButton = authenticatedPage.getByRole('button', { name: /view|preview/i });
    const editButton = authenticatedPage.getByRole('button', { name: /edit|wysiwyg/i });
    const sourceButton = authenticatedPage.getByRole('button', { name: /source|markdown/i });

    // Try switching to edit mode
    if (await editButton.isVisible()) {
      await editButton.click();
      await authenticatedPage.waitForTimeout(500);
    }

    // Try switching to source mode
    if (await sourceButton.isVisible()) {
      await sourceButton.click();
      await authenticatedPage.waitForTimeout(500);
      // In source mode, should see raw markdown
      await expect(authenticatedPage.getByText(/# Mode Test/)).toBeVisible({ timeout: 5000 });
    }

    // Switch back to view mode
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await authenticatedPage.waitForTimeout(500);
    }
  });

  test('auto-save after typing (wait for save indicator)', async ({ authenticatedPage }) => {
    // Create a test vault and document
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Save Test Vault ${Date.now()}`);
    await createTestDocument(token, vault.id, 'save-test.md', '# Save Test');

    await authenticatedPage.goto(`/vaults/${vault.id}/documents/${encodeURIComponent('save-test.md')}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Switch to edit mode
    const editButton = authenticatedPage.getByRole('button', { name: /edit|wysiwyg/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      await authenticatedPage.waitForTimeout(500);
    }

    // Find editor and type
    const editor = authenticatedPage.locator('[contenteditable="true"], textarea').first();
    await editor.click();
    await editor.pressSequentially('\n\nAuto-save test content.', { delay: 100 });

    // Wait for save indicator (saving... then saved)
    await expect(
      authenticatedPage.getByText(/saving|saved/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('delete document with confirmation dialog', async ({ authenticatedPage }) => {
    // Create a test vault and document
    const token = await loginUser('test@example.com', 'testpassword123').then((r) => r.accessToken);
    const vault = await createTestVault(token, `Delete Test Vault ${Date.now()}`);
    await createTestDocument(token, vault.id, 'delete-test.md', '# Delete Me');

    await authenticatedPage.goto(`/vaults/${vault.id}/documents/${encodeURIComponent('delete-test.md')}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Find delete button (could be in a menu)
    const deleteButton = authenticatedPage.getByRole('button', {
      name: /delete|remove/i,
    });

    // May need to open a menu first
    const menuButton = authenticatedPage.getByRole('button', { name: /more|menu|options/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(
      authenticatedPage.getByText(/are you sure|confirm|delete/i),
    ).toBeVisible({ timeout: 5000 });

    // Confirm deletion
    const confirmButton = authenticatedPage.getByRole('button', { name: /delete|confirm|yes/i });
    await confirmButton.click();

    // Should redirect back to vault
    await authenticatedPage.waitForURL(new RegExp(`/vaults/${vault.id}(?!/documents)`), {
      timeout: 10000,
    });
  });
});
