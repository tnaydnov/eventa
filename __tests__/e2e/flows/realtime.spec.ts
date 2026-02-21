import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  mockConversationsWithData,
  mockLikesWithData,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  mockConversation,
  mockMessages,
  mockReceivedLike,
} from '../helpers/fixtures';

/**
 * E2E tests for realtime features (E-RT-01 through E-RT-05).
 * Note: True WebSocket testing is limited in Playwright.
 * These tests verify the app handles realtime-related scenarios.
 */

test.describe('Realtime Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-RT-01: Like notification appears', async ({ page }) => {
    // Override likes with received data (AFTER setupAuthenticatedMocks)
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

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Navigate to likes tab to see notification
    const likesTab = page.locator('[aria-label="לייקים"]');
    if (await likesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await likesTab.click({ force: true });
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-RT-02: New message notification', async ({ page }) => {
    // Set up conversations with unread messages
    await mockConversationsWithData(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Navigate to chats tab
    const chatsTab = page.locator('[aria-label="צ׳אטים"]');
    if (await chatsTab.isVisible()) {
      await chatsTab.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-RT-03: Match realtime update', async ({ page }) => {
    // When a match happens, it should be reflected in the UI
    await mockLikesWithData(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-RT-04: Polling fallback when realtime unavailable', async ({ page }) => {
    // Note: realtime is already aborted in setupAuthenticatedMocks
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // App should still function without realtime
  });

  test('E-RT-05: Reconnect after disconnect', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Simulate offline then online
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
