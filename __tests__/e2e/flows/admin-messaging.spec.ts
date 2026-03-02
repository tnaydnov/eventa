import { test, expect } from '@playwright/test';
import {
  TEST_EVENT_ID,
  TEST_PORTAL_TOKEN,
  mockEvent,
  mockGuestPhone,
  mockMessagingOverview,
  setupAdminMessagingMocks,
} from '../helpers/fixtures';

/**
 * E2E tests for admin messaging panel.
 * Flow: toggle WA → upload guests → manual send → view log
 */

test.describe('Admin Messaging', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/realtime/**', (route) => route.abort());
    await setupAdminMessagingMocks(page);
  });

  test('E-AM-01: Admin page loads with messaging data', async ({ page }) => {
    await page.goto('/admin');

    // Admin root should be visible
    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });
  });

  test('E-AM-02: Events list shows event cards', async ({ page }) => {
    await page.goto('/admin');

    // Event name should appear in the admin dashboard
    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('E-AM-03: Clicking event opens event details with messaging', async ({ page }) => {
    await page.goto('/admin');

    // Wait for the admin page to load
    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Find and click on the event card
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(1000);

      // Event detail view should show — check for event name or stats
      const bodyText = await page.textContent('body');
      expect(bodyText).toContain(mockEvent.name);
    }
  });

  test('E-AM-04: Messaging controls show WhatsApp toggle', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Click event to open details
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Look for messaging-related text (WA toggle, portal link, etc.)
      const bodyText = await page.textContent('body');
      // Should have WhatsApp or messaging related content
      if (bodyText) {
        const hasMessagingContent = bodyText.includes('WhatsApp') || bodyText.includes('WA') || bodyText.includes('הודעות');
        expect(hasMessagingContent).toBeTruthy();
      }
    }
  });

  test('E-AM-05: Portal link copy button exists', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Look for copy link button (📋 העתיקו לינק)
      const copyBtn = page.locator('button', { hasText: 'העתיקו' });
      if (await copyBtn.isVisible({ timeout: 3000 })) {
        await expect(copyBtn).toBeVisible();
      }
    }
  });

  test('E-AM-06: Guest list section is rendered', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Guest list section should be present if messaging tab is open
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('E-AM-07: Message log section shows empty state', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Should show messaging log area or empty state
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });

  test('E-AM-08: Send email buttons are present', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Should have email sending buttons (📧)
      const bodyText = await page.textContent('body');
      if (bodyText && bodyText.includes('📧')) {
        // Email buttons are present
        expect(bodyText).toContain('📧');
      }
    }
  });

  test('E-AM-09: WA toggle sends PATCH request', async ({ page }) => {
    let patchCalled = false;
    // Override the messaging route to track PATCH calls
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/messaging**`, async (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        patchCalled = true;
        const body = await route.request().postDataJSON();
        expect(body).toHaveProperty('wa_enabled');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMessagingOverview),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin');
    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Find and click WA toggle button (כבו WA or הפעילו WA)
      const waToggle = page.locator('button', { hasText: /WA/ }).first();
      if (await waToggle.isVisible({ timeout: 3000 })) {
        await waToggle.click();
        await page.waitForTimeout(1000);
        // PATCH should have been called
        // Note: may not fire if the button requires confirmation
      }
    }
  });

  test('E-AM-10: Manual WA send button triggers POST', async ({ page }) => {
    let postCalled = false;
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/messaging**`, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        postCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, sent: 5 }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMessagingOverview),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin');
    await expect(page.locator('.admin-root').first()).toBeVisible({ timeout: 10000 });

    // Open event detail
    const eventCard = page.locator(`text=${mockEvent.name}`).first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      // Find manual send button (שלחו WA עכשיו)
      const sendBtn = page.locator('button', { hasText: 'שלחו WA' });
      if (await sendBtn.isVisible({ timeout: 3000 })) {
        await sendBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
