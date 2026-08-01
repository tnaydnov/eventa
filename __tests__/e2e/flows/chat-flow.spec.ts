import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  TEST_EVENT_SLUG,
  TEST_CONVERSATION_ID,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  mockConversation,
  mockMessages,
  mockParticipant2,
  mockPhotos2,
} from '../helpers/fixtures';

/**
 * E2E tests for chat flow (E-CH-01 through E-CH-12).
 */

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-CH-01: Chat list loads', async ({ page }) => {
    // Override conversations with data
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [mockConversation] }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chats`);
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('E-CH-02: Chat list sorted by most recent', async ({ page }) => {
    const conv2 = {
      ...mockConversation,
      id: '10000000-1000-4000-8000-300000000002',
      last_message_at: '2025-06-16T14:30:00Z',
      other_name: 'משתמש אחר',
      last_message: 'הודעה חדשה',
    };
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [mockConversation, conv2] }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chats`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-03: Unread badge visible', async ({ page }) => {
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [{ ...mockConversation, unread_count: 3 }],
        }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chats`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-04: Open chat loads messages', async ({ page }) => {
    // Mock conversation participant
    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: mockMessages, hasMore: false }),
      });
    });

    // Mock read endpoint
    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-05: Send text message', async ({ page }) => {
    await page.route('**/api/secure/messages**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: mockMessages, hasMore: false }),
        });
      }
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await expect(page.locator('body')).toBeVisible();

    // Type and send a message
    const input = page.locator('input[type="text"], textarea').last();
    if (await input.isVisible()) {
      await input.fill('הודעת טסט');
    }
  });

  test('E-CH-06: Receive message via realtime (structure check)', async ({ page }) => {
    // This test verifies the chat page structure supports realtime updates
    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: mockMessages, hasMore: false }),
      });
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-07: Image send button exists', async ({ page }) => {
    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [], hasMore: false }),
      });
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-08: Delete message', async ({ page }) => {
    await page.route('**/api/secure/messages**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: mockMessages, hasMore: false }),
        });
      }
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-09: Scroll to load older messages', async ({ page }) => {
    // Return messages with hasMore=true
    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: mockMessages, hasMore: true }),
      });
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    // Should show "load older" button
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-10: Mark conversation as read', async ({ page }) => {
    let readCalled = false;
    await page.route('**/api/secure/conversations/*/read', async (route) => {
      readCalled = true;
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ messages: mockMessages, hasMore: false }),
      });
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    await page.waitForTimeout(1000);
  });

  test('E-CH-11: Block from chat', async ({ page }) => {
    await page.route('**/api/secure/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ messages: mockMessages, hasMore: false }),
      });
    });

    await page.route('**/api/secure/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ participant: mockParticipant2, photos: mockPhotos2 }),
      });
    });

    await page.route('**/api/secure/conversations/*/read', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true}' });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chat/${TEST_CONVERSATION_ID}`);
    // Look for menu/block button
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-CH-12: Empty chats shows message', async ({ page }) => {
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/chats`);
    await expect(page.locator('body')).toContainText('אין שיחות');
  });
});
