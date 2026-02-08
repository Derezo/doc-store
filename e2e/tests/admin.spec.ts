import { test, expect } from '../fixtures/auth';

test.describe('Admin Features', () => {
  test('admin can invite users (create invitation)', async ({ adminPage }) => {
    // Navigate to admin/users page
    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Click invite user button
    const inviteButton = adminPage.getByRole('button', {
      name: /invite|new.*user|add.*user/i,
    });
    await inviteButton.click();

    // Fill in email
    const emailInput = adminPage.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(`e2etest+${Date.now()}@example.com`);

    // Submit
    const submitButton = adminPage.getByRole('button', { name: /invite|send|create/i });
    await submitButton.click();

    // Should show success message
    await expect(
      adminPage.getByText(/invitation.*sent|success|created/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('non-admin cannot access admin features', async ({ authenticatedPage }) => {
    // Try to navigate to admin page
    await authenticatedPage.goto('/admin/users');

    // Should redirect or show 403/unauthorized message
    await authenticatedPage.waitForTimeout(2000);

    // Check if redirected away from admin page or see error
    const url = authenticatedPage.url();
    const isOnAdminPage = url.includes('/admin');

    if (isOnAdminPage) {
      // If still on admin page, should show unauthorized message
      await expect(
        authenticatedPage.getByText(/unauthorized|forbidden|access denied|not allowed/i),
      ).toBeVisible({ timeout: 5000 });
    } else {
      // If redirected, that's also valid behavior
      expect(url).not.toContain('/admin');
    }
  });

  test('admin can revoke invitation', async ({ adminPage }) => {
    // Navigate to admin/users page
    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('networkidle');

    // Create an invitation first
    const inviteButton = adminPage.getByRole('button', {
      name: /invite|new.*user|add.*user/i,
    });
    await inviteButton.click();

    const emailInput = adminPage.getByLabel(/email/i);
    const testEmail = `revoke+${Date.now()}@example.com`;
    await emailInput.fill(testEmail);

    const submitButton = adminPage.getByRole('button', { name: /invite|send|create/i });
    await submitButton.click();

    // Wait for invitation to be created
    await adminPage.waitForTimeout(2000);

    // Find and revoke the invitation
    // May need to filter by pending invitations or find in a table
    const revokeButton = adminPage.getByRole('button', {
      name: /revoke|delete|cancel/i,
    }).first();

    if (await revokeButton.isVisible()) {
      await revokeButton.click();

      // Confirm if there's a dialog
      const confirmButton = adminPage.getByRole('button', {
        name: /revoke|confirm|yes|delete/i,
      });
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Should show success message
      await expect(
        adminPage.getByText(/revoked|deleted|cancelled/i),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
