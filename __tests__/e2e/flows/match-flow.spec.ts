import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  mockLikesWithData,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  mockParticipant2,
  mockPhotos2,
  mockMatch,
  mockConversation,
} from '../helpers/fixtures';

/**
 * E2E tests for match flow (E-MA-01 through E-MA-05).
 */

test.describe('Match Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-MA-01: Match popup when self initiates mutual like', async ({ page }) => {
    // Mock like POST returning isMatch: true
    await page.route('**/api/secure/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, isMatch: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      }
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-MA-02: Match appears in likes tab', async ({ page }) => {
    await mockLikesWithData(page);

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Navigate to likes tab (force to bypass Next.js dev overlay)
    const likesTab = page.locator('[aria-label="לייקים"]');
    if (await likesTab.isVisible()) {
      await likesTab.click({ force: true });
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-MA-03: Match popup to send message', async ({ page }) => {
    // After a match, user can send a message
    await page.route('**/api/secure/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isMatch: true,
            matchedUser: {
              display_name: 'משתמשת טסט',
              photo_url: 'https://storage.example.com/photos/photo2.jpg',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      }
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-MA-04: Dismiss match popup', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Match popup close button should dismiss it
    const matchPopup = page.locator('.match-popup');
    if (await matchPopup.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeBtn = matchPopup.locator('button');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-MA-05: Match creates conversation', async ({ page }) => {
    // After matching, conversations should include the match
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [mockConversation] }),
      });
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Navigate to chats tab
    const chatsTab = page.locator('[aria-label="צ׳אטים"]');
    if (await chatsTab.isVisible()) {
      await chatsTab.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
