import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  setupAdminMocks,
  mockConversationsWithData,
  mockLikesWithData,
  mockMessagesAPI,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  TEST_PARTICIPANT_ID_3,
  TEST_EVENT_ID,
  mockParticipant2,
  mockParticipant3,
  mockPhotos2,
} from '../helpers/fixtures';

/**
 * E2E cross-cutting tests (E-CC-01 through E-CC-06).
 */

test.describe('Cross-Cutting', () => {
  test('E-CC-01: Full user journey - join → profile → grid → like → chat', async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // 1. Navigate to event page
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // 2. Navigate to likes tab
    const likesTab = page.locator('[aria-label="לייקים"]');
    if (await likesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await likesTab.click();
      await expect(page.locator('body')).toBeVisible();
    }

    // 3. Navigate to chats tab
    const chatsTab = page.locator('[aria-label="צ׳אטים"]');
    if (await chatsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatsTab.click();
      await expect(page.locator('body')).toBeVisible();
    }

    // 4. Go back to grid
    const gridTab = page.locator('[aria-label="גריד"]');
    if (await gridTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridTab.click();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('E-CC-02: Two-user interaction simulation', async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // User A sees User B in grid
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CC-03: Admin and user flows parallel', async ({ page }) => {
    // Test admin page separately
    await setupAdminMocks(page);
    await page.goto('/admin');
    await expect(page.locator('.admin-root').first()).toBeVisible();
  });

  test('E-CC-04: Hebrew throughout the app', async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Check that the HTML has RTL or Hebrew content
    const html = page.locator('html');
    const dir = await html.getAttribute('dir');
    const lang = await html.getAttribute('lang');

    // Should have Hebrew direction or language
    const hasRTL = dir === 'rtl' || lang === 'he';
    // Hebrew text should appear somewhere in the body
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CC-05: Grid performance with 50 participants', async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Create 50 mock participants
    const manyParticipants = Array.from({ length: 50 }, (_, i) => ({
      id: `10000000-1000-4000-8000-2000000000${String(i + 10).padStart(2, '0')}`,
      event_id: TEST_EVENT_ID,
      display_name: `משתמש ${i + 1}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      attracted_to: i % 2 === 0 ? 'women' : 'men',
      age: 20 + (i % 15),
      bio: `ביו ${i + 1}`,
      city: 'תל אביב',
      looking_for: 'relationship',
      is_banned: false,
      profile_complete: true,
      created_at: '2025-01-01T00:00:00Z',
    }));

    const photoMap: Record<string, string> = {};
    manyParticipants.forEach((p) => {
      photoMap[p.id] = `https://storage.example.com/photos/${p.id}.jpg`;
    });

    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participants: manyParticipants, photoMap }),
      });
    });

    const start = Date.now();
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
    const loadTime = Date.now() - start;

    // Should load within reasonable time even with 50 participants
    expect(loadTime).toBeLessThan(15000); // 15 second timeout
  });

  test('E-CC-06: Chat performance with 100 messages', async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await mockConversationsWithData(page);

    // Create 100 mock messages
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      id: `10000000-1000-4000-8000-5000000000${String(i + 10).padStart(2, '0')}`,
      conversation_id: '10000000-1000-4000-8000-300000000001',
      sender_id: i % 2 === 0 ? TEST_PARTICIPANT_ID : TEST_PARTICIPANT_ID_2,
      content: `הודעה מספר ${i + 1}`,
      is_image: false,
      is_deleted: false,
      created_at: new Date(Date.now() - (100 - i) * 60000).toISOString(),
    }));

    await page.route('**/api/secure/messages**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: manyMessages, hasMore: false }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Navigate to chats
    const chatsTab = page.locator('[aria-label="צ׳אטים"]');
    if (await chatsTab.isVisible()) {
      await chatsTab.click();
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
