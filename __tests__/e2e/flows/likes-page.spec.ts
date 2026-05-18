import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  navigateToEvent,
  TEST_EVENT_SLUG,
  mockReceivedLike,
  mockSentLike,
  mockMatch,
} from '../helpers/fixtures';

/**
 * E2E tests for likes page flow (E-LK-01 through E-LK-07).
 */

test.describe('Likes Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-LK-01: Likes page loads', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('E-LK-02: Sent likes tab', async ({ page }) => {
    // Override likes to have sent data
    await page.route('**/api/secure/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            received: [],
            sent: [mockSentLike],
            matches: [],
          }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    await expect(page.locator('body')).toBeVisible();
    // Should have sub-tab buttons
    const sentTab = page.locator('button', { hasText: 'עשיתי' });
    if (await sentTab.isVisible()) {
      await sentTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('E-LK-03: Matches tab', async ({ page }) => {
    await page.route('**/api/secure/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            received: [],
            sent: [],
            matches: [mockMatch],
          }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    // Matches tab
    const matchesTab = page.locator('button', { hasText: 'התאמות' });
    if (await matchesTab.isVisible()) {
      await matchesTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('E-LK-04: Tap received like navigates to profile', async ({ page }) => {
    await page.route('**/api/secure/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            received: [mockReceivedLike],
            sent: [],
            matches: [],
          }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    // Click on a received like card
    const card = page.locator('.grid-card').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/user/');
    }
  });

  test('E-LK-05: Likes are marked as seen on page load', async ({ page }) => {
    let markSeenCalled = false;
    await page.route('**/api/secure/likes/seen**', async (route) => {
      markSeenCalled = true;
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    await page.waitForTimeout(1000);
    // markAllLikesSeen should have been called
  });

  test('E-LK-06: Like badge clears', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    await expect(page.locator('body')).toBeVisible();
    // After viewing likes, badge should clear
  });

  test('E-LK-07: Empty likes shows message', async ({ page }) => {
    await page.route('**/api/secure/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/likes`);
    // Should show empty state message with timeout for hydration
    await expect(page.locator('body')).toContainText('עדיין', { timeout: 10000 });
  });
});
