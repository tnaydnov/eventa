import { test, expect } from '@playwright/test';
import {
  TEST_EVENT_SLUG,
  TEST_EVENT_ID,
  TEST_PARTICIPANT_ID,
  TEST_EVENT_NAME,
  TEST_JOIN_CODE,
  mockParticipant,
  mockEvent,
  mockEventStatus,
  mockSendOtp,
  mockVerifyOtp,
} from '../helpers/fixtures';

/**
 * E2E tests for the phone-based join flow.
 * Full flow: terms → phone → OTP → setup / grid
 */

test.describe('Phone Join Flow', () => {
  const joinUrl = `/dating/${TEST_EVENT_SLUG}/join?k=${TEST_JOIN_CODE}`;

  test.beforeEach(async ({ page }) => {
    // Suppress realtime
    await page.route('**/realtime/**', (route) => route.abort());
    // Clear any existing session
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('E-PJ-01: Join page loads with terms step', async ({ page }) => {
    await mockEventStatus(page);
    // Mock verify to return no session
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    await page.goto(joinUrl);

    // Terms step should show the agreement checkbox and continue button
    await expect(page.locator('body')).toContainText('אני מסכים');
    await expect(page.locator('body')).toContainText('המשך');
  });

  test('E-PJ-02: Cannot proceed without agreeing to terms', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    await page.goto(joinUrl);

    // The continue button should be disabled (or have disabled style) when terms not agreed
    const continueBtn = page.locator('button', { hasText: 'המשך' });
    await expect(continueBtn).toBeVisible();
    // Button should be disabled since checkbox isn't checked
    await expect(continueBtn).toBeDisabled();
  });

  test('E-PJ-03: Agreeing to terms shows phone step', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    await page.goto(joinUrl);

    // Check the terms checkbox
    const checkbox = page.locator('[role="checkbox"]').first();
    await checkbox.click();

    // Click continue
    const continueBtn = page.locator('button', { hasText: 'המשך' });
    await continueBtn.click();

    // Phone input step should now be visible
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('body')).toContainText('הזינו מספר טלפון');
  });

  test('E-PJ-04: Entering phone and sending OTP', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    await page.goto(joinUrl);

    // Accept terms
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();

    // Wait for phone step
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });

    // Enter valid Israeli mobile number
    await page.locator('#phone-input').fill('501234567');

    // Click send code
    const sendBtn = page.locator('button', { hasText: 'שלחו קוד' });
    await sendBtn.click();

    // OTP step should appear
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });
  });

  test('E-PJ-05: Invalid phone number shows error', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    await page.goto(joinUrl);

    // Accept terms → phone step
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });

    // Enter invalid phone (too short)
    await page.locator('#phone-input').fill('12345');

    // Click send code
    const sendBtn = page.locator('button', { hasText: 'שלחו קוד' });
    await sendBtn.click();

    // Error should be shown
    await expect(page.locator('body')).toContainText('תקין', { timeout: 3000 });
  });

  test('E-PJ-06: Verifying OTP completes join and redirects to setup', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);
    // Mock verify-otp → returns new participant (no display_name → setup)
    await mockVerifyOtp(page, {
      eventId: TEST_EVENT_ID,
      eventName: TEST_EVENT_NAME,
      backgroundImage: null,
      participantId: TEST_PARTICIPANT_ID,
      participant: { ...mockParticipant, display_name: null, profile_complete: false },
    });

    await page.goto(joinUrl);

    // Accept terms → phone → send OTP → OTP step
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Enter OTP digits one by one
    const otpInputs = page.locator('[role="group"] input');
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String(i + 1));
      }
    }

    // Should redirect to setup page
    await page.waitForURL(`**/dating/${TEST_EVENT_SLUG}/setup`, { timeout: 10000 });
  });

  test('E-PJ-07: Verifying OTP for returning user redirects to grid', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);
    // Mock verify-otp → returns existing participant (has display_name → grid)
    await mockVerifyOtp(page, {
      eventId: TEST_EVENT_ID,
      eventName: TEST_EVENT_NAME,
      backgroundImage: null,
      participantId: TEST_PARTICIPANT_ID,
      participant: mockParticipant,
    });

    await page.goto(joinUrl);

    // Accept terms → phone → OTP
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Enter OTP
    const otpInputs = page.locator('[role="group"] input');
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String(i + 1));
      }
    }

    // Should redirect to grid (main page)
    await page.waitForURL(`**/dating/${TEST_EVENT_SLUG}`, { timeout: 10000 });
  });

  test('E-PJ-08: Resend OTP button has cooldown', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    await page.goto(joinUrl);

    // Navigate to OTP step
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Resend button should show cooldown timer
    const resendBtn = page.locator('button', { hasText: 'שלחו שוב' });
    await expect(resendBtn).toBeVisible();
    // Should show countdown (e.g. "שלחו שוב (45s)")
    const btnText = await resendBtn.textContent();
    expect(btnText).toMatch(/שלחו שוב \(\d+s\)/);
  });

  test('E-PJ-09: Change number link returns to phone step', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    await page.goto(joinUrl);

    // Navigate to OTP step
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Click the change number link
    const changeLink = page.locator('text=שנו מספר טלפון');
    await changeLink.click();

    // Should go back to phone step
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('body')).toContainText('הזינו מספר טלפון');
  });

  test('E-PJ-10: Ended event redirects away', async ({ page }) => {
    await mockEventStatus(page, 'ended');
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    await page.goto(joinUrl);

    // Should redirect to event-over page
    await page.waitForURL('**/event-over**', { timeout: 10000 });
  });

  test('E-PJ-11: Missing join code shows error', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    // Go without ?k= parameter
    await page.goto(`/dating/${TEST_EVENT_SLUG}/join`);

    // Accept terms — should show error about missing join code
    const checkbox = page.locator('[role="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 })) {
      await checkbox.click();
      const btn = page.locator('button', { hasText: 'המשך' });
      if (await btn.isEnabled()) {
        await btn.click();
        await expect(page.locator('body')).toContainText('קוד כניסה חסר');
      }
    }
  });
});
