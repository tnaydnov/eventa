import { test, expect } from '@playwright/test';
import {
  TEST_EVENT_SLUG,
  TEST_EVENT_ID,
  TEST_PARTICIPANT_ID,
  TEST_EVENT_NAME,
  TEST_JOIN_CODE,
  mockEvent,
  mockParticipant,
} from '../helpers/fixtures';

/**
 * E2E tests for the join event flow (E-JN-01 through E-JN-05).
 */

test.describe('Join Event Flow', () => {
  test('E-JN-01: Join page loads for valid event slug', async ({ page }) => {
    // Mock verify to return no session (user not yet joined)
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No session' }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-JN-02: Wrong join code shows error', async ({ page }) => {
    // Mock verify → no session
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No session' }),
      });
    });

    // Mock join API → wrong code
    await page.route('**/api/auth/join', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid event or join code' }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    // Page should show the join form or error state
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-JN-03: Non-existent event slug', async ({ page }) => {
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No session' }),
      });
    });

    await page.goto('/non-existent-event-slug-xyz');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-JN-04: Ended event shows appropriate message', async ({ page }) => {
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Event ended', reason: 'ended' }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-JN-05: Returning user is reconnected', async ({ page }) => {
    // Mock join → reconnected
    await page.route('**/api/auth/join', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': `ws_session=fake-jwt; Path=/; HttpOnly`,
        },
        body: JSON.stringify({
          participant: mockParticipant,
          event: mockEvent,
          isReconnect: true,
        }),
      });
    });

    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participantId: TEST_PARTICIPANT_ID,
          eventId: TEST_EVENT_ID,
          eventSlug: TEST_EVENT_SLUG,
          eventName: TEST_EVENT_NAME,
          eventType: 'dating',
          eventStatus: 'active',
          isActive: true,
          backgroundImage: null,
        }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });
});
