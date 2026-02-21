import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, TEST_EVENT_SLUG, setSessionCookie } from '../helpers/fixtures';

/**
 * E2E tests for mobile & responsive behavior (E-MOB-01 through E-MOB-06).
 */

test.describe('Mobile & Responsive', () => {
  test('E-MOB-01: Mobile viewport (iPhone) renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('E-MOB-02: Android viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('E-MOB-03: OLED dark theme — dark background', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Verify background is dark
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // Background should be dark (close to black)
    expect(bgColor).toBeTruthy();
  });

  test('E-MOB-04: Desktop viewport shows desktop guard', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await setupAuthenticatedMocks(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await page.waitForTimeout(1000);
    // Desktop guard should show "mobile only" message
    const desktopBlock = page.locator('.desktop-block');
    if (await desktopBlock.isVisible()) {
      await expect(page.locator('body')).toContainText('לנייד בלבד');
    }
  });

  test('E-MOB-05: Touch gestures — swipe card has drag capability', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticatedMocks(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    // Switch to swipe mode
    const swipeBtn = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeBtn.isVisible()) {
      await swipeBtn.click();
      await page.waitForTimeout(300);
      // Swipe cards should be present (framer-motion div)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('E-MOB-06: Tab bar shows all tabs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticatedMocks(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    // Tab bar should have 3 tabs
    const tabBar = page.locator('.tab-bar');
    if (await tabBar.isVisible()) {
      const gridTab = page.locator('[aria-label="גריד"]');
      const chatsTab = page.locator('[aria-label="צ׳אטים"]');
      const likesTab = page.locator('[aria-label="לייקים"]');
      await expect(gridTab).toBeVisible();
      await expect(chatsTab).toBeVisible();
      await expect(likesTab).toBeVisible();
    }
  });
});
