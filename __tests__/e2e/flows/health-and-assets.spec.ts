import { test, expect } from '@playwright/test';

/**
 * E2E tests for API health endpoint.
 */

test.describe('Health API', () => {
  test('Health endpoint responds', async ({ page }) => {
    const res = await page.goto('/api/health');
    // Health endpoint should respond (200 if DB up, 503 if down)
    expect(res?.status()).toBeDefined();
    expect([200, 503]).toContain(res?.status());
  });
});

/**
 * E2E tests for robots.txt and other static assets.
 */
test.describe('Static Assets', () => {
  test('robots.txt exists', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.status()).toBe(200);
  });
});
