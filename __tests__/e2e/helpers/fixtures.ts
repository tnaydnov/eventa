import { test as base, type Page, type Route } from '@playwright/test';

/* ─────── Valid v4 UUIDs for test data ─────── */
export const TEST_EVENT_ID = '10000000-1000-4000-8000-100000000001';
export const TEST_PARTICIPANT_ID = '10000000-1000-4000-8000-200000000001';
export const TEST_PARTICIPANT_ID_2 = '10000000-1000-4000-8000-200000000002';
export const TEST_PARTICIPANT_ID_3 = '10000000-1000-4000-8000-200000000003';
export const TEST_CONVERSATION_ID = '10000000-1000-4000-8000-300000000001';
export const TEST_MESSAGE_ID = '10000000-1000-4000-8000-500000000001';
export const TEST_LIKE_ID = '10000000-1000-4000-8000-600000000001';
export const TEST_EVENT_SLUG = 'test-wedding-e2e';
export const TEST_EVENT_NAME = 'חתונה - טסט';
export const TEST_JOIN_CODE = 'abc123';

/* ─────── Session cookie value (fake JWT) ─────── */
export const FAKE_SESSION_COOKIE = 'ws_session=eyJ0eXAiOiJzZXNzaW9uIiwiYWxnIjoiSFMyNTYifQ.test.test';
export const FAKE_ADMIN_COOKIE = 'ws_admin=eyJ0eXAiOiJhZG1pbiIsImFsZyI6IkhTMjU2In0.test.test';

/* ─────── Mock participant data ─────── */
export const mockParticipant = {
  id: TEST_PARTICIPANT_ID,
  event_id: TEST_EVENT_ID,
  display_name: 'טסט משתמש',
  gender: 'male',
  attracted_to: 'women',
  age: 25,
  bio: 'ביו לדוגמה',
  city: 'תל אביב',
  looking_for: 'relationship',
  is_banned: false,
  profile_complete: true,
  created_at: '2025-01-01T00:00:00Z',
};

export const mockParticipant2 = {
  id: TEST_PARTICIPANT_ID_2,
  event_id: TEST_EVENT_ID,
  display_name: 'משתמשת טסט',
  gender: 'female',
  attracted_to: 'men',
  age: 23,
  bio: 'ביו שנייה',
  city: 'חיפה',
  looking_for: 'relationship',
  is_banned: false,
  profile_complete: true,
  created_at: '2025-01-01T00:00:00Z',
};

export const mockParticipant3 = {
  id: TEST_PARTICIPANT_ID_3,
  event_id: TEST_EVENT_ID,
  display_name: 'משתמש שלישי',
  gender: 'male',
  attracted_to: 'women',
  age: 28,
  bio: 'ביו שלישית',
  city: 'ירושלים',
  looking_for: 'fun',
  is_banned: false,
  profile_complete: true,
  created_at: '2025-01-01T00:00:00Z',
};

export const mockIncompleteParticipant = {
  ...mockParticipant,
  profile_complete: false,
  display_name: null,
  gender: null,
  age: null,
  attracted_to: null,
  looking_for: null,
};

/* ─────── Mock event data ─────── */
export const mockEvent = {
  id: TEST_EVENT_ID,
  slug: TEST_EVENT_SLUG,
  name: TEST_EVENT_NAME,
  join_code: TEST_JOIN_CODE,
  event_type: 'dating',
  status: 'active',
  is_active: true,
  starts_at: '2025-06-01T10:00:00Z',
  ends_at: '2025-06-30T22:00:00Z',
  background_image: null,
};

/* ─────── Mock photos ─────── */
export const mockPhotos = [
  {
    id: '10000000-1000-4000-8000-400000000001',
    participant_id: TEST_PARTICIPANT_ID,
    storage_path: `${TEST_EVENT_ID}/${TEST_PARTICIPANT_ID}/photo1.jpg`,
    photo_url: 'https://storage.example.com/photos/photo1.jpg',
    position: 0,
  },
];

export const mockPhotos2 = [
  {
    id: '10000000-1000-4000-8000-400000000002',
    participant_id: TEST_PARTICIPANT_ID_2,
    storage_path: `${TEST_EVENT_ID}/${TEST_PARTICIPANT_ID_2}/photo2.jpg`,
    photo_url: 'https://storage.example.com/photos/photo2.jpg',
    position: 0,
  },
];

export const mockMultiplePhotos = [
  { ...mockPhotos[0] },
  {
    id: '10000000-1000-4000-8000-400000000003',
    participant_id: TEST_PARTICIPANT_ID,
    storage_path: `${TEST_EVENT_ID}/${TEST_PARTICIPANT_ID}/photo2.jpg`,
    photo_url: 'https://storage.example.com/photos/photo-b.jpg',
    position: 1,
  },
  {
    id: '10000000-1000-4000-8000-400000000004',
    participant_id: TEST_PARTICIPANT_ID,
    storage_path: `${TEST_EVENT_ID}/${TEST_PARTICIPANT_ID}/photo3.jpg`,
    photo_url: 'https://storage.example.com/photos/photo-c.jpg',
    position: 2,
  },
];

/* ─────── Mock conversation/message data ─────── */
export const mockConversation = {
  id: TEST_CONVERSATION_ID,
  participant_a: TEST_PARTICIPANT_ID,
  participant_b: TEST_PARTICIPANT_ID_2,
  event_id: TEST_EVENT_ID,
  last_message_at: '2025-06-15T14:30:00Z',
  created_at: '2025-06-15T10:00:00Z',
  other_name: 'משתמשת טסט',
  other_photo: 'https://storage.example.com/photos/photo2.jpg',
  last_message: 'היי, מה נשמע?',
  unread_count: 1,
};

export const mockMessages = [
  {
    id: TEST_MESSAGE_ID,
    conversation_id: TEST_CONVERSATION_ID,
    sender_id: TEST_PARTICIPANT_ID_2,
    content: 'היי, מה נשמע?',
    is_image: false,
    is_deleted: false,
    created_at: '2025-06-15T14:30:00Z',
  },
  {
    id: '10000000-1000-4000-8000-500000000002',
    conversation_id: TEST_CONVERSATION_ID,
    sender_id: TEST_PARTICIPANT_ID,
    content: 'היי! הכל טוב ואצלך?',
    is_image: false,
    is_deleted: false,
    created_at: '2025-06-15T14:31:00Z',
  },
];

/* ─────── Mock likes data ─────── */
export const mockReceivedLike = {
  id: TEST_LIKE_ID,
  liker_id: TEST_PARTICIPANT_ID_2,
  liked_id: TEST_PARTICIPANT_ID,
  event_id: TEST_EVENT_ID,
  seen: false,
  created_at: '2025-06-15T12:00:00Z',
  liker_name: 'משתמשת טסט',
  liker_photo: 'https://storage.example.com/photos/photo2.jpg',
};

export const mockSentLike = {
  id: '10000000-1000-4000-8000-600000000002',
  liker_id: TEST_PARTICIPANT_ID,
  liked_id: TEST_PARTICIPANT_ID_2,
  event_id: TEST_EVENT_ID,
  seen: true,
  created_at: '2025-06-15T11:00:00Z',
  liked_name: 'משתמשת טסט',
  liked_photo: 'https://storage.example.com/photos/photo2.jpg',
};

export const mockMatch = {
  id: '10000000-1000-4000-8000-600000000003',
  participant_id: TEST_PARTICIPANT_ID_2,
  display_name: 'משתמשת טסט',
  photo_url: 'https://storage.example.com/photos/photo2.jpg',
  matched_at: '2025-06-15T13:00:00Z',
};

/* ─────── Phone & messaging mock data ─────── */
export const TEST_PORTAL_TOKEN = 'ptk456';
export const TEST_GUEST_PHONE_ID = '10000000-1000-4000-8000-700000000001';

export const mockGuestPhone = {
  id: TEST_GUEST_PHONE_ID,
  event_id: TEST_EVENT_ID,
  phone_e164: '+972501234567',
  name: 'ישראל ישראלי',
  source: 'manual' as const,
  wa_sent: false,
  feedback_sent: false,
  created_at: '2025-06-01T08:00:00Z',
};

export const mockPortalData = {
  event: {
    id: TEST_EVENT_ID,
    name: TEST_EVENT_NAME,
    slug: TEST_EVENT_SLUG,
    starts_at: '2025-06-01T10:00:00Z',
    ends_at: '2025-06-01T22:00:00Z',
    status: 'active',
  },
  guests: [mockGuestPhone],
  totalGuests: 1,
  waEnabled: true,
  preSent: false,
};

export const mockMessagingOverview = {
  wa_enabled: true,
  portal_token: TEST_PORTAL_TOKEN,
  pre_event_sent: false,
  feedback_sent: false,
  guest_count: 1,
  pre_event_timing_hours: 2,
  message_log: [] as Array<{ id: string; channel: string; type: string; status: string; created_at: string; error: string | null }>,
};

/* ─────── Admin mock data ─────── */
export const mockAdminStats = {
  participants: 10,
  conversations: 5,
  likes: 20,
  messages: 50,
  blocks: 2,
};

export const mockAdminParticipants = [
  { ...mockParticipant, photo_url: 'https://storage.example.com/photos/photo1.jpg' },
  { ...mockParticipant2, photo_url: 'https://storage.example.com/photos/photo2.jpg' },
];

/* ─────── API route mocking helpers ─────── */

/**
 * Mock the verify endpoint to return a valid session.
 */
export async function mockVerifySession(page: Page) {
  await page.route('**/api/auth/verify', async (route) => {
    if (route.request().method() === 'GET') {
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
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
  });
}

/**
 * Mock the profile API to return participant data.
 */
export async function mockProfileAPI(page: Page) {
  await page.route('**/api/secure/profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participant: mockParticipant }),
      });
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participant: mockParticipant }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the photos API.
 */
export async function mockPhotosAPI(page: Page) {
  await page.route('**/api/secure/photos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ photos: mockPhotos }),
    });
  });
}

/**
 * Mock the grid API (participants list).
 */
export async function mockGridAPI(page: Page) {
  await page.route('**/api/secure/grid**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        participants: [mockParticipant2],
        photoMap: {
          [TEST_PARTICIPANT_ID_2]: 'https://storage.example.com/photos/photo2.jpg',
        },
      }),
    });
  });
}

/**
 * Mock conversations API.
 */
export async function mockConversationsAPI(page: Page) {
  await page.route('**/api/secure/conversations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
}

/**
 * Mock likes API.
 */
export async function mockLikesAPI(page: Page) {
  await page.route('**/api/secure/likes**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ received: [], sent: [], matches: [] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

/**
 * Mock blocks API.
 */
export async function mockBlocksAPI(page: Page) {
  await page.route('**/api/secure/blocks**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ blocks: [] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

/**
 * Mock matches API.
 */
export async function mockMatchesAPI(page: Page) {
  await page.route('**/api/secure/matches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ matches: [] }),
    });
  });
}

/**
 * Set up session cookie so pages think the user is logged in.
 */
export async function setSessionCookie(page: Page) {
  await page.context().addCookies([
    {
      name: 'ws_session',
      value: 'eyJ0eXAiOiJzZXNzaW9uIiwiYWxnIjoiSFMyNTYifQ.test.test',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Set up admin cookie.
 */
export async function setAdminCookie(page: Page) {
  await page.context().addCookies([
    {
      name: 'ws_admin',
      value: 'eyJ0eXAiOiJhZG1pbiIsImFsZyI6IkhTMjU2In0.test.test',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Set up all common API mocks for authenticated user pages.
 */
export async function setupAuthenticatedMocks(page: Page) {
  await setSessionCookie(page);
  await mockVerifySession(page);
  await mockProfileAPI(page);
  await mockPhotosAPI(page);
  await mockGridAPI(page);
  await mockConversationsAPI(page);
  await mockLikesAPI(page);
  await mockBlocksAPI(page);
  await mockMatchesAPI(page);

  // Mock Supabase realtime connection
  await page.route('**/realtime/**', async (route) => {
    await route.abort();
  });
}

/**
 * Navigate to an event page with session.
 */
export async function navigateToEvent(page: Page, path = '') {
  await setupAuthenticatedMocks(page);
  await page.goto(`/dating/${TEST_EVENT_SLUG}${path}`);
}

/**
 * Mock conversations with data.
 */
export async function mockConversationsWithData(page: Page) {
  await page.route('**/api/secure/conversations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [mockConversation] }),
    });
  });
}

/**
 * Mock messages API for a conversation.
 */
export async function mockMessagesAPI(page: Page) {
  await page.route('**/api/secure/messages**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: mockMessages, hasMore: false }),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock likes with data (received, sent, matches).
 */
export async function mockLikesWithData(page: Page) {
  await page.route('**/api/secure/likes**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          received: [mockReceivedLike],
          sent: [mockSentLike],
          matches: [mockMatch],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

/**
 * Mock user profile view API (for viewing another user).
 */
export async function mockUserProfileAPI(page: Page) {
  await page.route('**/api/secure/profile/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        participant: mockParticipant2,
        photos: mockPhotos2,
        hasLiked: false,
      }),
    });
  });
}

/**
 * Setup authenticated mocks for admin with event data.
 */
export async function setupAdminMocks(page: Page) {
  await setAdminCookie(page);

  await page.route('**/api/admin/events', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [mockEvent] }),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ event: mockEvent }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(`**/api/admin/events/${TEST_EVENT_ID}**`, async (route) => {
    const url = route.request().url();
    if (url.includes('/stats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminStats),
      });
    } else if (url.includes('/participants')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participants: mockAdminParticipants }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ event: mockEvent }),
      });
    }
  });

  await page.route('**/api/admin/analytics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalParticipants: 50,
        totalEvents: 3,
        totalLikes: 120,
        totalMatches: 25,
        totalMessages: 300,
        totalBlocks: 8,
      }),
    });
  });
}

// Re-export base test
export { base as test };

/* ─────── Phone join flow helpers ─────── */

/**
 * Mock event-status endpoint to return active event.
 */
export async function mockEventStatus(page: Page, status: string = 'active') {
  await page.route('**/api/auth/event-status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status, slug: TEST_EVENT_SLUG }),
    });
  });
}

/**
 * Mock send-otp endpoint to return success.
 */
export async function mockSendOtp(page: Page, response?: { success: boolean; maskedPhone?: string; error?: string }) {
  const body = response ?? { success: true, maskedPhone: '050-***4567' };
  await page.route('**/api/auth/send-otp', async (route) => {
    await route.fulfill({
      status: body.success ? 200 : 400,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Mock verify-otp endpoint to return success with session.
 */
export async function mockVerifyOtp(page: Page, response?: Record<string, unknown>) {
  const body = response ?? {
    eventId: TEST_EVENT_ID,
    eventName: TEST_EVENT_NAME,
    backgroundImage: null,
    participantId: TEST_PARTICIPANT_ID,
    participant: mockParticipant,
  };
  await page.route('**/api/auth/verify-otp', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': 'ws_session=fake-jwt; Path=/; HttpOnly',
      },
      body: JSON.stringify(body),
    });
  });
}

/**
 * Set up mocks for the guest upload portal.
 */
export async function setupPortalMocks(page: Page, portalData?: Record<string, unknown>) {
  const data = portalData ?? mockPortalData;

  await page.route('**/api/guest-portal/**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (url.includes('/download-template')) {
      // Template download
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('fake-xlsx-data'),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, added: 5, duplicates: 0, errors: [] }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Set up admin mocks with messaging support.
 */
export async function setupAdminMessagingMocks(page: Page) {
  await setupAdminMocks(page);

  await page.route(`**/api/admin/events/${TEST_EVENT_ID}/messaging**`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMessagingOverview),
      });
    } else if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sent: 5 }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(`**/api/admin/events/${TEST_EVENT_ID}/guests**`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ guests: [mockGuestPhone], total: 1 }),
      });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, added: 1, duplicates: 0 }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(`**/api/admin/events/${TEST_EVENT_ID}/portal-token**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: TEST_PORTAL_TOKEN }),
    });
  });

  await page.route('**/api/admin/requests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ requests: [] }),
    });
  });

  await page.route('**/api/admin/send-email**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}
