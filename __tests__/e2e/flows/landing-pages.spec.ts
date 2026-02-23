import { test, expect } from '@playwright/test';

/**
 * E2E tests for landing & static pages (E-LP-01 through E-LP-11).
 * These pages don't require authentication.
 */

test.describe('Landing & Static Pages', () => {
  test('E-LP-01: Landing page loads with hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    // Check for CTA / product content
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Eventa');
  });

  test('E-LP-02: Order form interaction', async ({ page }) => {
    await page.goto('/dating');
    // Dating landing has the order section
    await expect(page.locator('.landing')).toBeVisible();
    // Order section anchor exists
    const orderSection = page.locator('#order');
    await expect(orderSection).toBeAttached();
  });

  test('E-LP-04: FAQ page renders with questions', async ({ page }) => {
    await page.goto('/faq');
    await expect(page).toHaveURL(/faq/);
    await expect(page.locator('main')).toBeVisible();
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(50);
  });

  test('E-LP-05: Privacy page renders', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/privacy/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('E-LP-06: Terms page renders', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/terms/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('E-LP-07: Cookies page renders', async ({ page }) => {
    await page.goto('/cookies');
    await expect(page).toHaveURL(/cookies/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('E-LP-10: 404 page for non-existent route', async ({ page }) => {
    const res = await page.goto('/nonexistent-route-xyz');
    expect(res?.status()).toBe(404);
    // Should show custom 404 with Hebrew text
    await expect(page.locator('body')).toContainText('הדף לא נמצא');
  });

  test('E-LP-11: Sitemap returns valid XML', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
    const contentType = res?.headers()['content-type'] || '';
    expect(contentType).toContain('xml');
  });
});
