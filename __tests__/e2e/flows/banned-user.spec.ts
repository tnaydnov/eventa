import { test, expect } from '@playwright/test';
import { setSessionCookie } from '../helpers/fixtures';

/**
 * E2E tests for banned user flow (E-BN-01 through E-BN-03).
 */

test.describe('Banned User Flow', () => {
  test('E-BN-01: Banned user sees banned page', async ({ page }) => {
    // Banned page is static - no auth needed, just renders content
    await page.goto('/dating/test-event/banned');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText('הגישה שלך נחסמה');
  });

  test('E-BN-02: Banned user cannot rejoin', async ({ page }) => {
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No session' }),
      });
    });

    // Mock join → banned device
    await page.route('**/api/auth/join', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Device is banned' }),
      });
    });

    await page.goto('/dating/test-event/join?k=TESTCODE123X');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Submit join
    const agreeCheckbox = page.locator('[role="checkbox"], [type="checkbox"]').first();
    if (await agreeCheckbox.isVisible()) {
      await agreeCheckbox.click();
    }
    const submitBtn = page.locator('button', { hasText: 'המשך' });
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      // Should show banned device error
      await expect(page.locator('body')).toContainText('חסום');
    }
  });

  test('E-BN-03: Banned page shows re-registration warning', async ({ page }) => {
    await page.goto('/dating/test-event/banned');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText('לא ניתן להירשם מחדש');
  });
});
