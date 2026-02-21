import { test, expect } from '@playwright/test';

/**
 * E2E tests for event unavailable flow (E-EU-01 through E-EU-03).
 */

test.describe('Event Unavailable', () => {
  test('E-EU-01: Ended event shows unavailable page', async ({ page }) => {
    await page.goto('/dating/test-event/unavailable?reason=ended');
    await expect(page.locator('body')).toContainText('האירוע הסתיים');
  });

  test('E-EU-02: Paused event shows message', async ({ page }) => {
    await page.goto('/dating/test-event/unavailable?reason=paused');
    await expect(page.locator('body')).toContainText('האירוע מושהה');
  });

  test('E-EU-03: Archived event shows unavailable', async ({ page }) => {
    await page.goto('/dating/test-event/unavailable?reason=archived');
    await expect(page.locator('body')).toContainText('האירוע הסתיים');
  });
});
