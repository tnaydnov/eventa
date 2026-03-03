# Phone Verification & Messaging System - Complete Design Document

> **Date**: February 27, 2026  
> **Status**: Design (not yet implemented)

---

## Table of Contents

### Core Infrastructure (Sections 1–12)
1. [System Overview](#1-system-overview)
2. [User Flow Diagrams](#2-user-flow-diagrams)
3. [Database Changes](#3-database-changes)
4. [Environment Variables](#4-environment-variables)
5. [New File Structure](#5-new-file-structure)
6. [SMS Provider Integration (InforUMobile)](#6-sms-provider-integration-inforumobile)
7. [WhatsApp Business API Integration (360dialog)](#7-whatsapp-business-api-integration-360dialog)
8. [Messaging Service Abstraction Layer](#8-messaging-service-abstraction-layer)
9. [OTP System Design](#9-otp-system-design)
10. [API Route Changes](#10-api-route-changes)
11. [Client-Side Changes](#11-client-side-changes)
12. [Scheduled Messaging (Cron Jobs)](#12-scheduled-messaging-cron-jobs)

### Business Lifecycle (Sections 13–19)
13. [Admin Dashboard Changes - Overview](#13-admin-dashboard-changes)
14. [Security Considerations](#14-security-considerations)
15. [Data Privacy & Legal Compliance](#15-data-privacy--legal-compliance)
16. [Cost Model](#16-cost-model)
17. [Edge Cases & Error Handling](#17-edge-cases--error-handling)
18. [Migration Strategy](#18-migration-strategy)
19. [Testing Plan](#19-testing-plan)

### Purchase, Client Portal & Admin Full Control (Sections 20–26)
20. [Purchase & Onboarding Flow](#20-purchase--onboarding-flow)
21. [Client Guest Management Portal](#21-client-guest-management-portal)
22. [Email Lifecycle & Templates](#22-email-lifecycle--templates)
23. [Admin Dashboard - Full Integration](#23-admin-dashboard--full-integration)
24. [Data Retention & Discount Tracking](#24-data-retention--discount-tracking)
25. [Complete Message Content](#25-complete-message-content)
26. [Updated Summary](#26-updated-summary)

### Payment, Event Creation & Stub Architecture (Section 27)
27. [Purchase, Payment & Event Creation Lifecycle](#27-purchase-payment--event-creation-lifecycle)

### Pretty URLs & Link Reuse (Section 28)
28. [Pretty Event URLs & Slug Recycling](#28-pretty-event-urls--slug-recycling)

---

## 1. System Overview

### 1.1 What We're Building

A phone-based identity layer on top of the existing fingerprint + cookie session system. Phone number becomes the **ultimate fallback identity** - used only when cookies and fingerprints fail to reconnect a user to their participant record.

Additionally, a messaging system that sends:
- **OTP codes** via SMS (all events)
- **Pre-event reminders** via WhatsApp (premium feature, per event)
- **Welcome messages** via WhatsApp (if user didn't receive pre-event message)
- **Feedback + promo messages** via WhatsApp (opt-in, rides pre-event/welcome window)

### 1.2 Design Principles

1. **Phone is a fallback, not a gate** - existing cookie/fingerprint flow stays primary
2. **SMS for OTP always** - universally supported, no WhatsApp dependency for core auth
3. **WhatsApp for rich messages** - pre-event, welcome, feedback (high open rates matter)
4. **No code duplication** - single messaging abstraction layer handles both channels
5. **Per-number tracking** - welcome message skipped if pre-event was already sent to that number
6. **All config is dynamic** - no hardcoded phone numbers, messages, or provider URLs
7. **Graceful degradation** - if SMS/WA fails, the app still works (just without messages)

### 1.3 Identity Resolution Priority (Updated)

```
User visits → has session cookie?
  YES → verify JWT → session restored ✅
  NO  → has device_fingerprint in localStorage?
    YES → send to /api/auth/join → reconnect by fingerprint ✅
    NO  → has hardware_fingerprint?
      YES → send to /api/auth/join → reconnect by hardware FP ✅
      NO  → show phone verification screen
        → user enters phone + OTP
        → lookup participant by phone + event_id
          FOUND → reconnect (session cookie + fingerprints updated) ✅
          NOT FOUND → create new participant ✅
```

---

## 2. User Flow Diagrams

### 2.1 First-Time Join (New User)

```
┌────────────────────────────────────────────────────────────────────┐
│ User scans QR → /dating/[slug]/join?k=JOINCODE                    │
│                                                                    │
│  1. Show terms/privacy checkbox (existing)                         │
│  2. User agrees → show phone input (new)                           │
│     ┌──────────────────────────────────┐                           │
│     │  📱 הזינו מספר טלפון             │                           │
│     │  ┌────────────────────────────┐   │                           │
│     │  │ +972 ___-_______           │   │                           │
│     │  └────────────────────────────┘   │                           │
│     │  ☑ אני מסכים/ה לקבל הודעות       │                           │
│     │  [ שלחו קוד ]                     │                           │
│     └──────────────────────────────────┘                           │
│                                                                    │
│  3. POST /api/auth/send-otp { phone, eventSlug, joinCode }        │
│     → validate phone format                                        │
│     → validate event exists + join code correct                    │
│     → generate 6-digit OTP                                         │
│     → store OTP in otp_verifications table (5min TTL)              │
│     → send SMS via InforUMobile                                    │
│     → return { success: true, expiresIn: 300 }                    │
│                                                                    │
│  4. Show OTP input screen                                          │
│     ┌──────────────────────────────────┐                           │
│     │  הזינו את הקוד שקיבלתם          │                           │
│     │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ │                           │
│     │  │  │ │  │ │  │ │  │ │  │ │  │  │                           │
│     │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │                           │
│     │  [ אמתו ]         שלחו שוב (45s) │                           │
│     └──────────────────────────────────┘                           │
│                                                                    │
│  5. POST /api/auth/verify-otp { phone, code, eventSlug, joinCode, │
│                                  fingerprint, hardwareFingerprint } │
│     → validate OTP matches + not expired                           │
│     → mark OTP as used                                             │
│     → check if phone exists for this event                         │
│       NO → create new participant (with phone)                     │
│       YES → reconnect to existing participant                      │
│     → check ban status (phone + fingerprints)                      │
│     → sign session JWT                                             │
│     → set httpOnly cookie                                          │
│     → check if pre-event WA was sent to this phone                │
│       NO → queue welcome WhatsApp message                          │
│       YES → skip (already has link)                                │
│     → return session data                                          │
│                                                                    │
│  6. Redirect → /dating/[slug]/setup (new) or /dating/[slug] (existing) │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Returning User - Cache Intact (No Change)

```
┌────────────────────────────────────────────────────────────────────┐
│ User opens app → SessionProvider                                   │
│  1. Check session cookie → GET /api/auth/verify                    │
│     → cookie valid → session restored ✅                           │
│     → no phone involved at all                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Returning User - Cache Cleared

```
┌────────────────────────────────────────────────────────────────────┐
│ User opens app → no cookie, no localStorage                       │
│  1. SessionProvider verify fails → join page (/dating/[slug]/join) │
│  2. Join page: no fingerprint available                            │
│  3. Show phone input (same as first-time flow step 2-5)            │
│  4. POST /api/auth/verify-otp                                     │
│     → phone found for this event → reconnect                      │
│     → update fingerprints to current device                        │
│     → full session restored with all data intact ✅               │
│     → skip welcome message (already sent on first join)            │
└────────────────────────────────────────────────────────────────────┘
```

### 2.4 Pre-Event WhatsApp Flow (Premium Feature)

```
┌────────────────────────────────────────────────────────────────────┐
│ Admin enables "Guest Messages" for event + uploads guest list CSV  │
│                                                                    │
│ Cron job: /api/cron/pre-event-messages                            │
│ Runs hourly, checks for events starting in 2-3 hours              │
│                                                                    │
│  For each qualifying event with wa_messages_enabled = true:        │
│  1. Fetch guest phone list from event_guest_phones table           │
│  2. For each phone not yet messaged (wa_pre_event_sent = false):   │
│     → send WhatsApp Marketing template:                            │
│       "🎉 היי! בעוד כמה שעות מתחיל [event_name]!                  │
│        הכנסו לאפליקציה כדי ליצור קשר עם רווקים/ות:               │
│        https://eventa.productions/dating/[slug]/join?k=[code]"     │
│     → mark wa_pre_event_sent = true                                │
│     → mark wa_marketing_window_opened_at = now()                   │
│  3. Log results                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.5 Feedback Message Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ Cron job: /api/cron/feedback-messages                              │
│ Runs hourly, checks for events that ended in the last 1-6 hours   │
│                                                                    │
│  For each qualifying event:                                        │
│  1. Fetch participants with:                                       │
│     - phone IS NOT NULL                                            │
│     - sms_consent = true                                           │
│     - feedback_sent = false                                        │
│  2. For each participant:                                          │
│     → check if wa_marketing_window is still open (< 24h)          │
│       YES → send via WhatsApp (free, same window) ✅              │
│       NO  → skip (don't open new marketing window for feedback)   │
│     → send WhatsApp Marketing message:                             │
│       "תודה שהשתתפתם ב-[event_name]! 🎉                           │
│        נשמח לשמוע מכם:                                            │
│        [feedback_link]                                              │
│        קוד הנחה 10%: EVENTA10"                                     │
│     → mark feedback_sent = true                                    │
│  3. Log results                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Changes

### 3.1 Migration: `011_phone_verification.sql`

```sql
-- ============================================
-- Migration 011: Phone Verification & Messaging
-- ============================================

-- ── 1. Add phone + consent columns to participants ──
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN NOT NULL DEFAULT false;

-- Unique phone per event (a phone number can exist in multiple events)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_phone_event
  ON participants(event_id, phone)
  WHERE phone IS NOT NULL;

-- ── 2. OTP verification table ──
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookup: phone + event_id + not used + not expired
CREATE INDEX IF NOT EXISTS idx_otp_phone_event
  ON otp_verifications(phone, event_id)
  WHERE is_used = false;

-- Auto-cleanup: delete expired OTPs (older than 1 hour) via cleanup cron
-- No separate cron needed - the existing cleanup route handles it.

-- ── 3. Event-level WhatsApp messaging config ──
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS wa_messages_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Guest phone list for pre-event messages ──
CREATE TABLE IF NOT EXISTS event_guest_phones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  guest_name TEXT,
  wa_pre_event_sent BOOLEAN NOT NULL DEFAULT false,
  wa_pre_event_sent_at TIMESTAMPTZ,
  wa_marketing_window_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_event_guest_phones_event
  ON event_guest_phones(event_id);

CREATE INDEX IF NOT EXISTS idx_event_guest_phones_pending
  ON event_guest_phones(event_id)
  WHERE wa_pre_event_sent = false;

-- ── 5. Message log (for auditing + checking WA windows) ──
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL,             -- 'sms' | 'whatsapp'
  message_type TEXT NOT NULL,        -- 'otp' | 'pre_event' | 'welcome' | 'feedback'
  wa_category TEXT,                  -- 'authentication' | 'marketing' | 'utility' (WA only)
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'delivered' | 'failed' | 'read'
  provider_message_id TEXT,          -- external ID from SMS/WA provider
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_log_event
  ON message_log(event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_message_log_phone
  ON message_log(phone, message_type);

-- ── 6. RLS for new tables ──
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_claims ENABLE ROW LEVEL SECURITY;
-- No anon access policies - all access via service_role only.

-- ── 7. Client portal tokens (secure links for guest upload) ──
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,          -- crypto.randomUUID() - the link IS the auth
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_token
  ON client_portal_tokens(token) WHERE is_active = true;

-- ── 8. Discount claims (persists after event deletion) ──
CREATE TABLE IF NOT EXISTS discount_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,                       -- phone that received the discount
  discount_code TEXT NOT NULL,               -- e.g. 'EVENTA10'
  event_name TEXT NOT NULL,                  -- stored denormalized (survives event deletion)
  event_date DATE NOT NULL,                  -- stored denormalized
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,  -- SET NULL, not CASCADE
  wa_message_id TEXT,                        -- message_log reference
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_claims_code
  ON discount_claims(discount_code);

CREATE INDEX IF NOT EXISTS idx_discount_claims_phone
  ON discount_claims(phone);

-- ── 9. Upload tracking for guest lists ──
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guest_list_uploaded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_list_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_list_count INTEGER NOT NULL DEFAULT 0;

-- ── 10. Update event_requests table ──
-- The order form already has `wants_guest_messages` boolean.
-- No change needed to event_requests.
```

### 3.2 Updated TypeScript Types (`database.types.ts` additions)

```typescript
// Add to existing database.types.ts:

export interface OtpVerification {
  id: string;
  phone: string;
  event_id: string;
  code: string;
  attempts: number;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

export interface EventGuestPhone {
  id: string;
  event_id: string;
  phone: string;
  guest_name: string | null;
  wa_pre_event_sent: boolean;
  wa_pre_event_sent_at: string | null;
  wa_marketing_window_opened_at: string | null;
  created_at: string;
}

export interface MessageLog {
  id: string;
  event_id: string;
  phone: string;
  channel: 'sms' | 'whatsapp';
  message_type: 'otp' | 'pre_event' | 'welcome' | 'feedback';
  wa_category: 'authentication' | 'marketing' | 'utility' | null;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

// Update Participant interface:
export interface Participant {
  // ... existing fields ...
  phone: string | null;          // NEW
  sms_consent: boolean;          // NEW
  feedback_sent: boolean;        // NEW
}

// Update Event interface:
export interface Event {
  // ... existing fields ...
  wa_messages_enabled: boolean;  // NEW
  guest_list_uploaded: boolean;  // NEW
  guest_list_uploaded_at: string | null;  // NEW
  guest_list_count: number;      // NEW
}

export interface ClientPortalToken {
  id: string;
  event_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DiscountClaim {
  id: string;
  phone: string;
  discount_code: string;
  event_name: string;
  event_date: string;
  event_id: string | null;    // null after event deletion (ON DELETE SET NULL)
  wa_message_id: string | null;
  is_redeemed: boolean;
  redeemed_at: string | null;
  created_at: string;
}
```

---

## 4. Environment Variables

### 4.1 New Variables

```env
# ── SMS Provider (InforUMobile) ──
INFORU_API_TOKEN=your_api_token       # API auth token from InforUMobile dashboard
INFORU_SENDER_NAME=Eventa             # Sender name shown on SMS (max 11 chars)

# ── WhatsApp Business API (360dialog) ──
WA_API_KEY=your_360dialog_api_key     # API key from 360dialog hub
WA_PHONE_NUMBER_ID=your_phone_id      # WhatsApp Business phone number ID
WA_ACCOUNT_ID=your_waba_id            # WhatsApp Business Account ID

# ── OTP Config ──
OTP_LENGTH=6                          # optional, defaults to 6
OTP_EXPIRY_SECONDS=300                # optional, defaults to 300 (5 min)
OTP_MAX_ATTEMPTS=3                    # optional, defaults to 3
OTP_RESEND_COOLDOWN_SECONDS=45        # optional, defaults to 45
```

### 4.2 Updated Zod Env Validation

Add to `validateEnv()` in `validations.ts`:

```typescript
// Optional - only required when SMS/WA features are used:
INFORU_API_TOKEN: z.string().min(1).optional(),
INFORU_SENDER_NAME: z.string().min(1).max(11).optional(),
WA_API_KEY: z.string().min(1).optional(),
WA_PHONE_NUMBER_ID: z.string().min(1).optional(),
```

---

## 5. New File Structure

```
src/
  lib/
    messaging/
      index.ts                  # Barrel export
      types.ts                  # Shared types for messaging
      sms-provider.ts           # InforUMobile SMS client
      whatsapp-provider.ts      # 360dialog WhatsApp client
      messaging-service.ts      # High-level orchestrator (send-otp, send-welcome, etc.)
      templates.ts              # Message templates (Hebrew text, WA template names)
      phone-utils.ts            # Phone normalization, validation, formatting
    otp.ts                      # OTP generation, storage, verification logic
    config.ts                   # + new OTP/messaging config constants
    email-templates.ts          # + new email templates (upload instructions, reminders)
    guest-upload.ts             # Excel/CSV parsing + validation logic for guest lists

  app/
    api/
      auth/
        send-otp/
          route.ts              # POST /api/auth/send-otp
        verify-otp/
          route.ts              # POST /api/auth/verify-otp
      cron/
        pre-event-messages/
          route.ts              # GET|POST /api/cron/pre-event-messages
        feedback-messages/
          route.ts              # GET|POST /api/cron/feedback-messages
        upload-reminders/
          route.ts              # GET|POST /api/cron/upload-reminders (emails couples)
      admin/
        events/
          [eventId]/
            guests/
              route.ts          # POST (upload CSV), GET (list), DELETE (remove)
            portal-token/
              route.ts          # POST (generate/regenerate), GET (current token)
            messaging/
              route.ts          # POST (manual send), PATCH (toggle WA, change timing)
            send-email/
              route.ts          # POST (manual email to client: upload reminder, invoice)
      guest-portal/
        [token]/
          route.ts              # GET (portal data), POST (upload file), DELETE (remove number)
          download-template/
            route.ts            # GET - returns the Excel template file

    guest-upload/
      [eventId]/
        page.tsx                # Client-facing guest upload portal (token-auth)
        _components/
          UploadZone.tsx        # Drag-and-drop file upload + browse button
          GuestListTable.tsx    # View uploaded numbers (masked) + remove button
          AddPhoneForm.tsx      # Add individual phone number
          UploadResult.tsx      # Shows validation results (passed/failed rows)

    dating/
      [eventSlug]/
        join/
          page.tsx              # Modified: add phone + OTP steps
          _components/
            PhoneInput.tsx      # Phone number input with country prefix
            OtpInput.tsx        # 6-digit code input with auto-advance

  components/
    ExcelTemplateDownload.tsx   # Shared download button component

  app/admin/
    _components/
      messaging/
        MessagingTab.tsx        # New tab in EventAnalyticsView - full messaging panel
        GuestListManager.tsx    # Admin guest list view/edit (see all numbers, add/remove)
        MessageLog.tsx          # Message delivery log table
        CrossReferenceTable.tsx # Guest list → actual participants matching
        MessagingControls.tsx   # Manual send buttons, scheduling controls
      events/
        EventServicesInfo.tsx   # Shows what the client purchased (services, pricing)

public/
  templates/
    guest-upload-template.xlsx  # Pre-formatted Excel template with instructions
```

---

## 6. SMS Provider Integration (InforUMobile)

### 6.1 File: `src/lib/messaging/sms-provider.ts`

```typescript
/**
 * InforUMobile SMS provider for the Israeli market.
 *
 * API docs: https://www.inforu.co.il/api-docs
 * Pricing: ~₪0.04 per domestic SMS
 *
 * This provider is used ONLY for OTP codes.
 * WhatsApp is used for all other messages (welcome, pre-event, feedback).
 */

interface SendSmsParams {
  to: string;        // E.164 format: +972501234567
  message: string;   // Plain text, max 160 chars for 1 SMS segment
}

interface SendSmsResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

// Configuration
const API_URL = 'https://api.inforu.co.il/api/v2/SMS/SendSMS';

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const token = process.env.INFORU_API_TOKEN;
  const senderName = process.env.INFORU_SENDER_NAME || 'Eventa';

  if (!token) {
    return { success: false, messageId: null, error: 'INFORU_API_TOKEN not configured' };
  }

  // InforUMobile expects local format without +972 prefix
  const localPhone = toLocalFormat(params.to);

  const body = {
    Data: {
      Message: params.message,
      Recipients: [{ Phone: localPhone }],
      Settings: {
        Sender: senderName,
      },
    },
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { success: false, messageId: null, error: `HTTP ${response.status}: ${text}` };
  }

  const result = await response.json();
  // InforUMobile returns StatusDescription: "OK" on success
  if (result.StatusDescription === 'OK' || result.Status === 1) {
    return { success: true, messageId: result.MessageId || null, error: null };
  }

  return {
    success: false,
    messageId: null,
    error: result.StatusDescription || 'Unknown SMS error',
  };
}

/** Convert E.164 (+972...) to local Israeli format (05...) */
function toLocalFormat(phone: string): string {
  if (phone.startsWith('+972')) {
    return '0' + phone.slice(4);
  }
  return phone;
}
```

### 6.2 Key Design Decisions

- **InforUMobile API v2** - REST-based, JSON request/response
- **Authentication** - Basic auth with API token (provided by InforUMobile dashboard)
- **Sender name** - configurable via env var, defaults to "Eventa" (max 11 chars for alphanumeric sender IDs in Israel)
- **Phone format** - internally we store E.164 (+972...), convert to local format only for the API call
- **Single recipient** - OTPs are always 1:1, so no batch API needed

---

## 7. WhatsApp Business API Integration (360dialog)

### 7.1 Why 360dialog

- **Cheapest BSP** (Business Solution Provider) for Meta's WhatsApp API
- No per-message markup on top of Meta's official pricing
- Only charges a monthly fee (~$5/month for low volume)
- Simple REST API, supports message templates
- Direct access to Meta's conversation-based pricing

### 7.2 File: `src/lib/messaging/whatsapp-provider.ts`

```typescript
/**
 * 360dialog WhatsApp Business API client.
 *
 * API docs: https://docs.360dialog.com/
 * Uses Meta's Cloud API through 360dialog's proxy endpoint.
 *
 * Message categories (Meta pricing):
 * - Authentication: OTP codes (not used - we use SMS for OTP)
 * - Marketing: pre-event reminders, welcome messages, feedback (₪0.15/conversation)
 * - Utility: transactional (not used currently)
 *
 * Conversation window: 24 hours per category.
 * All our WA messages are Marketing → one window per user per 24h.
 */

interface SendTemplateParams {
  to: string;                     // E.164: +972501234567
  templateName: string;           // Pre-approved Meta template name
  templateLanguage: string;       // 'he' for Hebrew
  components?: TemplateComponent[];
}

interface TemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document';
    text?: string;
    image?: { link: string };
  }>;
}

interface SendWaResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

const API_BASE = 'https://waba.360dialog.io/v1';

export async function sendWhatsAppTemplate(
  params: SendTemplateParams
): Promise<SendWaResult> {
  const apiKey = process.env.WA_API_KEY;
  if (!apiKey) {
    return { success: false, messageId: null, error: 'WA_API_KEY not configured' };
  }

  const body = {
    messaging_product: 'whatsapp',
    to: params.to.replace('+', ''),  // 360dialog expects without '+'
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.templateLanguage },
      components: params.components || [],
    },
  };

  const response = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return {
      success: false,
      messageId: null,
      error: err.error?.message || `HTTP ${response.status}`,
    };
  }

  const result = await response.json();
  return {
    success: true,
    messageId: result.messages?.[0]?.id || null,
    error: null,
  };
}
```

### 7.3 WhatsApp Message Templates (Must Be Pre-Approved by Meta)

Templates to register in the 360dialog/Meta dashboard:

#### Template 1: `eventa_pre_event` (Marketing)

```
Language: he (Hebrew)
Category: Marketing
Header: None
Body:
  🎉 היי{{1}}! בעוד מעט מתחיל *{{2}}*!
  הכנסו לאפליקציה כדי ליצור קשר עם רווקים ורווקות באירוע:
  {{3}}
Footer: Eventa - אפליקציית הכרויות לאירועים
Buttons:
  - URL: "כניסה לאפליקציה" → {{3}}

Variables:
  {{1}} = guest name (or empty)
  {{2}} = event name
  {{3}} = join URL
```

#### Template 2: `eventa_welcome` (Marketing)

```
Language: he (Hebrew)
Category: Marketing
Header: None
Body:
  ברוכים הבאים ל-*{{1}}*! 🎉
  ההרשמה שלכם הצליחה. הנה הלינק שלכם לאפליקציה:
  {{2}}
  נשמח שתיהנו!
Footer: Eventa - אפליקציית הכרויות לאירועים
Buttons:
  - URL: "פתחו את האפליקציה" → {{2}}

Variables:
  {{1}} = event name
  {{2}} = join URL
```

#### Template 3: `eventa_feedback` (Marketing)

```
Language: he (Hebrew)
Category: Marketing
Header: None
Body:
  תודה שהשתתפתם ב-*{{1}}*! 🎉
  ממש נשמח לשמוע מכם:
  {{2}}
  *קוד הנחה 10%: EVENTA10*
  תקף ל-6 חודשים הקרובים.
Footer: Eventa - אפליקציית הכרויות לאירועים
Buttons:
  - URL: "מלאו פידבק" → {{2}}

Variables:
  {{1}} = event name
  {{2}} = feedback URL
```

---

## 8. Messaging Service Abstraction Layer

### 8.1 File: `src/lib/messaging/types.ts`

```typescript
/** Channel types */
export type MessageChannel = 'sms' | 'whatsapp';

/** Message purpose types */
export type MessagePurpose = 'otp' | 'pre_event' | 'welcome' | 'feedback';

/** WhatsApp conversation categories */
export type WaCategory = 'authentication' | 'marketing' | 'utility';

/** Result from any send operation */
export interface SendResult {
  success: boolean;
  channel: MessageChannel;
  messageId: string | null;
  error: string | null;
}

/** Messaging service configuration per event */
export interface EventMessagingConfig {
  eventId: string;
  eventName: string;
  eventSlug: string;
  joinCode: string;
  waMessagesEnabled: boolean;
}
```

### 8.2 File: `src/lib/messaging/templates.ts`

```typescript
/**
 * Message templates - centralized Hebrew text and WA template names.
 * No hardcoded strings anywhere else.
 */
import type { EventMessagingConfig } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eventa.productions';

/** Build the join URL for an event */
export function buildJoinUrl(slug: string, joinCode: string): string {
  return `${BASE_URL}/dating/${slug}/join?k=${joinCode}`;
}

/** Build the feedback URL for an event */
export function buildFeedbackUrl(eventId: string): string {
  return `${BASE_URL}/feedback/${eventId}`;
}

// ── SMS Templates (plain text) ──

export function otpSmsText(code: string): string {
  return `Eventa - קוד האימות שלך: ${code}\nתוקף: 5 דקות`;
}

// ── WhatsApp Template Names (registered in Meta) ──

export const WA_TEMPLATES = {
  PRE_EVENT: 'eventa_pre_event',
  WELCOME: 'eventa_welcome',
  FEEDBACK: 'eventa_feedback',
} as const;

/** Build WA template variables for pre-event message */
export function preEventVars(
  config: EventMessagingConfig,
  guestName?: string | null
): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: guestName || '' },
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildJoinUrl(config.eventSlug, config.joinCode) },
  ];
}

/** Build WA template variables for welcome message */
export function welcomeVars(
  config: EventMessagingConfig
): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildJoinUrl(config.eventSlug, config.joinCode) },
  ];
}

/** Build WA template variables for feedback message */
export function feedbackVars(
  config: EventMessagingConfig
): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildFeedbackUrl(config.eventId) },
  ];
}
```

### 8.3 File: `src/lib/messaging/phone-utils.ts`

```typescript
/**
 * Phone number normalization and validation utilities.
 * All phone numbers are stored in E.164 format: +972501234567
 */

/** Israeli mobile prefixes */
const IL_MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '056', '058'];

/**
 * Normalize a phone number to E.164 format.
 * Handles:
 *  - +972-50-1234567
 *  - 972501234567
 *  - 050-1234567
 *  - 0501234567
 *
 * Returns null if phone is invalid.
 */
export function normalizePhone(raw: string): string | null {
  // Strip all whitespace, dashes, parentheses
  const cleaned = raw.replace(/[\s\-()]/g, '');

  // Already E.164: +972...
  if (/^\+972\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Without plus: 972...
  if (/^972\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Local format: 05X...
  if (/^0[5]\d{8}$/.test(cleaned)) {
    return '+972' + cleaned.slice(1);
  }

  return null;
}

/**
 * Validate that a phone is a valid Israeli mobile number.
 */
export function isValidIsraeliMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  // Check prefix matches known Israeli mobile prefixes
  const localForm = '0' + normalized.slice(4);
  return IL_MOBILE_PREFIXES.some((prefix) => localForm.startsWith(prefix));
}

/**
 * Format phone for display: +972-50-123-4567
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith('+972') || e164.length !== 13) return e164;
  const local = e164.slice(4);
  return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
}

/**
 * Mask phone for privacy display: +972-50-***-4567
 */
export function maskPhone(e164: string): string {
  if (!e164.startsWith('+972') || e164.length !== 13) return '***';
  const local = e164.slice(4);
  return `+972-${local.slice(0, 2)}-***-${local.slice(5)}`;
}
```

### 8.4 File: `src/lib/messaging/messaging-service.ts`

```typescript
/**
 * High-level messaging orchestrator.
 * Determines which channel to use and delegates to providers.
 * Logs all messages to the message_log table.
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { sendSms } from './sms-provider';
import { sendWhatsAppTemplate } from './whatsapp-provider';
import { otpSmsText, WA_TEMPLATES, preEventVars, welcomeVars, feedbackVars } from './templates';
import type { EventMessagingConfig, SendResult, MessagePurpose, WaCategory } from './types';

// ── Internal: log to message_log table ──

async function logMessage(params: {
  eventId: string;
  phone: string;
  channel: 'sms' | 'whatsapp';
  messageType: MessagePurpose;
  waCategory?: WaCategory;
  status: 'sent' | 'failed';
  providerMessageId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('message_log').insert({
      event_id: params.eventId,
      phone: params.phone,
      channel: params.channel,
      message_type: params.messageType,
      wa_category: params.waCategory || null,
      status: params.status,
      provider_message_id: params.providerMessageId || null,
      error_message: params.errorMessage || null,
    });
  } catch (err) {
    logger.error('[MESSAGING] Failed to log message', { error: err });
  }
}

// ── Public API ──

/**
 * Send OTP code via SMS.
 * Always uses SMS - universal, no WhatsApp dependency for auth.
 */
export async function sendOtp(
  phone: string,
  code: string,
  eventId: string
): Promise<SendResult> {
  const text = otpSmsText(code);
  const result = await sendSms({ to: phone, message: text });

  await logMessage({
    eventId,
    phone,
    channel: 'sms',
    messageType: 'otp',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send pre-event reminder via WhatsApp.
 * Opens a 24h Marketing conversation window.
 */
export async function sendPreEventMessage(
  phone: string,
  config: EventMessagingConfig,
  guestName?: string | null
): Promise<SendResult> {
  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.PRE_EVENT,
    templateLanguage: 'he',
    components: [{
      type: 'body',
      parameters: preEventVars(config, guestName),
    }],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'pre_event',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send welcome message via WhatsApp.
 * Only sent if this phone did NOT receive a pre-event message.
 * Opens a new 24h Marketing window.
 */
export async function sendWelcomeMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  // Check: did this phone already get a pre-event message for this event?
  const supabase = getServiceClient();
  const { data: guestEntry } = await supabase
    .from('event_guest_phones')
    .select('wa_pre_event_sent')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .maybeSingle();

  if (guestEntry?.wa_pre_event_sent) {
    // Already has the link - skip
    logger.info('[MESSAGING] Skipping welcome - pre-event already sent', {
      phone, eventId: config.eventId,
    });
    return { success: true, channel: 'whatsapp', messageId: null, error: null };
  }

  // Also check message_log as a second source of truth
  const { data: existingMsg } = await supabase
    .from('message_log')
    .select('id')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .in('message_type', ['pre_event', 'welcome'])
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();

  if (existingMsg) {
    logger.info('[MESSAGING] Skipping welcome - message already sent', {
      phone, eventId: config.eventId,
    });
    return { success: true, channel: 'whatsapp', messageId: null, error: null };
  }

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.WELCOME,
    templateLanguage: 'he',
    components: [{
      type: 'body',
      parameters: welcomeVars(config),
    }],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'welcome',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send feedback message via WhatsApp.
 * Only sent if a Marketing window is still open (< 24h since pre-event or welcome).
 * If no open window, skip - we don't open a new window just for feedback.
 */
export async function sendFeedbackMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  // Check if a marketing window is open
  const supabase = getServiceClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentMsg } = await supabase
    .from('message_log')
    .select('created_at')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .eq('channel', 'whatsapp')
    .eq('wa_category', 'marketing')
    .eq('status', 'sent')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!recentMsg) {
    logger.info('[MESSAGING] Skipping feedback - no open WA marketing window', {
      phone, eventId: config.eventId,
    });
    return { success: false, channel: 'whatsapp', messageId: null, error: 'no_open_window' };
  }

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.FEEDBACK,
    templateLanguage: 'he',
    components: [{
      type: 'body',
      parameters: feedbackVars(config),
    }],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'feedback',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}
```

---

## 9. OTP System Design

### 9.1 File: `src/lib/otp.ts`

```typescript
/**
 * OTP generation, storage, and verification.
 * Codes are stored in the otp_verifications table with a 5-minute TTL.
 * Max 3 verification attempts per code.
 */
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ── Configuration (from env or defaults) ──
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_S = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);
const RESEND_COOLDOWN_S = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '45', 10);

/** Generate a cryptographically secure N-digit OTP */
export function generateOtpCode(length: number = OTP_LENGTH): string {
  // Generate random number in range [100000, 999999] for 6 digits
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const code = min + (randomNum % range);
  return code.toString();
}

/**
 * Create and store a new OTP for a phone + event.
 * Invalidates any existing unused OTPs for the same phone + event.
 *
 * Returns the code on success, or an error string.
 */
export async function createOtp(
  phone: string,
  eventId: string
): Promise<{ code: string; expiresIn: number } | { error: string }> {
  const supabase = getServiceClient();

  // Check resend cooldown: prevent spamming
  const cooldownCutoff = new Date(Date.now() - RESEND_COOLDOWN_S * 1000).toISOString();
  const { data: recent } = await supabase
    .from('otp_verifications')
    .select('id')
    .eq('phone', phone)
    .eq('event_id', eventId)
    .gte('created_at', cooldownCutoff)
    .eq('is_used', false)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return { error: `Please wait ${RESEND_COOLDOWN_S} seconds before requesting a new code` };
  }

  // Invalidate all previous unused OTPs for this phone + event
  await supabase
    .from('otp_verifications')
    .update({ is_used: true })
    .eq('phone', phone)
    .eq('event_id', eventId)
    .eq('is_used', false);

  // Generate and store new OTP
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_S * 1000).toISOString();

  const { error } = await supabase
    .from('otp_verifications')
    .insert({
      phone,
      event_id: eventId,
      code,
      attempts: 0,
      is_used: false,
      expires_at: expiresAt,
    });

  if (error) {
    logger.error('[OTP] Failed to create OTP', { phone, eventId, error: error.message });
    return { error: 'Failed to create verification code' };
  }

  return { code, expiresIn: OTP_EXPIRY_S };
}

/**
 * Verify an OTP code.
 * Returns true if valid, false with error reason if not.
 */
export async function verifyOtp(
  phone: string,
  eventId: string,
  code: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = getServiceClient();

  // Find the latest unused, non-expired OTP for this phone + event
  const now = new Date().toISOString();
  const { data: otp, error: fetchError } = await supabase
    .from('otp_verifications')
    .select('id, code, attempts, expires_at')
    .eq('phone', phone)
    .eq('event_id', eventId)
    .eq('is_used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    logger.error('[OTP] Verification lookup failed', { phone, eventId, error: fetchError.message });
    return { valid: false, error: 'Verification failed' };
  }

  if (!otp) {
    return { valid: false, error: 'Code expired or not found. Request a new code.' };
  }

  // Check max attempts
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    // Mark as used (exhausted)
    await supabase
      .from('otp_verifications')
      .update({ is_used: true })
      .eq('id', otp.id);
    return { valid: false, error: 'Too many attempts. Request a new code.' };
  }

  // Increment attempts
  await supabase
    .from('otp_verifications')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);

  // Timing-safe comparison to prevent timing attacks
  const codeBuffer = Buffer.from(code.padEnd(10, '\0'));
  const otpBuffer = Buffer.from(otp.code.padEnd(10, '\0'));
  if (codeBuffer.length !== otpBuffer.length || !crypto.timingSafeEqual(codeBuffer, otpBuffer)) {
    return { valid: false, error: 'Incorrect code' };
  }

  // Mark OTP as used
  await supabase
    .from('otp_verifications')
    .update({ is_used: true })
    .eq('id', otp.id);

  return { valid: true };
}

/** Cleanup expired OTPs (called from existing cleanup cron) */
export async function cleanupExpiredOtps(): Promise<number> {
  const supabase = getServiceClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('otp_verifications')
    .delete()
    .lt('expires_at', oneHourAgo)
    .select('*', { count: 'exact', head: true });

  if (error) {
    logger.error('[OTP] Cleanup failed', { error: error.message });
    return 0;
  }
  return count || 0;
}

export { RESEND_COOLDOWN_S };
```

---

## 10. API Route Changes

### 10.1 New Route: `POST /api/auth/send-otp`

**File**: `src/app/api/auth/send-otp/route.ts`

```
Purpose: Validate event + phone, generate OTP, send SMS
Rate limit: auth tier (5/min per IP)
Auth: None required (public - like the join endpoint)
CSRF: Yes

Request body: {
  phone: string,        // raw user input, will be normalized
  eventSlug: string,
  joinCode: string
}

Response 200: {
  success: true,
  expiresIn: 300,
  maskedPhone: "+972-50-***-4567"
}

Response 400: { error: "Invalid phone number" }
Response 404: { error: "Invalid event or join code" }
Response 429: { error: "Please wait before requesting a new code" }
Response 500: { error: "Failed to send verification code" }

Flow:
  1. CSRF check
  2. Rate limit (auth tier: 5/min)
  3. Validate + normalize phone number
  4. Lookup event by slug + join_code + is_active
  5. Check if phone is banned for this event
  6. Create OTP (with cooldown check)
  7. Send SMS via InforUMobile
  8. Return masked phone + expiry
```

### 10.2 New Route: `POST /api/auth/verify-otp`

**File**: `src/app/api/auth/verify-otp/route.ts`

```
Purpose: Verify OTP, create/reconnect participant, issue session, send welcome WA
Rate limit: auth tier (5/min per IP)
Auth: None required (public)
CSRF: Yes

Request body: {
  phone: string,
  code: string,
  eventSlug: string,
  joinCode: string,
  fingerprint?: string,            // localStorage UUID
  hardwareFingerprint?: string,     // canvas/WebGL hash
  smsConsent: boolean               // user agreed to receive messages
}

Response 200: {
  eventId: string,
  eventName: string,
  backgroundImage: string | null,
  participantId: string,
  participant: PublicParticipant | null  // null for new users
}

Response 400: { error: "Invalid code" | "Code expired" }
Response 403: { error: "Phone is banned from this event" }
Response 429: { error: "Too many attempts" }

Flow:
  1. CSRF check
  2. Rate limit (auth tier)
  3. Normalize phone
  4. Lookup event by slug + joinCode
  5. Verify OTP code
  6. Check ban status (phone + fingerprints against banned_devices)
  7. Find existing participant by phone + event_id
     FOUND → reconnect:
       - Update fingerprints to current values
       - Update last_seen_at
       - Update sms_consent if changed
     NOT FOUND → create new participant:
       - Insert with phone, fingerprints, sms_consent
       - Log activity: 'join'
  8. Sign session JWT, set httpOnly cookie
  9. Fire-and-forget: send welcome WhatsApp if eligible
     (checks per-phone if pre-event message was already sent)
  10. Return session data
```

### 10.3 Modified Route: `POST /api/auth/join` (Updated)

The existing join route stays as-is for backward compatibility (fingerprint-based reconnection). **No changes needed** - it continues to handle:
- Users with valid cookies returning
- Users with fingerprints in localStorage

The only change: when a user reconnects via fingerprint and doesn't have a phone set, the client will NOT prompt for phone (they already have a session). Phone capture happens only during registration or cache-cleared recovery.

### 10.4 New Route: `GET|POST /api/cron/pre-event-messages`

**File**: `src/app/api/cron/pre-event-messages/route.ts`

```
Purpose: Send pre-event WhatsApp reminders 2-3 hours before events start
Auth: CRON_SECRET bearer token
Schedule: Every hour (via vercel.json cron)
Rate limit: strict tier

Flow:
  1. Auth (cron secret)
  2. Find events where:
     - wa_messages_enabled = true
     - status = 'active'
     - starts_at BETWEEN now() AND now() + 3 hours
     - NOT already processed (check message_log or flag)
  3. For each event:
     a. Fetch event_guest_phones WHERE wa_pre_event_sent = false
     b. Load event config (name, slug, join_code)
     c. For each phone:
        - Send WhatsApp template (eventa_pre_event)
        - Mark wa_pre_event_sent = true
        - Set wa_pre_event_sent_at = now()
        - Set wa_marketing_window_opened_at = now()
     d. Log summary to activity_log
  4. Return { processed: N, sent: N, failed: N }
```

### 10.5 New Route: `GET|POST /api/cron/feedback-messages`

**File**: `src/app/api/cron/feedback-messages/route.ts`

```
Purpose: Send feedback WhatsApp messages after events end
Auth: CRON_SECRET bearer token
Schedule: Every hour (via vercel.json cron)
Rate limit: strict tier

Flow:
  1. Auth (cron secret)
  2. Find events where:
     - status = 'ended'
     - ends_at BETWEEN now() - 6 hours AND now() - 1 hour
       (gives 1h buffer after end, sends within 6h)
  3. For each event:
     a. Fetch participants WHERE:
        - phone IS NOT NULL
        - sms_consent = true
        - feedback_sent = false
     b. Load event config
     c. For each participant:
        - Check if WA marketing window is still open (< 24h)
        - If open: send feedback via WA (free - same window)
        - If closed: skip (don't pay for new window just for feedback)
        - Mark feedback_sent = true regardless (don't retry)
     d. Log summary
  4. Return { processed: N, sent: N, skipped: N }
```

### 10.6 New Route: Admin Guest Phone Management

**File**: `src/app/api/admin/events/[eventId]/guests/route.ts`

```
Purpose: Upload/manage guest phone list for pre-event messages
Auth: Admin cookie or CRON_SECRET

POST - Upload guest list (CSV or JSON):
  Body: { guests: [{ phone: string, name?: string }] }
  OR multipart/form-data with CSV file

  Flow:
    1. Admin auth guard
    2. Validate event exists + wa_messages_enabled
    3. Normalize all phone numbers
    4. Upsert into event_guest_phones (skip duplicates)
    5. Return { imported: N, skipped: N, invalid: N }

GET - List guests:
  Response: { guests: EventGuestPhone[], total: N }

DELETE - Remove guest(s):
  Body: { phones: string[] }
  Flow: Delete from event_guest_phones
```

### 10.7 Modified: Cleanup Cron (Addition)

Add to existing `src/app/api/cleanup/route.ts`:

```
After existing cleanup steps, add:
  - Delete expired OTPs: DELETE FROM otp_verifications WHERE expires_at < now() - 1 hour
  - Delete message_log for archived events (keep 30 days for analytics)
  - Delete event_guest_phones for archived events
```

---

## 11. Client-Side Changes

### 11.1 Modified: Join Page Flow

**File**: `src/app/dating/[eventSlug]/join/page.tsx`

The join page gets a multi-step flow:

```
Step 1: Terms & privacy agreement (existing)
  → User agrees
Step 2: Phone number input (NEW)
  → User enters Israeli mobile number
  → Checkbox: "אני מסכים/ה לקבל הודעות" (SMS consent)
  → "שלחו קוד" button
  → POST /api/auth/send-otp
Step 3: OTP verification (NEW)
  → 6-digit input with auto-advance
  → 45s resend cooldown timer
  → "אמתו" button
  → POST /api/auth/verify-otp
  → On success: redirect to setup or grid (same as current)
```

**State machine:**

```typescript
type JoinStep = 'terms' | 'phone' | 'otp';

const [step, setStep] = useState<JoinStep>('terms');
const [phone, setPhone] = useState('');
const [maskedPhone, setMaskedPhone] = useState('');
const [smsConsent, setSmsConsent] = useState(true); // default checked
const [resendTimer, setResendTimer] = useState(0);
```

### 11.2 New Component: `PhoneInput.tsx`

```
Props:
  value: string
  onChange: (value: string) => void
  disabled: boolean
  error?: string

Features:
  - Fixed +972 prefix (displayed but not editable)
  - Input mask: __-_______
  - Auto-formats as user types
  - Validates Israeli mobile prefixes on blur
  - RTL-safe (number itself is LTR within RTL context)
  - Mobile keyboard: inputMode="tel"
```

### 11.3 New Component: `OtpInput.tsx`

```
Props:
  length: number (default 6)
  onComplete: (code: string) => void
  disabled: boolean
  error?: string

Features:
  - 6 separate input boxes
  - Auto-advance to next box on digit entry
  - Backspace moves to previous box
  - Paste support (paste 6-digit code fills all boxes)
  - Auto-submit when all 6 digits filled
  - Each box: inputMode="numeric", pattern="[0-9]", maxLength=1
  - Focus trap within the OTP group
  - LTR direction (numbers) within RTL page
```

### 11.4 New Client API Function: `src/lib/api/auth.ts` (additions)

```typescript
/** Request OTP for phone verification */
export async function sendOtp(params: {
  phone: string;
  eventSlug: string;
  joinCode: string;
}): Promise<{
  success: boolean;
  expiresIn?: number;
  maskedPhone?: string;
  error?: string;
}> {
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

/** Verify OTP and complete join */
export async function verifyOtp(params: {
  phone: string;
  code: string;
  eventSlug: string;
  joinCode: string;
  fingerprint?: string;
  hardwareFingerprint?: string;
  smsConsent: boolean;
}): Promise<{
  eventId: string;
  eventName: string;
  backgroundImage: string | null;
  participantId: string;
  participant: PublicParticipant | null;
} | null> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('DEVICE_BANNED');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Verification failed');
  }
  return res.json();
}
```

### 11.5 Modified: SessionProvider.tsx

No changes to SessionProvider. The existing flow handles session restoration from cookies perfectly. Phone verification only kicks in when the join page is shown (no cookie, no fingerprint).

### 11.6 New Zod Schemas: `validations.ts` (additions)

```typescript
/** Phone OTP request */
export const sendOtpSchema = z.object({
  phone: z.string().min(9).max(15),
  eventSlug: z.string().min(1),
  joinCode: z.string().min(12).max(32),
});

/** Phone OTP verification */
export const verifyOtpSchema = z.object({
  phone: z.string().min(9).max(15),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
  eventSlug: z.string().min(1),
  joinCode: z.string().min(12).max(32),
  smsConsent: z.boolean(),
});

/** Guest phone import */
export const guestPhoneSchema = z.object({
  phone: z.string().min(9).max(15),
  name: z.string().max(100).optional(),
});

export const guestPhoneImportSchema = z.object({
  guests: z.array(guestPhoneSchema).min(1).max(1000),
});
```

---

## 12. Scheduled Messaging (Cron Jobs)

### 12.1 Updated `vercel.json`

```json
{
  "regions": ["fra1"],
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 15 }
  },
  "crons": [
    { "path": "/api/admin/auto-archive", "schedule": "0 3 * * *" },
    { "path": "/api/cleanup", "schedule": "0 4 * * *" },
    { "path": "/api/cron/pre-event-messages", "schedule": "0 * * * *" },
    { "path": "/api/cron/feedback-messages", "schedule": "0 * * * *" }
  ]
}
```

### 12.2 Pre-Event Message Timing Logic

```
Cron runs every hour at :00.
Event starts at 19:00 → cron at 16:00 picks it up (3h before).

Window: events starting between now and now + 3 hours.
- At 16:00: finds events starting 16:00–19:00 → sends for 19:00 event
- At 17:00: finds events starting 17:00–20:00 → sends for 19:00 event
  BUT pre-event already sent → skipped (wa_pre_event_sent = true)

Safety: even if cron misses once, the next run will catch it (as long as
event hasn't started yet). If event already started, skip - too late.
```

### 12.3 Feedback Message Timing Logic

```
Cron runs every hour.
Event ends at 23:00 → feedback window: 00:00–05:00 next day.

Window: events ended 1-6 hours ago.
- At 00:00: finds events ended 18:00–23:00 → sends for 23:00 event
- At 01:00: finds events ended 19:00–00:00 → sends for 23:00 event
  BUT feedback already sent → skipped (feedback_sent = true per participant)

WA window check: pre-event sent at 16:00 → window closes at 16:00 next day.
Feedback at 00:00 = 8 hours later → within 24h window → FREE ✅
Feedback at 17:00 = 25 hours later → window closed → SKIP (don't pay) ❌
```

---

## 13. Admin Dashboard Changes

> **⚠️ This section is an overview.** For the full, comprehensive admin dashboard integration
> (every button, every tab, every manual override), see **[Section 23: Admin Dashboard - Full Integration](#23-admin-dashboard--full-integration)**.

### 13.1 Event Creation/Edit - New Field

Add to event create/edit form:
```
☑ הפעל הודעות WhatsApp לאורחים
  (הודעה לפני האירוע, ברוכים הבאים, ופידבק)
```

Maps to `events.wa_messages_enabled` boolean.

### 13.2 Guest Phone List Management (New Section)

When `wa_messages_enabled` is true, show a new section in the event detail page:

```
┌─────────────────────────────────────────────┐
│ 📱 רשימת אורחים להודעות                     │
│                                             │
│ [ ⬆ העלו קובץ CSV ]  [ + הוסיפו מספר ]     │
│                                             │
│ ┌──────────────────────────────────────────┐│
│ │ שם          │ טלפון          │ סטטוס     ││
│ │─────────────│────────────────│───────────││
│ │ דנה כהן     │ +972-50-***-67 │ ✅ נשלח   ││
│ │ יוסי לוי    │ +972-52-***-89 │ ⏳ ממתין  ││
│ │ מאיה בר     │ +972-54-***-12 │ ⏳ ממתין  ││
│ └──────────────────────────────────────────┘│
│                                             │
│ סה"כ: 180 אורחים | נשלחו: 0 | ממתין: 180    │
│                                             │
│ ℹ️ ההודעות יישלחו אוטומטית 2-3 שעות לפני   │
│    תחילת האירוע                              │
└─────────────────────────────────────────────┘
```

**CSV Format:**
```csv
phone,name
0501234567,דנה כהן
0521234567,יוסי לוי
```

### 13.3 Event Analytics - New Metrics

Add to event analytics dashboard:
```
📊 הודעות
├── OTPs שנשלחו: 128
├── הודעות Pre-event שנשלחו: 180
├── הודעות Welcome שנשלחו: 45
├── הודעות Feedback שנשלחו: 90
├── הצלחת שליחה: 98%
└── עלות משוערת: ₪35
```

---

## 14. Security Considerations

### 14.1 OTP Security

| Threat | Mitigation |
|--------|-----------|
| **Brute-force OTP guessing** | Max 3 attempts per code. After 3 fails, OTP is invalidated. |
| **SMS bombing** | 45s cooldown between OTP sends per phone. Auth-tier rate limit (5/min per IP). |
| **OTP replay** | OTP marked as used immediately on success. Can't be reused. |
| **Timing attack on code comparison** | `crypto.timingSafeEqual` used for code verification. |
| **Expired OTPs** | 5-minute TTL enforced in DB query (`expires_at > now()`). |
| **Phone enumeration** | Same generic error for invalid phone and valid phone. Response time is consistent (no early return). |
| **SMS interception** | Accepted risk for event-scoped, temporary accounts. Not a banking app. |

### 14.2 Phone-Based Ban Enforcement

Add phone to ban checks. When an admin bans a participant:
1. Existing: add device_fingerprint and hardware_fingerprint to `banned_devices`
2. **New**: if participant has a phone, also add the phone to `banned_devices`
3. On join, check all three identifiers

### 14.3 Phone Data Protection

- Phone numbers are stored **only** in the `participants` table and `event_guest_phones` table
- Both tables are **service_role only** (no anon RLS policies for write/read on phone column)
- The `PublicParticipant` type already excludes sensitive fields - add `phone` to the exclusion list
- Phone numbers are **deleted** when the event is archived (same as all other participant data)
- Phone numbers are **never** sent to the client in grid/profile API responses
- Message log is cleaned up with the event (or kept 30 days max)

### 14.4 Rate Limiting Summary (New Endpoints)

| Endpoint | Limit | Key |
|----------|-------|-----|
| `POST /api/auth/send-otp` | 5/min | `send-otp:{ip}` |
| `POST /api/auth/verify-otp` | 5/min | `verify-otp:{ip}` |
| Cron routes | 3/min (strict) | `cron-*:{ip}` |
| Guest portal (per token) | 10/min | `guest-portal:{token}` |
| Guest file upload | 3/min (strict) | `guest-upload:{token}` |
| Admin manual send | 5/min | `admin-send:{ip}` |
| Admin guests management | 10/min | `admin-guests:{ip}` |

### 14.5 Client Portal Security

| Threat | Mitigation |
|--------|-----------|
| **Token guessing** | UUID v4 = 122 bits entropy. Unguessable by brute force. |
| **Token sharing** | Accepted risk - client can share the link. Portal only shows their event. |
| **Old token access** | Tokens deactivated on regeneration (`is_active=false`). Event archive deactivates all tokens. |
| **Portal after event ends** | Portal becomes read-only. No new uploads accepted. |
| **CSRF on portal** | Portal uses token-auth (not cookies) - CSRF not applicable. |
| **File upload attacks** | File size limit (5MB), file type validation (xlsx/csv only), server-side parsing (no client-side eval). |
| **Phone number exposure** | Client portal masks phones: `050-***-4567`. Admin sees full phones. |
| Admin guest upload | 3/min (strict) | `admin-guests:{ip}` |

---

## 15. Data Privacy & Legal Compliance

### 15.1 Israeli Law Requirements

| Law | Requirement | How We Comply |
|-----|-------------|---------------|
| **Privacy Protection Law (5741-1981)** | Consent for data collection | SMS consent checkbox at registration |
| **Communications Law (Bezeq)** | Opt-in for commercial messages | Separate checkbox: "אני מסכים/ה לקבל הודעות" |
| **GDPR-like provisions** | Data deletion | Phone deleted with event cleanup (7 days post-event) |
| **Database Registrar** | Register database with PPA if >10K records | Monitor - unlikely to hit with event-scoped data |

### 15.2 Privacy Policy Updates

Add to `TermsContent.tsx` and `PrivacyContent.tsx`:

- Phone number collection: purpose (identity verification, messaging), retention period
- SMS/WhatsApp messaging: types of messages sent, opt-in/opt-out mechanism
- Third-party providers: InforUMobile (SMS), Meta/360dialog (WhatsApp)
- Data deletion: phone numbers deleted with all participant data (7 days post-event)

### 15.3 Consent Flow

```
Registration:
  ☑ אני מסכים/ה לתנאי השימוש ומדיניות הפרטיות  (required)
  ☑ אני מסכים/ה לקבל הודעות SMS ו-WhatsApp       (optional, default checked)
```

The messaging consent checkbox is **separate** from the terms agreement. Users can uncheck it and still use the app - they just won't get welcome/feedback messages. OTP is a necessary transactional message and doesn't require marketing consent.

---

## 16. Cost Model

### 16.1 Per-Event Cost Breakdown

**Event WITHOUT WhatsApp feature** (basic tier):

| Item | Who | Channel | Count | Cost each | Total |
|------|-----|---------|-------|-----------|-------|
| OTP | Joiners | SMS | 80 | ₪0.04 | ₪3.20 |
| Welcome | Joiners | WA | 80 | ₪0.15 | ₪12.00 |
| Feedback | Opted-in joiners | WA | 56 | ₪0.00* | ₪0.00 |
| **Total** | | | | | **₪15.20** |

*\*Free if within 24h of welcome message*

**Event WITH WhatsApp feature** (premium tier):

| Item | Who | Channel | Count | Cost each | Total |
|------|-----|---------|-------|-----------|-------|
| Pre-event | All guests | WA | 180 | ₪0.15 | ₪27.00 |
| OTP | Joiners | SMS | 128 | ₪0.04 | ₪5.12 |
| Welcome | On-spot joiners | WA | 20 | ₪0.15 | ₪3.00 |
| Feedback | Opted-in joiners | WA | 90 | ₪0.00* | ₪0.00 |
| **Total** | | | | | **₪35.12** |

### 16.2 Monthly Provider Costs

| Provider | Fixed cost | Variable cost |
|----------|-----------|---------------|
| InforUMobile | ₪0/month (pay-as-you-go) | ₪0.04/SMS |
| 360dialog | ~$5/month (hub access) | Meta pricing (₪0.15/marketing conversation) |

---

## 17. Edge Cases & Error Handling

### 17.1 Phone-Related Edge Cases

| Edge Case | Handling |
|-----------|---------|
| **Same phone, two browser tabs** | OTP is single-use. First tab to verify wins. Second tab gets "code already used". |
| **Phone number changes** | Not supported. User can delete account and re-register with new phone. |
| **Same phone in multiple events** | Allowed. Phone is unique per event, not globally. Each event has its own participant record. |
| **International phone numbers** | Currently rejected - only Israeli mobile numbers accepted. Can be extended later. |
| **SMS delivery failure** | Return error to user. Show "שלחו שוב" button with cooldown timer. Max 3 retries per session. |
| **WhatsApp delivery failure** | Log to message_log with status='failed'. No user-facing error (WA messages are non-critical). |
| **User clears cache mid-OTP** | OTP is still valid in DB. User refreshes → sees phone input again → enters same phone → gets "wait 45s" or resends. |
| **User enters wrong phone, gets OTP, can't verify** | They'll enter the wrong code. After 3 attempts, they must request new OTP. They can change the phone number at that point. |
| **Guest has phone in guest list AND joins on-spot** | On verify-otp: lookup by phone in participants first. If not found, also check event_guest_phones for pre-event status (to skip welcome WA). |
| **Event ends before guest joins** | Event status check in send-otp and verify-otp. Rejected with "Event is not active". |
| **Multiple OTP requests (spam)** | 45s cooldown per phone+event. Previous OTPs invalidated. Rate limit per IP. |
| **Phone used by banned participant** | Check banned_devices for phone. If banned → "This phone is blocked from this event." |

### 17.2 Cron Job Edge Cases

| Edge Case | Handling |
|-----------|---------|
| **Cron job runs twice** | Idempotent: checks `wa_pre_event_sent` / `feedback_sent` flags before sending. |
| **Event created < 3h before start** | Pre-event message sent on next cron run if event hasn't started yet. |
| **100+ guests to message** | Process sequentially with 100ms delay between WhatsApp API calls (avoid rate-limit from Meta). |
| **15s Vercel timeout** | Batch processing: process max 50 messages per cron invocation. If more, process remainder on next run. |
| **WhatsApp window expired before feedback** | Skip gracefully. Don't open new window. Log "skipped: no_open_window". |
| **Event with 0 guests in list** | Skip event. Log "no guests to message". |

### 17.3 Messaging Provider Failures

| Failure | Handling |
|---------|---------|
| **InforUMobile down** | OTP SMS fails → user sees error → can retry. App still works without OTP (fingerprint fallback). |
| **WhatsApp API down** | Welcome/feedback fail → logged as 'failed' → not retried → non-critical feature. |
| **Invalid API credentials** | Logged at error level. `env` validation warns at startup but doesn't block (optional vars). |
| **Phone rejected by provider** | Logged with provider's error message. User sees "Unable to send to this number." |

### 17.4 Client Portal Edge Cases

| Edge Case | Handling |
|-----------|---------|
| **Client uploads wrong file format (.docx, .pdf, etc.)** | Reject with "הקובץ חייב להיות בפורמט Excel (.xlsx) או CSV (.csv)". No processing. |
| **Client uploads empty file** | Reject with "הקובץ ריק". |
| **Client uploads file with >500 rows** | Reject with "מקסימום 500 אורחים בהעלאה אחת. אפשר להעלות קבצים נוספים." |
| **Client uploads file twice (same data)** | All numbers detected as duplicates. Response: "0 added, 180 duplicates." No harm. |
| **Client uploads additional file** | New numbers appended to existing list. Not a replacement - additive only. |
| **Client removes number after WA sent** | Blocked: "לא ניתן להסיר מספר שכבר נשלחה אליו הודעה". |
| **Client opens portal after event archived** | Read-only view. "האירוע הסתיים. הרשימה שלכם נשמרה. תודה! 🎉" |
| **Client shares portal link with guest** | Guest can't do damage - can only add/remove from the list. Low risk, accepted. |
| **Token regenerated by admin** | Old link returns 401 "Invalid or expired link". Client needs new link (sent via email). |
| **Multiple uploads in rapid succession** | Rate limited: 3 uploads/min per token. Prevents accidental double-clicks. |
| **Excel has extra columns** | Ignored. Only columns A (phone) and B (name) are parsed. |
| **Excel has phone as number (not text)** | Smart parsing: if cell is numeric (e.g., 501234567), prepend "0" to make "0501234567". |
| **CSV with different delimiters** | Auto-detect: comma, semicolon, or tab. Hebrew Excel typically exports with comma. |
| **Upload reminder sent but client uploads same day** | Next cron run sees guest_list_uploaded=true, skips further reminders. |

### 17.5 Admin Override Edge Cases

| Edge Case | Handling |
|-----------|---------|
| **Admin toggles WA off after pre-event sent** | OK - feedback cron checks wa_messages_enabled. If off, skips feedback too. |
| **Admin manually sends WA when no guest list** | Button disabled if guest_list_count = 0. Shows "אין מספרים ברשימה". |
| **Admin sends invoice email for already-paid event** | No system-level check. Admin's responsibility. Email just sends. |
| **Admin changes timing after messages already sent** | No effect on already-sent messages. Only affects future sends. |
| **Admin adds messaging to past event** | Allowed but crons won't pick it up (event already ended). Admin can use manual send buttons. |
| **Event approved without messaging, then admin adds it** | Admin toggles WA on → generates portal token → sends upload email. Full flow available. |

---

## 18. Migration Strategy

### 18.1 Rollout Plan

> Updated rollout plan that incorporates sections 20–25 (client portal, email lifecycle, admin controls).

**Phase 1: Database + Core Backend** (no user-facing changes)
1. Run migration `011_phone_verification.sql` (all tables + columns)
2. Deploy new messaging lib files (sms-provider, whatsapp-provider, messaging-service, otp)
3. Deploy guest-upload.ts (Excel/CSV parser)
4. Deploy new API routes (send-otp, verify-otp)
5. Deploy guest-portal API routes
6. Deploy admin messaging/portal-token/send-email routes
7. Add env vars to Vercel (INFORU_API_TOKEN, etc.)

**Phase 2: Client-Side (Join + Portal)**
1. Update join page with phone + OTP steps
2. Deploy PhoneInput and OtpInput components
3. Deploy guest upload portal page + components
4. Create Excel template file
5. Update client API functions

**Phase 3: Email Templates + Crons**
1. Add 6 new email templates to email-templates.ts
2. Deploy upload-reminders cron route
3. Update existing cron routes (pre-event, feedback)
4. Update vercel.json with new cron schedules

**Phase 4: Admin Dashboard**
1. Deploy MessagingTab + sub-components
2. Add "📱 הודעות" tab to EventAnalyticsView
3. Add messaging overview to Sidebar
4. Extend ParticipantsTable with messaging columns
5. Add EventServicesInfo to event detail view
6. Wire up all manual action buttons
7. Update shared.ts types + useAdminData hook

**Phase 5: Pricing Page + Order Flow**
1. Remove "בקרוב" badge from messaging add-on card
2. Verify order flow saves wantsGuestMessages correctly (already done)
3. Wire approval flow → portal token creation + email sending

**Phase 6: Testing + Activation**
1. Deploy all code (feature-flagged off)
2. Test with a real event end-to-end
3. Enable feature flag
4. Monitor message_log for delivery rates

### 18.2 Backward Compatibility

- Existing users with sessions (cookies + fingerprints) continue to work unchanged
- The phone input only appears for new registrations and cache-cleared recovery
- Old participants without phone numbers can still use the app normally
- `phone` column is nullable - no migration of existing data needed
- Existing join route (`/api/auth/join`) stays unchanged and functional

### 18.3 Feature Flags

For gradual rollout, the phone verification can be gated:

```typescript
// In config.ts:
export const PHONE_VERIFICATION_ENABLED = process.env.PHONE_VERIFICATION_ENABLED !== 'false';
```

When disabled, the join page skips the phone step and goes directly to the fingerprint-based join (current behavior).

---

## 19. Testing Plan

### 19.1 Unit Tests

| Test file | What it tests |
|-----------|---------------|
| `__tests__/unit/lib/phone-utils.test.ts` | Phone normalization, validation, formatting, masking |
| `__tests__/unit/lib/otp.test.ts` | OTP generation (6 digits, crypto-secure), code comparison |
| `__tests__/unit/lib/messaging/templates.test.ts` | Template variable building, URL construction |
| `__tests__/unit/lib/guest-upload.test.ts` | Excel/CSV parsing, validation pipeline, duplicate detection |

### 19.2 Integration Tests

| Test file | What it tests |
|-----------|---------------|
| `__tests__/integration/api/send-otp.test.ts` | OTP creation, rate limiting, cooldown, phone validation |
| `__tests__/integration/api/verify-otp.test.ts` | OTP verification, participant creation/reconnection, session issuance |
| `__tests__/integration/api/guests.test.ts` | Guest phone import, CSV parsing, duplicate handling |
| `__tests__/integration/api/guest-portal.test.ts` | Token validation, file upload, add/remove, masking |
| `__tests__/integration/api/admin-messaging.test.ts` | Toggle WA, manual sends, email triggers |
| `__tests__/integration/api/upload-reminders.test.ts` | Cron logic: correct day calculation, idempotency |

### 19.3 E2E Tests

| Test file | What it tests |
|-----------|---------------|
| `__tests__/e2e/flows/phone-join.spec.ts` | Full flow: terms → phone → OTP → setup → grid |
| `__tests__/e2e/flows/phone-recovery.spec.ts` | Cache clear → phone OTP → reconnect to existing participant |
| `__tests__/e2e/flows/guest-upload-portal.spec.ts` | Client portal: upload Excel → see list → add/remove |
| `__tests__/e2e/flows/admin-messaging.spec.ts` | Admin: toggle WA → upload guests → manual send → view log |

### 19.4 Manual Testing Checklist

**Phone + OTP:**
- [ ] Enter valid Israeli mobile → receive SMS within 5s
- [ ] Enter invalid number → error message in Hebrew
- [ ] OTP expires after 5 minutes → "Code expired" message
- [ ] Wrong OTP 3 times → "Too many attempts" → must request new code
- [ ] Correct OTP → session created, redirect to setup
- [ ] Same phone, same event → reconnects to existing participant
- [ ] Same phone, different event → creates new participant
- [ ] Clear cache → re-enter phone → resume existing account
- [ ] Banned phone → "This phone is blocked" on OTP verification

**Pre-event / Welcome / Feedback:**
- [ ] Pre-event WhatsApp received → join via link → no welcome WA sent
- [ ] No pre-event WA → join on-spot → welcome WA sent
- [ ] Feedback WA sent within 24h of pre-event → free (check costs)
- [ ] Consent unchecked → no welcome/feedback WA sent
- [ ] Cron: event in 2 hours → pre-event WA sent to guest list
- [ ] Cron: event ended 3 hours ago → feedback WA sent to opted-in users

**Client Portal:**
- [ ] Open portal link → see event info + upload zone
- [ ] Download Excel template → properly formatted with headers
- [ ] Upload .xlsx with 200 phones → all valid imported, see results
- [ ] Upload .csv file → same behavior as xlsx
- [ ] Upload .docx → rejected with "format not supported" error
- [ ] Upload file with invalid numbers → see per-row error details
- [ ] Upload file with duplicates → duplicates counted, not re-added
- [ ] Add individual phone → appears in list immediately
- [ ] Remove phone (not yet sent) → removed successfully
- [ ] Remove phone (already sent) → error: "can't remove after message sent"
- [ ] Re-upload file → numbers appended to existing list (not replaced)
- [ ] Open portal after event ended → read-only view, no uploads

**Admin Dashboard:**
- [ ] Approve request with wantsGuestMessages → portal token created
- [ ] Client receives upload instructions email with working link
- [ ] Admin toggles WA on → messages tab appears
- [ ] Admin toggles WA off → messages tab shows disabled state
- [ ] Admin uploads CSV for client → numbers appear in guest list
- [ ] Admin adds individual number → added to list
- [ ] Admin removes number → removed from list
- [ ] Admin copies portal link → works in browser
- [ ] Admin regenerates token → old link stops working, new one works
- [ ] Admin sends upload reminder email → client receives it
- [ ] Admin sends invoice email → client receives with PayBox link
- [ ] Admin clicks "send WA now" → pre-event messages sent immediately
- [ ] Admin clicks "send feedback now" → feedback messages sent
- [ ] Admin changes pre-event timing → saved per-event
- [ ] Cross-reference table shows which guests joined vs didn't
- [ ] Participants table shows phone (masked), source, feedback status
- [ ] Event overview shows services purchased + pricing
- [ ] Upload reminders cron at T-7 → email sent if no upload
- [ ] Upload reminders cron at T-3 → urgent email sent if no upload
- [ ] After event: summary email sent to client with stats

**Data Retention:**
- [ ] Delete event → all participant/guest data deleted
- [ ] Delete event → discount_claims records survive (event_id → NULL)
- [ ] Discount code lookup works for deleted events

---

## Summary (Original Sections 1–19)

> See [Section 26: Updated Summary](#26-updated-summary) for the full updated count including all new sections.

| Component | Files | Complexity |
|-----------|-------|-----------|
| Database migration | 1 SQL file | Low |
| Phone utilities | 1 file | Low |
| OTP system | 1 file | Medium |
| SMS provider | 1 file | Low |
| WhatsApp provider | 1 file | Low |
| Messaging orchestrator | 1 file | Medium |
| Message templates | 1 file | Low |
| API: send-otp | 1 route | Medium |
| API: verify-otp | 1 route | High |
| API: cron pre-event | 1 route | Medium |
| API: cron feedback | 1 route | Medium |
| API: admin guests | 1 route | Medium |
| Client: join page | 1 modified file | High |
| Client: PhoneInput | 1 component | Medium |
| Client: OtpInput | 1 component | Medium |
| Client: API functions | 1 modified file | Low |
| Validations | 1 modified file | Low |
| Database types | 1 modified file | Low |
| Config | 1 modified file | Low |
| Vercel config | 1 modified file | Low |

---
---

# Part II: Purchase, Client Portal & Admin Full Control

> **Sections 20–26** cover the complete business lifecycle of the messaging service:
> from purchase through client onboarding, guest list management, email communications,
> full admin control, data retention for discounts, and every message's content.

---

## 20. Purchase & Onboarding Flow

### 20.1 Pricing Page Changes

**Current state** (`src/app/pricing/page.tsx`):
The messaging add-on card has the `pricing-card--coming-soon` class and a "בקרוב" badge.
It's visually disabled and not selectable.

**Changes needed:**
```
1. Remove the `pricing-card--coming-soon` class
2. Remove the "בקרוב" badge element
3. Make the card selectable (link to /dating/order like the base package)
4. The card already shows the correct info:
   - Title: "הודעות לאורחים" (₪50 תוספת)
   - Features: MSG_FEATURES array (WhatsApp messages, personal join link, Excel upload)
```

The pricing page itself doesn't handle selection - it just links to `/dating/order`.
The order form handles the `wantsGuestMessages` toggle.

### 20.2 Order Form - wantsGuestMessages Already Integrated

**Current state** (`src/app/api/order/route.ts`):
The order form Zod schema already has `wantsGuestMessages: z.boolean()`.
When submitted:
- Saved to `event_requests` table as `wants_guest_messages`
- Email to admin includes messaging add-on status
- `priceBlock()` in email renders ₪300 (250+50) when messaging is selected

**No changes needed** to the order flow - it's ready.

### 20.3 Event Approval with Messaging

When the admin approves an event request that has `wants_guest_messages = true`:

```
Admin clicks "אשר" on a request
  ↓
approveRequest() in useAdminData.ts
  ↓
POST /api/admin/events/[eventId]/approve  (existing route)
  ↓
Create event in DB:
  - wa_messages_enabled = true              ← from wants_guest_messages
  - guest_list_uploaded = false
  - guest_list_count = 0
  ↓
Generate client portal token:
  - INSERT INTO client_portal_tokens (event_id, token)
  - token = crypto.randomUUID()
  ↓
Build upload portal URL:
  https://eventa.productions/guest-upload/[eventId]?token=[token]
  ↓
Send "Upload Instructions" email to client:  (Email #1 - see Section 22.2)
  - Subject: "🎉 האירוע שלכם אושר! - הכינו את רשימת האורחים"
  - Contains: upload link, instructions, Excel template download link
  - Sent to: contact_email from event_requests
  ↓
Return: approved_event_id to admin UI
```

### 20.4 Messaging Service Activation Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│ Time           │ What happens                                        │
│────────────────│─────────────────────────────────────────────────────│
│ Order placed   │ wantsGuestMessages saved in event_requests          │
│ Event approved │ wa_messages_enabled=true, portal token created,     │
│                │ upload instructions email sent to couple             │
│ T-7 days       │ Reminder email if no numbers uploaded yet (cron)     │
│ T-3 days       │ Urgent reminder email if still no numbers (cron)     │
│ T-3 to T-2 hrs │ Pre-event WhatsApp sent to guest list (cron)        │
│ T (event start)│ Guests join via link or QR → OTP → setup            │
│ T+3 hours      │ Feedback WhatsApp sent to opted-in participants     │
│ T+7 days       │ Event archival → data cleanup begins                │
│ T+7 days       │ discount_claims records preserved (no deletion)      │
└──────────────────────────────────────────────────────────────────────┘
```

### 20.5 Adding Messaging After the Fact

If a client ordered without messaging, but later wants to add it:

```
Admin can:
1. Toggle wa_messages_enabled=true in the event's messaging tab (Section 23)
2. Click "שלחו חשבונית" to send the ₪50 invoice email (Section 22.6)
3. Generate a portal token and send upload instructions email
4. Everything else works the same from this point
```

This is a manual admin action - there's no self-serve "upgrade" flow. The client calls/texts, admin clicks a few buttons.

---

## 21. Client Guest Management Portal

### 21.1 Architecture Overview

The client portal is a **standalone page** at `/guest-upload/[eventId]?token=[secure_token]`.
It requires **no login** - the token in the URL IS the authentication.

```
┌─────────────────────────────────────────────────────────────────┐
│ Client (couple) receives email with link                         │
│   ↓                                                              │
│ Opens: /guest-upload/[eventId]?token=abc123-def456               │
│   ↓                                                              │
│ Page validates token via API:                                    │
│   GET /api/guest-portal/[token]                                  │
│     → lookup client_portal_tokens WHERE token=abc123 AND active  │
│     → return event details + current guest list                  │
│   ↓                                                              │
│ Renders: Guest upload portal with:                               │
│   - Event name + date header                                     │
│   - Excel template download button                               │
│   - File upload zone (drag or browse)                            │
│   - Current guest list table (masked phones)                     │
│   - Add individual phone form                                    │
│   - Remove individual phone button per row                       │
└─────────────────────────────────────────────────────────────────┘
```

### 21.2 Secure Token-Based Access

```typescript
// Token generation (on event approval):
const token = crypto.randomUUID(); // e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

// Token validation (on portal page load):
// GET /api/guest-portal/[token]
const { data } = await supabase
  .from('client_portal_tokens')
  .select('*, events!inner(id, event_name, starts_at, ends_at, status)')
  .eq('token', params.token)
  .eq('is_active', true)
  .single();

if (!data || data.events.status === 'archived') {
  return Response.json({ error: 'Invalid or expired link' }, { status: 401 });
}

// Update last_used_at
await supabase
  .from('client_portal_tokens')
  .update({ last_used_at: new Date().toISOString() })
  .eq('id', data.id);
```

**Token security:**
- UUID v4 → 122 bits of entropy → unguessable
- Stored in `client_portal_tokens` table with `is_active` flag
- Admin can regenerate token (deactivates old one)
- Token auto-deactivates when event is archived
- Rate limited: 10 requests/minute per token

### 21.3 Portal UI - Full Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🎉 Eventa                                        │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  האירוע: "ערב רווקים - תל אביב"                              │  │
│  │  תאריך: 15 במרץ 2026, 20:00                                  │  │
│  │  סטטוס רשימה: ✅ 180 מספרים הועלו                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── העלאת רשימה ──────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  📥 הורידו את הטמפלט (Excel)                                 │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐    │  │
│  │  │                                                       │    │  │
│  │  │  גררו קובץ לכאן                                      │    │  │
│  │  │  או                                                   │    │  │
│  │  │  [ בחרו קובץ ]                                        │    │  │
│  │  │                                                       │    │  │
│  │  │  .xlsx או .csv בלבד, עד 500 שורות                     │    │  │
│  │  └───────────────────────────────────────────────────────┘    │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── הוספת מספר בודד ──────────────────────────────────────────┐  │
│  │  שם (אופציונלי): [________]  טלפון: [05_-_______]  [הוסיפו] │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── הרשימה הנוכחית (180 אורחים) ──────────────────────────────┐  │
│  │  שם              │ טלפון            │ סטטוס      │ פעולה     │  │
│  │──────────────────│──────────────────│────────────│──────────│  │
│  │  דנה כהן          │ 050-***-4567    │ ⏳ ממתין   │ [🗑 הסירו] │  │
│  │  יוסי לוי         │ 052-***-1234    │ ⏳ ממתין   │ [🗑 הסירו] │  │
│  │  מאיה בר          │ 054-***-7890    │ ✅ נשלח    │ [🗑 הסירו] │  │
│  │  (ללא שם)         │ 058-***-5678    │ ⏳ ממתין   │ [🗑 הסירו] │  │
│  │  ...              │ ...             │ ...        │ ...      │  │
│  │──────────────────│──────────────────│────────────│──────────│  │
│  │  📄 עמוד 1 מתוך 4                          [◄ הקודם] [הבא ►] │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ℹ️ ההודעות יישלחו אוטומטית 2-3 שעות לפני תחילת האירוע.            │
│  ❓ שאלות? צרו קשר: support@eventa.productions                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.4 Excel Template

The downloadable template (`guest-upload-template.xlsx`) has:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sheet: "אורחים"                                                      │
│                                                                      │
│   A              │   B                                               │
│ ─────────────────│──────────────────────────────────────────────────  │
│ 1  טלפון         │  שם (אופציונלי)                                   │
│ 2  0501234567    │  דנה כהן                                          │
│ 3  0521234567    │  יוסי לוי                                         │
│ 4  0541234567    │                                                    │
│                                                                      │
│ Sheet: "הנחיות"                                                      │
│                                                                      │
│  1. הזינו מספרי טלפון ישראליים (מתחילים ב-05)                        │
│  2. עמודת השם היא אופציונלית                                         │
│  3. כל שורה = אורח/ת אחד/ת                                          │
│  4. מקסימום 500 אורחים                                                │
│  5. מספרים כפולים יסוננו אוטומטית                                     │
│  6. אפשר להעלות קבצים נוספים - הם יתווספו לרשימה הקיימת             │
└──────────────────────────────────────────────────────────────────────┘
```

**File format:** Pre-formatted Excel (.xlsx) with:
- Column A header: "טלפון" (validated as required)
- Column B header: "שם (אופציונלי)" (optional)
- 3 example rows (user should overwrite)
- Instructions sheet with clear Hebrew guidance
- Cell validation on Column A: text format (not number - to preserve leading zeros)

### 21.5 Upload Validation & Error Handling

**File: `src/lib/guest-upload.ts`**

```typescript
interface UploadValidationResult {
  success: boolean;
  added: number;          // new numbers actually added
  duplicates: number;     // already in the list (skipped)
  invalid: number;        // failed validation (skipped)
  errors: UploadRowError[];  // details per failed row
  totalInList: number;    // total after this upload
}

interface UploadRowError {
  row: number;            // 1-based row number (from the file)
  phone: string;          // the value they entered
  reason: string;         // Hebrew error message
}
```

**Validation pipeline (per row):**

```
1. Parse file (xlsx or csv)
   ├── Wrong file format → reject entire file with message:
   │   "הקובץ חייב להיות בפורמט Excel (.xlsx) או CSV (.csv)"
   ├── Empty file → "הקובץ ריק"
   └── Too many rows (>500) → "מקסימום 500 אורחים בהעלאה אחת"

2. For each row:
   ├── Empty phone cell → skip silently (blank rows are OK)
   ├── Phone validation:
   │   ├── Strip spaces, dashes, parentheses
   │   ├── Normalize: "050-1234567" → "0501234567" → "+972501234567"
   │   ├── Must be Israeli mobile (05X pattern): /^05\d{8}$/
   │   ├── Invalid → add to errors:
   │   │   "שורה 7: '03-1234567' - מספר לא תקין (רק סלולרי ישראלי)"
   │   └── Valid → continue
   ├── Duplicate check (against existing list + this batch):
   │   ├── Already exists → increment duplicates counter, skip
   │   └── New → add to batch
   └── Name: sanitize (escapeHtml, trim, max 100 chars)

3. Batch insert valid rows into event_guest_phones

4. Update event:
   - guest_list_uploaded = true
   - guest_list_uploaded_at = now()
   - guest_list_count = (SELECT COUNT(*) FROM event_guest_phones WHERE event_id=...)

5. Return UploadValidationResult
```

**Error display in UI (UploadResult component):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ תוצאות העלאה                                                        │
│                                                                     │
│  ✅ 175 מספרים הועלו בהצלחה                                         │
│  ⚠️  3 מספרים כפולים (כבר ברשימה)                                    │
│  ❌ 2 מספרים לא תקינים:                                              │
│    • שורה 7: "03-1234567" - מספר לא תקין (רק סלולרי ישראלי)         │
│    • שורה 15: "abc" - מספר לא תקין (רק סלולרי ישראלי)               │
│                                                                     │
│  סה"כ ברשימה: 175 אורחים                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.6 Guest List Management (Add / Remove / View)

**Add individual number:**
```
POST /api/guest-portal/[token]
Body: { phone: "0501234567", name: "דנה כהן" }
  → same validation as upload (single row)
  → INSERT INTO event_guest_phones
  → update guest_list_count on event
  → return: { success: true, totalInList: 181 }
```

**Remove number:**
```
DELETE /api/guest-portal/[token]
Body: { phoneId: "uuid-of-guest-phone-row" }
  → DELETE FROM event_guest_phones WHERE id=phoneId AND event_id=...
  → Only allowed if wa_pre_event_sent=false (can't remove after message sent)
  → If already sent: return error "לא ניתן להסיר מספר שכבר נשלחה אליו הודעה"
  → update guest_list_count on event
  → return: { success: true, totalInList: 179 }
```

**View list (in portal):**
- Phone numbers are **partially masked**: `050-***-4567`
- Names shown in full
- Status shown: ⏳ ממתין (pending) / ✅ נשלח (sent)
- Paginated: 50 per page
- Sorted by: created_at DESC (newest first)

### 21.7 Upload Status Tracking

The client portal shows a status summary at the top:

| Status | Meaning |
|--------|---------|
| 🔴 לא הועלו מספרים | No numbers uploaded yet |
| 🟡 הועלו X מספרים - ההודעות טרם נשלחו | Numbers uploaded, messages not sent yet |
| 🟢 נשלחו Y הודעות מתוך X | Pre-event messages sent |
| ⚫ האירוע הסתיים | Event is over, portal is read-only |

When the event has ended or been archived, the portal shows a read-only view with a message:
"האירוע הסתיים. הרשימה שלכם נשמרה. תודה! 🎉"

---

## 22. Email Lifecycle & Templates

### 22.1 Complete Email Timeline

All emails use the existing email template system in `email-templates.ts`:
`shell()` for the HTML wrapper, `row()` for two-column info, Hebrew RTL throughout.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Email #  │ When                      │ To     │ Template name            │
│──────────│───────────────────────────│────────│──────────────────────────│
│ 1        │ Event approved            │ Client │ buildUploadInstructions   │
│          │ (with messaging add-on)   │        │ Email()                   │
│ 2        │ T-7 days (if no upload)   │ Client │ buildUploadReminderEmail  │
│          │                           │        │ ()                        │
│ 3        │ T-3 days (if no upload)   │ Client │ buildUploadUrgentReminder │
│          │                           │        │ Email()                   │
│ 4        │ After event ends          │ Client │ buildEventSummaryEmail()  │
│ 5        │ Manual (admin trigger)    │ Client │ buildMessagingAddonInvoice│
│          │                           │        │ Email()                   │
│ 6        │ Manual (admin trigger)    │ Client │ buildCustomReminderEmail  │
│          │                           │        │ ()                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 22.2 Email #1: Upload Instructions (on approval)

**Trigger:** Admin approves event request with `wants_guest_messages = true`
**Sent to:** `contact_email` from `event_requests`
**Subject:** `🎉 האירוע שלכם אושר! - הכינו את רשימת האורחים`

```typescript
export function buildUploadInstructionsEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  uploadUrl: string;    // https://eventa.productions/guest-upload/[eventId]?token=...
  templateUrl: string;  // https://eventa.productions/templates/guest-upload-template.xlsx
}): string {
  return shell(`
    <h2 style="text-align:center; color:#e91e63;">🎉 האירוע שלכם אושר!</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>האירוע <strong>${escapeHtml(params.eventName)}</strong> אושר ונוצר בהצלחה!</p>

    <p>הזמנתם את שירות ההודעות לאורחים - כדי שנוכל לשלוח הודעות WhatsApp
       לאורחים שלכם לפני האירוע, צריך להעלות את רשימת מספרי הטלפון.</p>

    <h3>איך זה עובד?</h3>

    <ol>
      <li>הורידו את הטמפלט (Excel)</li>
      <li>מלאו את מספרי הטלפון של האורחים</li>
      <li>העלו את הקובץ בלינק שלמטה</li>
    </ol>

    ${row('📅 תאריך האירוע', `${params.eventDate}, ${params.eventTime}`)}
    ${row('📱 מספרי טלפון', 'סלולרי ישראלי (05X) בלבד')}
    ${row('⏰ דד-ליין להעלאה', '3 שעות לפני האירוע')}

    <div style="text-align:center; margin:24px 0;">
      <a href="${params.uploadUrl}"
         style="background:#e91e63; color:#fff; padding:14px 32px;
                border-radius:8px; text-decoration:none; font-size:16px;
                font-weight:bold; display:inline-block;">
        📥 העלו את רשימת האורחים
      </a>
    </div>

    <div style="text-align:center; margin:12px 0;">
      <a href="${params.templateUrl}"
         style="color:#e91e63; text-decoration:underline; font-size:14px;">
        הורידו טמפלט Excel
      </a>
    </div>

    <p style="font-size:13px; color:#888;">
      💡 <strong>טיפ:</strong> תוכלו להוסיף, להסיר, ולהעלות מספרים נוספים
      בכל שלב דרך הלינק הזה. הפורטל פתוח עד סיום האירוע.
    </p>
  `);
}
```

### 22.3 Email #2: 7-Day Reminder (if no upload)

**Trigger:** Cron job `upload-reminders` - 7 days before event, if `guest_list_uploaded = false`
**Subject:** `⏰ תזכורת: העלו את רשימת האורחים ל-"[eventName]"`

```typescript
export function buildUploadReminderEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  daysLeft: number;
  uploadUrl: string;
}): string {
  return shell(`
    <h2 style="text-align:center;">⏰ תזכורת מוקדמת</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>האירוע <strong>${escapeHtml(params.eventName)}</strong> בעוד
       <strong>${params.daysLeft} ימים</strong> ועדיין לא העליתם את רשימת האורחים.</p>

    <p>כדי שנוכל לשלוח הודעות WhatsApp לאורחים שלכם, אנחנו צריכים
       את רשימת מספרי הטלפון. אפשר להעלות קובץ Excel או להוסיף מספרים ידנית.</p>

    <div style="text-align:center; margin:24px 0;">
      <a href="${params.uploadUrl}"
         style="background:#e91e63; color:#fff; padding:14px 32px;
                border-radius:8px; text-decoration:none; font-size:16px;
                font-weight:bold; display:inline-block;">
        📥 העלו את הרשימה עכשיו
      </a>
    </div>

    <p style="font-size:13px; color:#888;">
      ההודעות נשלחות 2-3 שעות לפני האירוע. ככל שתעלו מוקדם יותר, כך יותר טוב!
    </p>
  `);
}
```

### 22.4 Email #3: 3-Day Urgent Reminder (if no upload)

**Trigger:** Cron job `upload-reminders` - 3 days before event, if `guest_list_uploaded = false`
**Subject:** `🚨 אחרון להעלאת רשימת אורחים ל-"[eventName]"!`

```typescript
export function buildUploadUrgentReminderEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  uploadUrl: string;
}): string {
  return shell(`
    <h2 style="text-align:center; color:#f44336;">🚨 תזכורת אחרונה!</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>האירוע <strong>${escapeHtml(params.eventName)}</strong> כבר
       בעוד <strong>3 ימים</strong> ועדיין אין לנו את רשימת האורחים.</p>

    <p><strong>בלי הרשימה, לא נוכל לשלוח הודעות WhatsApp לאורחים.</strong></p>

    <p>אם אתם לא מתכננים להעלות רשימה, זה בסדר - האורחים עדיין יוכלו
       להצטרף דרך QR באירוע עצמו.</p>

    <div style="text-align:center; margin:24px 0;">
      <a href="${params.uploadUrl}"
         style="background:#f44336; color:#fff; padding:14px 32px;
                border-radius:8px; text-decoration:none; font-size:16px;
                font-weight:bold; display:inline-block;">
        📥 העלו עכשיו - לפני שמאוחר!
      </a>
    </div>
  `);
}
```

### 22.5 Email #4: Event Summary (post-event)

**Trigger:** Cron job `feedback-messages` - after sending feedback WhatsApp messages
**Subject:** `📊 סיכום האירוע: "[eventName]"`

```typescript
export function buildEventSummaryEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  stats: {
    totalParticipants: number;
    fromPreEvent: number;     // joined via pre-event WhatsApp link
    fromQr: number;           // joined on-spot via QR
    totalMatches: number;
    messagesFromGuests: number;  // pre-event guest list count
    messagesDelivered: number;
    feedbackSent: number;
  };
}): string {
  return shell(`
    <h2 style="text-align:center; color:#e91e63;">📊 סיכום האירוע</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>האירוע <strong>${escapeHtml(params.eventName)}</strong> הסתיים!
       הנה סיכום קצר:</p>

    ${row('👥 משתתפים', String(params.stats.totalParticipants))}
    ${row('📱 הגיעו מ-WhatsApp', String(params.stats.fromPreEvent))}
    ${row('📸 הגיעו מ-QR', String(params.stats.fromQr))}
    ${row('💕 התאמות (Matches)', String(params.stats.totalMatches))}
    ${row('📨 הודעות שנשלחו', `${params.stats.messagesDelivered}/${params.stats.messagesFromGuests}`)}
    ${row('📝 פידבקים שנשלחו', String(params.stats.feedbackSent))}

    <p style="text-align:center; margin-top:24px; color:#888; font-size:14px;">
      תודה שבחרתם ב-Eventa! 🎉<br/>
      נשמח לארח אתכם שוב.
    </p>
  `);
}
```

### 22.6 Email #5: Messaging Add-on Invoice (manual)

**Trigger:** Admin clicks "שלחו חשבונית" for events that add messaging after the fact
**Subject:** `🧾 חשבון: שירות הודעות ל-"[eventName]" - ₪50`

```typescript
export function buildMessagingAddonInvoiceEmail(params: {
  contactName: string;
  eventName: string;
  payboxUrl: string;
  bitPhone: string;
}): string {
  return shell(`
    <h2 style="text-align:center;">🧾 חשבון: שירות הודעות לאורחים</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>הוספנו את שירות ההודעות לאורחים לאירוע
       <strong>${escapeHtml(params.eventName)}</strong>.</p>

    ${row('שירות', 'הודעות WhatsApp לאורחים')}
    ${row('מחיר', '₪50')}

    ${priceBlock(50, false)}

    <div style="text-align:center; margin:24px 0;">
      <a href="${params.payboxUrl}"
         style="background:#e91e63; color:#fff; padding:14px 32px;
                border-radius:8px; text-decoration:none; font-size:16px;
                font-weight:bold; display:inline-block;">
        💳 שלמו עכשיו (PayBox)
      </a>
    </div>

    <p style="text-align:center; font-size:14px;">
      או העבירו ₪50 ב-Bit: ${ltr(params.bitPhone)}
    </p>
  `);
}
```

### 22.7 Email #6: Custom Reminder (manual admin trigger)

**Trigger:** Admin clicks "שלחו תזכורת" manually
**Subject:** `📢 תזכורת מ-Eventa: "[eventName]"`

This is a flexible template for any manual reminders the admin wants to send.

```typescript
export function buildCustomReminderEmail(params: {
  contactName: string;
  eventName: string;
  message: string;      // Admin writes custom message text
  uploadUrl?: string;   // Optional - included if messaging-related
}): string {
  return shell(`
    <h2 style="text-align:center;">📢 תזכורת</h2>

    <p>היי ${escapeHtml(params.contactName)},</p>

    <p>${escapeHtml(params.message)}</p>

    ${params.uploadUrl ? `
      <div style="text-align:center; margin:24px 0;">
        <a href="${params.uploadUrl}"
           style="background:#e91e63; color:#fff; padding:14px 32px;
                  border-radius:8px; text-decoration:none; font-size:16px;
                  font-weight:bold; display:inline-block;">
          📥 לפורטל העלאת אורחים
        </a>
      </div>
    ` : ''}
  `);
}
```

### 22.8 Cron Job: Upload Reminders

**New file:** `src/app/api/cron/upload-reminders/route.ts`

```
Schedule: Daily at 10:00 AM (Israel time)
Runs: GET /api/cron/upload-reminders
Authorization: CRON_SECRET header (same as existing crons)

Logic:
  1. Find events WHERE:
     - wa_messages_enabled = true
     - guest_list_uploaded = false
     - status IN ('active', 'draft')
     - starts_at > now()
  2. For each event:
     - Calculate days until event
     - If days == 7 → send reminder email (#2)
     - If days == 3 → send urgent reminder email (#3)
     - (Only send each type once - track in message_log with type 'upload_reminder_7d' / 'upload_reminder_3d')
  3. Log results
```

**vercel.json addition:**
```json
{
  "crons": [
    { "path": "/api/cron/auto-archive", "schedule": "0 0 * * *" },
    { "path": "/api/cron/cleanup",      "schedule": "0 1 * * *" },
    { "path": "/api/cron/upload-reminders",   "schedule": "0 7 * * *" },
    { "path": "/api/cron/pre-event-messages",  "schedule": "0 * * * *" },
    { "path": "/api/cron/feedback-messages",   "schedule": "0 * * * *" }
  ]
}
```

---

## 23. Admin Dashboard - Full Integration

> This section specifies every UI element, tab, button, and action the admin needs
> for complete control over the messaging system. The philosophy:
> **everything is automatic, but admin can override everything with a click.**

### 23.1 Updated Sidebar

Add a new nav item to the existing Sidebar:

```typescript
// src/app/admin/_components/Sidebar.tsx - add to navItems:
{
  id: 'messaging',
  label: 'הודעות',
  icon: '📱',
  badge: pendingMessagingCount,  // events with WA enabled but no guest list
}
```

**Sidebar now has 4 items:**
```
📋 אירועים (12)          ← existing
📱 הודעות (3)             ← NEW: events needing attention
📩 בקשות (2 ממתינות)     ← existing
📊 אנליטיקס              ← existing
```

The `pendingMessagingCount` shows events where `wa_messages_enabled=true` but `guest_list_uploaded=false` and the event hasn't ended yet.

### 23.2 New "הודעות" Global View (Messaging Overview)

When admin clicks "📱 הודעות" in sidebar, show a bird's-eye view of all events with messaging:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📱 סקירת הודעות                                                        │
│                                                                         │
│ ┌─ פילטר ─────────────────────────────────────────────────────────────┐ │
│ │ [הכל] [ממתינים לרשימה] [רשימה הועלתה] [הודעות נשלחו] [הסתיים]    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ אירוע ────────────────│─ סטטוס רשימה ──│─ הודעות ──│─ פעולות ────┐  │
│ │ ערב רווקים ת"א          │ 🟢 180 מספרים  │ 180/180   │ [ניהול]    │  │
│ │ 15/03/2026, 20:00       │ הועלו ב-10/03  │ ✅ נשלחו  │            │  │
│ │─────────────────────────│────────────────│───────────│────────────│  │
│ │ ספיד דייטינג חיפה       │ 🔴 לא הועלו   │ -         │ [שלחו      │  │
│ │ 20/03/2026, 20:00       │                │           │  תזכורת]   │  │
│ │─────────────────────────│────────────────│───────────│────────────│  │
│ │ מסיבת סינגלים           │ 🟡 45 מספרים   │ ⏳ ממתין  │ [ניהול]    │  │
│ │ 25/03/2026, 21:00       │ הועלו ב-22/03  │           │            │  │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ סיכום: 3 אירועים פעילים | 225 מספרים | 180 הודעות נשלחו                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 23.3 Event Detail - New "📱 הודעות" Tab

In `EventAnalyticsView.tsx`, add a 5th tab: "📱 הודעות".
This tab only appears for events where `wa_messages_enabled = true`.

**Tab header:**
```
[סקירה] [אנליטיקס] [משתתפים] [📱 הודעות] [הגדרות]
                                  ↑ NEW
```

**Full content of the "הודעות" tab:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📱 ניהול הודעות - "ערב רווקים ת"א"                                     │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ שירותים ששולמו                                                          │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  ✅ חבילה בסיסית - ₪250                                                 │
│  ✅ הודעות לאורחים - ₪50                                                 │
│  ─────────────────────                                                  │
│  💰 סה"כ: ₪300                                                          │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ סטטוס שירות                                                             │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  WhatsApp הודעות:  ✅ פעיל     [🔴 כבו]                                 │
│  רשימת אורחים:     🟢 180 מספרים הועלו ב-10/03                          │
│  הודעות Pre-event: ✅ נשלחו 180/180 ב-15/03 17:30                       │
│  הודעות Welcome:   12 נשלחו (אורחים שהגיעו ב-QR)                        │
│  הודעות Feedback:  90 נשלחו מתוך 128 (70% הסכימו)                       │
│  עלות משוערת:      ₪35.12                                               │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ פרטי התקשרות עם הלקוח                                                   │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  👤 שם: ישראל ישראלי                                                    │
│  📞 טלפון: 050-1234567                                                  │
│  📧 אימייל: israel@gmail.com                                            │
│  📋 העדפת תקשורת: שלחו לי לינק לתשלום                                   │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ ניהול פורטל הלקוח                                                       │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  🔗 לינק פורטל: https://eventa.../guest-upload/abc?token=xyz           │
│  [📋 העתיקו] [🔄 חדשו טוקן] [📧 שלחו מייל עם לינק]                     │
│                                                                         │
│  שימוש אחרון בפורטל: 10/03/2026 14:32                                   │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ פעולות ידניות                                                           │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  [📧 שלחו תזכורת להעלאה]     - email reminder to client                 │
│  [📧 שלחו חשבונית ₪50]       - invoice email for late add-on            │
│  [📱 שלחו WA עכשיו]          - manually trigger pre-event WA blast      │
│  [📱 שלחו פידבק עכשיו]       - manually trigger feedback messages       │
│  [📧 שלחו מייל חופשי]        - custom email to client (opens modal)     │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ תזמון הודעות                                                            │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  הודעות Pre-event נשלחות: [2-3] שעות לפני האירוע   [שנו]              │
│  הודעות Feedback נשלחות: [3]   שעות אחרי האירוע     [שנו]              │
│  תזכורת העלאה ראשונה: [7]     ימים לפני האירוע      [שנו]              │
│  תזכורת העלאה שנייה:  [3]     ימים לפני האירוע      [שנו]              │
│                                                                         │
│  ℹ️ שינויים בתזמון חלים רק על אירוע זה.                                 │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ רשימת אורחים (180)                                                      │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  🔍 [חפשו שם או מספר...]                                                │
│                                                                         │
│  [⬆ העלו קובץ] [+ הוסיפו מספר] [📥 הורידו רשימה (CSV)]                 │
│                                                                         │
│  ┌──────────────┬───────────────┬───────────┬───────────┬──────────────┐│
│  │ שם           │ טלפון         │ WA נשלח   │ הצטרף/ה?  │ פעולה        ││
│  │──────────────│───────────────│───────────│───────────│──────────────││
│  │ דנה כהן      │ 050-123-4567  │ ✅ 17:30  │ ✅ 19:15  │ [🗑]         ││
│  │ יוסי לוי     │ 052-987-6543  │ ✅ 17:30  │ ❌        │ [🗑]         ││
│  │ מאיה בר      │ 054-555-1234  │ ✅ 17:31  │ ✅ 18:50  │ [🗑]         ││
│  │ (ללא שם)     │ 058-444-5678  │ ❌ שגיאה  │ ❌        │ [🔄] [🗑]    ││
│  │ ...          │ ...           │ ...       │ ...       │ ...          ││
│  └──────────────┴───────────────┴───────────┴───────────┴──────────────┘│
│                                                                         │
│  📄 עמוד 1 מתוך 4                            [◄ הקודם] [הבא ►]         │
│                                                                         │
│  📊 סיכום: 180 ברשימה → 87 הצטרפו (48.3%) | 93 לא הצטרפו | 2 שגיאות   │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════  │
│ לוג הודעות                                                              │
│ ═══════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  ┌──────────┬───────────┬────────────┬──────────┬────────────────────┐  │
│  │ זמן      │ סוג       │ ערוץ       │ טלפון    │ סטטוס              │  │
│  │──────────│───────────│────────────│──────────│────────────────────│  │
│  │ 17:30    │ Pre-event │ WhatsApp   │ 050-***  │ ✅ Delivered       │  │
│  │ 17:30    │ Pre-event │ WhatsApp   │ 052-***  │ ✅ Delivered       │  │
│  │ 17:31    │ Pre-event │ WhatsApp   │ 054-***  │ ❌ Failed: invalid │  │
│  │ 19:15    │ OTP       │ SMS        │ 050-***  │ ✅ Delivered       │  │
│  │ 19:15    │ Welcome   │ WhatsApp   │ 058-***  │ ✅ Delivered       │  │
│  │ 23:30    │ Feedback  │ WhatsApp   │ 050-***  │ ✅ Read            │  │
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 23.4 Cross-Reference: Guest List → Actual Participants

This is the "הצטרף/ה?" column in the guest list table. It cross-references by matching phone numbers:

```typescript
// Logic: for each phone in event_guest_phones,
// check if same phone exists in participants for same event.

interface GuestCrossReference {
  guestPhone: EventGuestPhone;
  participant: AdminParticipant | null;  // null = didn't join
  joinedAt: string | null;
  joinSource: 'pre_event_link' | 'qr_on_spot' | null;
}

// Query:
const crossRef = await supabase.rpc('cross_reference_guests', { p_event_id: eventId });

// SQL function:
CREATE OR REPLACE FUNCTION cross_reference_guests(p_event_id UUID)
RETURNS TABLE (
  guest_phone_id UUID,
  guest_name TEXT,
  phone TEXT,
  wa_sent BOOLEAN,
  wa_sent_at TIMESTAMPTZ,
  participant_id UUID,
  participant_name TEXT,
  joined_at TIMESTAMPTZ,
  has_pre_event_message BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.id,
    gp.guest_name,
    gp.phone,
    gp.wa_pre_event_sent,
    gp.wa_pre_event_sent_at,
    p.id,
    p.display_name,
    p.created_at,
    gp.wa_pre_event_sent
  FROM event_guest_phones gp
  LEFT JOIN participants p ON p.event_id = gp.event_id AND p.phone = gp.phone
  WHERE gp.event_id = p_event_id
  ORDER BY gp.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Cross-reference summary card (top of guest list):**

```
┌───────────────────────────────────────────────────────────────┐
│ 📊 מי הגיע מהרשימה?                                          │
│                                                               │
│  180 ברשימה                                                   │
│  ├── 87 הצטרפו (48.3%)  ← joined via pre-event link          │
│  ├── 93 לא הצטרפו       ← received WA but didn't join        │
│  ├── 41 הצטרפו מ-QR     ← not in pre-event list, joined live │
│  └── 128 סה"כ משתתפים                                         │
│                                                               │
│  🔑 תובנה: הודעת ה-WhatsApp הביאה 68% מהמשתתפים!             │
└───────────────────────────────────────────────────────────────┘
```

### 23.5 Per-Participant Messaging Status

In the **Participants** tab of EventAnalyticsView, extend the ParticipantsTable with new columns:

**Updated AdminParticipant type** (`shared.ts`):

```typescript
export interface AdminParticipant {
  id: string;
  display_name: string;
  gender: 'male' | 'female';
  age: number;
  is_banned: boolean;
  created_at: string;
  profile_complete: boolean;
  // ─── NEW: Messaging fields ───
  phone: string | null;              // masked: "050-***-4567"
  sms_consent: boolean;
  feedback_sent: boolean;
  was_in_pre_event_list: boolean;    // computed: phone exists in event_guest_phones
  join_source: 'pre_event_link' | 'qr_on_spot';  // how they joined
  wa_messages_received: string[];     // ['pre_event', 'welcome', 'feedback']
}
```

**Updated ParticipantsTable columns:**

```
┌──────────┬──────┬─────┬────────────┬──────────┬─────────┬──────────┬──────┐
│ שם       │ מין  │ גיל │ הצטרף/ה    │ טלפון    │ מקור    │ פידבק    │ חסום │
│──────────│──────│─────│────────────│──────────│─────────│──────────│──────│
│ דנה כהן  │ נקבה │ 28  │ 15/03 19:15│ 050-***  │ 📱 WA   │ ✅ נשלח  │ [🚫] │
│ יוסי לוי │ זכר  │ 32  │ 15/03 20:01│ 052-***  │ 📸 QR   │ ❌ סירב │ [🚫] │
│ מאיה בר  │ נקבה │ 26  │ 15/03 18:50│ 054-***  │ 📱 WA   │ ✅ נשלח  │ [🚫] │
└──────────┴──────┴─────┴────────────┴──────────┴─────────┴──────────┴──────┘
```

**New columns explained:**

| Column | Source | Value |
|--------|--------|-------|
| טלפון (phone) | `participants.phone`, masked | `050-***-4567` or `-` if no phone |
| מקור (source) | computed from pre-event list | 📱 WA = was in pre-event list, 📸 QR = joined on-spot |
| פידבק (feedback) | `participants.feedback_sent` + `sms_consent` | ✅ נשלח / ❌ סירב / ⏳ ממתין / - (no phone) |

**Filter additions:**
```
[הכל] [זכר] [נקבה] [📱 WA] [📸 QR] [הסכימו לפידבק] [חסומים]
```

### 23.6 Event Detail Overview - Services & Pricing

In the **Overview** tab of EventAnalyticsView, add a new "שירותים" (Services) section:

```
┌───────────────────────────────────────────────────────────────┐
│ 🧾 שירותים ששולמו                                             │
│                                                               │
│  ✅ חבילה בסיסית (אירוע + אפליקציה)    ₪250                  │
│  ✅ הודעות WhatsApp לאורחים              ₪50                   │
│  ─────────────────────────────────────────                     │
│  סה"כ: ₪300                                                   │
│                                                               │
│  📋 בקשות מיוחדות: "אנא הוסיפו רקע עם לוגו שלנו"             │
│                                                               │
│  👤 איש קשר: ישראל ישראלי                                     │
│  📞 050-1234567 | 📧 israel@gmail.com                          │
│  📋 העדפת תקשורת: שלחו לינק לתשלום                            │
└───────────────────────────────────────────────────────────────┘
```

**Data source:** Join `events` → `event_requests` (via `approved_event_id`) to get:
- `wants_guest_messages` → show messaging add-on
- `contact_name`, `contact_phone`, `contact_email`, `contact_preference`
- `special_requests`
- Price calculation (same as `priceBlock()` in email templates)

### 23.7 Request Cards - Enhanced Messaging Display

In `RequestsView.tsx`, the `wantsGuestMessages` info already shows as `✅ הודעות לאורחים` or `❌ ללא הודעות` in the request card. Enhance it with pricing:

```
┌─── בקשה חדשה ────────────────────────────────────────────────┐
│ 🎉 ערב רווקים - תל אביב                                      │
│ 📅 15/03/2026, 20:00-23:00                                    │
│                                                               │
│ 💰 חבילה: בסיסית + הודעות = ₪300                              │  ← enhanced
│ 📱 הודעות לאורחים: ✅ כן                                      │  ← existing
│                                                               │
│ 👤 ישראל ישראלי | 📞 050-1234567                               │
│ 📧 israel@gmail.com                                            │
│ 📋 העדפה: שלחו לי לינק                                       │
│                                                               │
│ 📝 בקשות מיוחדות: "רקע עם הלוגו שלנו"                         │
│                                                               │
│ הערות אדמין: [___________________________________]            │
│                                                               │
│ [✅ אשרו]  [❌ דחו]                                           │
└───────────────────────────────────────────────────────────────┘
```

### 23.8 Admin Action Buttons - Complete List

Every manual action available to the admin, describing WHAT it does and WHEN to use it:

| # | Button | Where | What it does | When to use |
|---|--------|-------|-------------|-------------|
| 1 | **✅/🔴 הפעילו/כבו WA** | Messages tab | Toggle `wa_messages_enabled` on event | Client changes mind about messaging |
| 2 | **📧 שלחו הוראות העלאה** | Messages tab | Send upload instructions email (#1) to client | On approval (auto), or re-send manually |
| 3 | **📧 שלחו תזכורת להעלאה** | Messages tab | Send upload reminder email | Client hasn't uploaded yet |
| 4 | **📧 שלחו חשבונית ₪50** | Messages tab | Send messaging addon invoice email (#5) | Client adds messaging after-the-fact |
| 5 | **📧 שלחו מייל חופשי** | Messages tab | Opens modal with text area, sends custom email | Any client communication |
| 6 | **📋 העתיקו לינק פורטל** | Messages tab | Copy portal URL to clipboard | Send link via WhatsApp/SMS manually |
| 7 | **🔄 חדשו טוקן** | Messages tab | Regenerate portal token (deactivates old one) | Security concern, link shared incorrectly |
| 8 | **📧 שלחו מייל עם לינק** | Messages tab | Re-send upload instructions email with new link | Client lost the email |
| 9 | **⬆ העלו קובץ** | Messages tab | Admin uploads CSV/Excel on behalf of client | Client calls and gives numbers verbally |
| 10 | **+ הוסיפו מספר** | Messages tab | Add individual phone to guest list | Single addition |
| 11 | **🗑 הסירו** (per row) | Messages tab | Remove phone from guest list | Wrong number / delete request |
| 12 | **📥 הורידו רשימה** | Messages tab | Download current guest list as CSV | Backup, external use |
| 13 | **📱 שלחו WA עכשיו** | Messages tab | Manually trigger pre-event WhatsApp blast NOW | Override timing, test before event |
| 14 | **📱 שלחו פידבק עכשיו** | Messages tab | Manually trigger feedback messages NOW | Override timing |
| 15 | **🔄 שלחו שוב** (per row) | Messages tab | Retry failed WhatsApp send for specific phone | Message failed, try again |
| 16 | **שנו** (timing) | Messages tab | Change pre-event/feedback timing for this event | Custom scheduling |

### 23.9 Message Scheduling Controls

**Default timing (from config):**
```typescript
// in config.ts:
export const MSG_TIMING = {
  PRE_EVENT_HOURS_BEFORE: 3,       // send pre-event WA 3 hours before
  FEEDBACK_HOURS_AFTER: 3,         // send feedback WA 3 hours after end
  UPLOAD_REMINDER_DAYS: [7, 3],    // remind to upload at 7 and 3 days before
} as const;
```

**Per-event override:**
Store custom timing in a new column or JSON field on `events`:

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS messaging_config JSONB DEFAULT '{}';

-- Example value:
-- {
--   "pre_event_hours_before": 2,
--   "feedback_hours_after": 4,
--   "upload_reminder_days": [10, 5, 2]
-- }
```

**UI:** Each timing has an editable value + "שנו" button that opens an inline input:

```
הודעות Pre-event נשלחות: 2-3 שעות לפני  → [input: 3] שעות   [שמרו]
                                          (min: 1, max: 24)
```

### 23.10 Admin "הודעות" Types Summary (shared.ts additions)

```typescript
// Add to shared.ts:

export interface EventMessagingStatus {
  wa_messages_enabled: boolean;
  guest_list_uploaded: boolean;
  guest_list_uploaded_at: string | null;
  guest_list_count: number;
  pre_event_sent: boolean;
  pre_event_sent_at: string | null;
  pre_event_sent_count: number;
  pre_event_failed_count: number;
  welcome_sent_count: number;
  feedback_sent_count: number;
  feedback_eligible_count: number;
  estimated_cost: number;         // calculated from message_log
  portal_token: string | null;
  portal_last_used_at: string | null;
  messaging_config: {
    pre_event_hours_before: number;
    feedback_hours_after: number;
    upload_reminder_days: number[];
  };
}

export interface GuestPhoneAdmin {
  id: string;
  phone: string;                // full phone (admin sees unmasked)
  guest_name: string | null;
  wa_pre_event_sent: boolean;
  wa_pre_event_sent_at: string | null;
  participant_id: string | null;    // null = didn't join
  participant_name: string | null;
  joined_at: string | null;
  wa_delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
}

export interface MessageLogEntry {
  id: string;
  created_at: string;
  phone: string;             // masked for display: "050-***-4567"
  channel: 'sms' | 'whatsapp';
  message_type: 'otp' | 'pre_event' | 'welcome' | 'feedback';
  status: 'sent' | 'delivered' | 'failed' | 'read';
  error_message: string | null;
}

// Update EventAnalytics to include messaging:
export interface EventAnalytics {
  // ... all existing fields ...
  messaging: EventMessagingStatus | null;  // null if wa_messages_enabled=false
}
```

### 23.11 useAdminData Hook - New Functions

Add to `useAdminData.ts`:

```typescript
// ─── Messaging functions ───

// Fetch messaging status for an event
async function loadMessagingStatus(eventId: string): Promise<EventMessagingStatus>

// Toggle WA messaging on/off
async function toggleMessaging(eventId: string, enabled: boolean): Promise<void>

// Load guest phone list (with cross-reference)
async function loadGuestPhones(eventId: string): Promise<GuestPhoneAdmin[]>

// Upload guest file (Excel/CSV) - admin doing it on behalf of client
async function uploadGuestFile(eventId: string, file: File): Promise<UploadValidationResult>

// Add single phone
async function addGuestPhone(eventId: string, phone: string, name?: string): Promise<void>

// Remove phone from guest list
async function removeGuestPhone(eventId: string, phoneId: string): Promise<void>

// Download guest list as CSV
async function downloadGuestList(eventId: string): Promise<Blob>

// Regenerate portal token
async function regeneratePortalToken(eventId: string): Promise<string>

// Send manual email to client
async function sendClientEmail(
  eventId: string,
  type: 'upload_instructions' | 'upload_reminder' | 'invoice' | 'custom',
  customMessage?: string
): Promise<void>

// Manually trigger pre-event WA blast
async function triggerPreEventMessages(eventId: string): Promise<{ sent: number; failed: number }>

// Manually trigger feedback messages
async function triggerFeedbackMessages(eventId: string): Promise<{ sent: number; failed: number }>

// Retry failed message for specific phone
async function retryMessage(eventId: string, messageLogId: string): Promise<void>

// Load message log
async function loadMessageLog(eventId: string): Promise<MessageLogEntry[]>

// Update message timing config
async function updateMessagingConfig(
  eventId: string,
  config: Partial<EventMessagingStatus['messaging_config']>
): Promise<void>
```

---

## 24. Data Retention & Discount Tracking

### 24.1 Data Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Lifecycle             │ What happens to phone data                      │
│───────────────────────│─────────────────────────────────────────────────│
│ Event active          │ All data present: participants, guest phones,   │
│                       │ message log, portal tokens                      │
│───────────────────────│─────────────────────────────────────────────────│
│ Event ends            │ No changes - data intact for admin review       │
│───────────────────────│─────────────────────────────────────────────────│
│ Event archived        │ Portal tokens deactivated. Guest upload portal  │
│ (auto, T+7 days)      │ returns "האירוע הסתיים".                        │
│                       │ All other data still present.                   │
│───────────────────────│─────────────────────────────────────────────────│
│ Event deleted         │ CASCADE deletes:                                │
│                       │   - participants (including phones)             │
│                       │   - event_guest_phones                          │
│                       │   - message_log                                 │
│                       │   - otp_verifications                           │
│                       │   - client_portal_tokens                        │
│                       │                                                 │
│                       │ PRESERVED (ON DELETE SET NULL):                 │
│                       │   - discount_claims (event_id → NULL,           │
│                       │     but event_name + event_date remain)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 24.2 discount_claims Table

When the feedback cron job sends a WhatsApp message with a discount code:

```sql
-- After successfully sending feedback WA with discount code:
INSERT INTO discount_claims (phone, discount_code, event_name, event_date, event_id, wa_message_id)
VALUES (
  '+972501234567',
  'EVENTA10',          -- configurable per campaign
  'ערב רווקים ת"א',    -- denormalized - survives event deletion
  '2026-03-15',        -- denormalized
  'uuid-of-event',     -- SET NULL on event deletion
  'uuid-of-message-log'
);
```

### 24.3 Discount Code Validation Flow

When someone contacts the admin claiming they have a discount code:

```
Admin receives: "I have code EVENTA10 from the Tel Aviv event"
  ↓
Admin opens admin dashboard → goes to a discount lookup tool (or does it mentally)
  ↓
Query: SELECT * FROM discount_claims
       WHERE discount_code = 'EVENTA10'
       AND phone = '+972501234567'  -- if admin has the phone
       AND is_redeemed = false
  ↓
Found → Mark as redeemed:
  UPDATE discount_claims
  SET is_redeemed = true, redeemed_at = now()
  WHERE id = '...'
  ↓
Apply 10% discount to new order
```

**Admin UI for discount validation** (optional, can be in global tools later):

```
┌───────────────────────────────────────────────────────────────┐
│ 🏷 בדיקת קוד הנחה                                            │
│                                                               │
│ קוד: [EVENTA10]  טלפון: [0501234567]  [בדקו]                 │
│                                                               │
│ ✅ קוד תקין!                                                  │
│    אירוע: ערב רווקים ת"א (15/03/2026)                         │
│    סטטוס: לא נוצל                                             │
│    [מסמנו כנוצל]                                              │
└───────────────────────────────────────────────────────────────┘
```

### 24.4 What Persists After Event Deletion - Complete List

| Data | Table | Behavior on event deletion |
|------|-------|----|
| Participants (all data) | `participants` | **DELETED** (CASCADE) |
| Guest phone list | `event_guest_phones` | **DELETED** (CASCADE) |
| Message log | `message_log` | **DELETED** (CASCADE) |
| OTP records | `otp_verifications` | **DELETED** (CASCADE) |
| Portal tokens | `client_portal_tokens` | **DELETED** (CASCADE) |
| Discount claims | `discount_claims` | **PRESERVED** (event_id → NULL) |
| Event request | `event_requests` | **PRESERVED** (approved_event_id → NULL) |

---

## 25. Complete Message Content

### 25.1 All SMS Messages

Only OTP verification uses SMS. One template:

```
קוד האימות שלך ל-{event_name}: {code}
תוקף: 5 דקות. לא שיתפו עם אף אחד.
```

Example:
```
קוד האימות שלך ל-ערב רווקים ת"א: 483921
תוקף: 5 דקות. לא שיתפו עם אף אחד.
```

Length: ~70 chars (well within 160 char SMS limit)

### 25.2 All WhatsApp Messages

**Message 1: Pre-event (Marketing template - requires Meta approval)**

```
Template name: eventa_pre_event_invite
Language: he
Category: MARKETING

Header: 🎉 {{1}} (event_name)
Body:
היי{{1}}! (guest_name, or empty)
בעוד כמה שעות מתחיל {{2}}! (event_name)

הצטרפו לאפליקציה כדי להכיר רווקים ורווקות:
{{3}} (join_link)

לחצו על הלינק, הזינו מספר טלפון, ותתחילו! 🚀

Footer: Eventa - אירועי היכרויות
Buttons: [הצטרפו עכשיו → {{3}}]
```

**Message 2: Welcome (Marketing template - for QR joiners)**

```
Template name: eventa_welcome
Language: he
Category: MARKETING

Body:
ברוכים הבאים ל-{{1}}! 🎉 (event_name)

הפרופיל שלכם מוכן. התחילו לגלוש, לציין לייקים,
ולהתכתב עם ההתאמות שלכם.

בהצלחה! 💕

Footer: Eventa
```

**Message 3: Feedback (Marketing template - rides on existing window)**

```
Template name: eventa_feedback
Language: he
Category: MARKETING

Body:
תודה שהשתתפתם ב-{{1}}! 🎉 (event_name)

נהניתם? נשמח לשמוע:
{{2}} (feedback_link - can be a Google Form or future feedback page)

כהוקרה - קוד הנחה 10% לאירוע הבא:
🏷 {{3}} (discount_code)

נתראה באירוע הבא! 💕

Footer: Eventa
```

### 25.3 Template Variables Reference

| Variable | Source | Used in |
|----------|--------|---------|
| `event_name` | `events.event_name` | All WA messages |
| `guest_name` | `event_guest_phones.guest_name` | Pre-event only |
| `join_link` | `https://eventa.productions/dating/[slug]/join?k=[joinCode]` | Pre-event |
| `feedback_link` | Configurable (Google Form URL by default) | Feedback |
| `discount_code` | Generated per campaign (e.g., `EVENTA10`) | Feedback |
| `code` (OTP) | Generated 6-digit number | SMS OTP |

### 25.4 Consent Checkbox in Join Flow

```
Registration page (after phone OTP verification, in setup form):

☑ אני מסכים/ה לתנאי השימוש ומדיניות הפרטיות     (required, existing)
☑ אני מסכים/ה לקבל הודעות WhatsApp מ-Eventa      (optional, default: checked)
  (כולל סיכום האירוע וקוד הנחה)
```

- If checked → `sms_consent = true` → will receive welcome + feedback WA
- If unchecked → `sms_consent = false` → will NOT receive welcome or feedback
- Pre-event WA is sent regardless (it's to event_guest_phones, not participants)
- OTP SMS is always sent (transactional, not marketing)

---

## 26. Updated Summary

### 26.1 Complete File Count (Sections 1–25)

| Component | Files | Complexity |
|-----------|-------|-----------|
| **Core Infrastructure** | | |
| Database migration | 1 SQL file | Medium |
| Phone utilities | 1 file | Low |
| OTP system | 1 file | Medium |
| SMS provider | 1 file | Low |
| WhatsApp provider | 1 file | Low |
| Messaging orchestrator | 1 file | Medium |
| SMS/WA message templates | 1 file | Low |
| Guest upload parser | 1 file | Medium |
| API: send-otp | 1 route | Medium |
| API: verify-otp | 1 route | High |
| API: cron pre-event | 1 route | Medium |
| API: cron feedback | 1 route | Medium |
| API: cron upload-reminders | 1 route | Low |
| API: admin guests | 1 route | Medium |
| API: admin portal-token | 1 route | Low |
| API: admin messaging | 1 route | Medium |
| API: admin send-email | 1 route | Medium |
| API: guest-portal | 1 route (multi-method) | Medium |
| API: guest-portal template download | 1 route | Low |
| Client: join page | 1 modified file | High |
| Client: PhoneInput | 1 component | Medium |
| Client: OtpInput | 1 component | Medium |
| **Client Portal** | | |
| Guest upload page | 1 page | High |
| UploadZone component | 1 component | Medium |
| GuestListTable component | 1 component | Medium |
| AddPhoneForm component | 1 component | Low |
| UploadResult component | 1 component | Low |
| ExcelTemplateDownload | 1 component | Low |
| Excel template file | 1 static file | Low |
| **Admin Dashboard** | | |
| MessagingTab | 1 component | High |
| GuestListManager | 1 component | High |
| MessageLog | 1 component | Medium |
| CrossReferenceTable | 1 component | Medium |
| MessagingControls | 1 component | Medium |
| EventServicesInfo | 1 component | Low |
| **Email Templates** | | |
| 6 new email templates | 1 modified file | Medium |
| **Modified Files** | | |
| Client API functions | 1 modified file | Low |
| Validations | 1 modified file | Low |
| Database types | 1 modified file | Low |
| Config | 1 modified file | Low |
| Vercel config | 1 modified file | Low |
| shared.ts (admin types) | 1 modified file | Medium |
| useAdminData.ts (hook) | 1 modified file | High |
| EventAnalyticsView | 1 modified file | Medium |
| ParticipantsTable | 1 modified file | Medium |
| Sidebar | 1 modified file | Low |
| RequestsView | 1 modified file | Low |
| email-templates.ts | 1 modified file | Medium |
| **Total** | **~45 files** | **Estimated: 7-10 days** |

### 26.2 Implementation Order

```
Phase 1: Database + Core Infrastructure    (Day 1-2)
  - Migration SQL (all tables + columns)
  - Phone utilities, OTP system
  - SMS provider, WhatsApp provider, messaging service
  - Message templates

Phase 2: API Routes                        (Day 2-3)
  - send-otp, verify-otp
  - Guest portal API (token validation, upload, add, remove, template download)
  - Admin guests, portal-token, messaging, send-email routes

Phase 3: Client-Side (Join + Portal)       (Day 3-5)
  - Phone input + OTP flow in join page
  - Guest upload portal (full page with all components)
  - Excel template file

Phase 4: Email Templates + Crons           (Day 5-6)
  - 6 new email templates
  - upload-reminders cron
  - pre-event-messages cron
  - feedback-messages cron

Phase 5: Admin Dashboard                   (Day 6-8)
  - MessagingTab + sub-components
  - Cross-reference + per-participant status
  - Event services info
  - All action buttons wired up
  - Sidebar messaging nav

Phase 6: Testing + Polish                  (Day 8-10)
  - Unit tests for phone utils, OTP, upload validation
  - Integration tests for all new API routes
  - E2E tests for join flow, portal, admin messaging
  - Manual testing checklist
```

### 26.3 API Routes Summary (All New)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/send-otp` | public | Send OTP SMS |
| POST | `/api/auth/verify-otp` | public | Verify OTP, create/reconnect session |
| GET | `/api/guest-portal/[token]` | token | Get portal data + guest list |
| POST | `/api/guest-portal/[token]` | token | Upload file or add phone |
| DELETE | `/api/guest-portal/[token]` | token | Remove phone from list |
| GET | `/api/guest-portal/[token]/download-template` | token | Download Excel template |
| GET | `/api/admin/events/[id]/guests` | admin | List guest phones |
| POST | `/api/admin/events/[id]/guests` | admin | Upload guests (admin) |
| DELETE | `/api/admin/events/[id]/guests` | admin | Remove guest phone |
| POST | `/api/admin/events/[id]/portal-token` | admin | Generate/regenerate portal token |
| GET | `/api/admin/events/[id]/portal-token` | admin | Get current portal link |
| PATCH | `/api/admin/events/[id]/messaging` | admin | Toggle WA, update timing |
| POST | `/api/admin/events/[id]/messaging` | admin | Manual trigger (pre-event/feedback) |
| POST | `/api/admin/events/[id]/send-email` | admin | Send email to client |
| GET | `/api/cron/upload-reminders` | cron | Check + send upload reminder emails |
| GET | `/api/cron/pre-event-messages` | cron | Send pre-event WhatsApp |
| GET | `/api/cron/feedback-messages` | cron | Send feedback WhatsApp + summary email |

---
---

# Part III: Payment, Event Creation & Stub Architecture

> **Section 27** is a deep-dive into the **complete purchase → payment → event creation lifecycle**.
> It answers: what triggers event creation? how do we track payment? what's the difference
> between a client-purchased event and an admin-created one? how do payment link stubs work?
> how long do payment links last? and what happens in each contact preference flow.

---

## 27. Purchase, Payment & Event Creation Lifecycle

### 27.1 The Two Ways an Event Gets Created

There are exactly **two paths** to create an event in the system:

```
Path A: Client-Purchased Event (via /api/order → event_requests → admin approval)
Path B: Admin Manual Creation  (via CreateEventDialog → /api/admin/events)
```

These paths capture **different amounts of data**, produce events with **different origins**,
and have **different payment implications**. The resulting `events` row is structurally
identical - but the metadata around it (who ordered, what they paid, contact info) only
exists for Path A events.

#### Path A: Client Purchase Flow (Current)

```
Client fills pricing wizard (/dating/order)
  ↓
POST /api/order
  ↓
1. Validate with Zod schema (15+ fields)
2. INSERT into event_requests (status='pending')      ← ALWAYS saved, before any payment
3. Send admin notification email
4. If contactPreference='send-link' AND has email:
     → Send payment email to client (PayBox/Bit stubs)
  ↓
Admin sees request in RequestsView
  ↓
Admin clicks "אשר" → POST /api/admin/requests
  ↓
1. INSERT into events (from request data)
2. Upload background image (if any)
3. UPDATE event_requests: status='approved', approved_event_id=event.id
  ↓
Event is live ✅
```

#### Path B: Admin Manual Creation (Current)

```
Admin opens CreateEventDialog
  ↓
1. Select event type (from EVENT_TYPE_LABELS grid)
2. Enter name, starts_at, ends_at, description (optional)
  ↓
POST /api/admin/events
  ↓
INSERT into events (5 fields only)
  ↓
Event is live ✅
```

### 27.2 Field Comparison: Client Purchase vs Admin Creation

| Field | Client Purchase (Path A) | Admin Manual (Path B) | Where it lives |
|-------|--------------------------|----------------------|----------------|
| **event_type** | ✅ Required (from wizard) | ✅ Required (from grid) | `events` |
| **name / event_name** | ✅ Required | ✅ Required | `events` |
| **starts_at** | ✅ Required (date+time picker) | ✅ Required | `events` |
| **ends_at** | ✅ Required (date+time picker) | ✅ Required | `events` |
| **description** | Via `special_requests` field | ✅ Optional (free text) | `events` |
| **slug** | Auto-generated on approval | Auto-generated on creation | `events` |
| **join_code** | Auto-generated on approval | Auto-generated on creation | `events` |
| **background_image** | ✅ Optional (upload in wizard) | ❌ Not available | `events` |
| **wantsCustomBackground** | ✅ Boolean | ❌ N/A | `event_requests` only |
| **posterChoice** | ✅ 'template' or 'qr-only' | ❌ N/A | `event_requests` only |
| **selectedTemplateId** | ✅ Optional (template picker) | ❌ N/A | `event_requests` only |
| **wantsGuestMessages** | ✅ Boolean | ❌ N/A | `event_requests` only |
| **contactName** | ✅ Required | ❌ N/A | `event_requests` only |
| **contactPhone** | ✅ Required | ❌ N/A | `event_requests` only |
| **contactEmail** | ✅ Optional | ❌ N/A | `event_requests` only |
| **contactPreference** | ✅ 'call-me' or 'send-link' | ❌ N/A | `event_requests` only |
| **specialRequests** | ✅ Optional (free text) | ❌ N/A | `event_requests` only |
| **payment_status** | ✅ Tracked (NEW) | ❌ N/A (no purchase) | `event_requests` only |

**Key insight:** The `events` table itself has the **exact same columns** regardless of
creation path. The difference is that Path A events have a linked `event_requests` row
containing contact info, payment status, pricing, preferences, and messaging config.
Path B events have NO linked request - they're created "bare" with just the essentials.

### 27.3 What the Admin Sees - Visual Difference

When reviewing an event in the admin dashboard, the **Overview** tab shows different info
depending on the event's origin:

**Path A event (from client purchase):**
```
┌───────────────────────────────────────────────────────────────┐
│ 📦 מקור: הזמנת לקוח                                          │
│                                                               │
│ 🧾 שירותים ששולמו                                             │
│  ✅ חבילה בסיסית (אירוע + אפליקציה)    ₪250                  │
│  ✅ הודעות WhatsApp לאורחים              ₪50                   │
│  ─────────────────────────────────────────                     │
│  💰 סה"כ: ₪300                                                │
│  💳 סטטוס תשלום: ✅ שולם (PayBox, 15/03/2026)                 │
│                                                               │
│  👤 איש קשר: ישראל ישראלי                                     │
│  📞 050-1234567 | 📧 israel@gmail.com                          │
│  📋 העדפת תקשורת: שלחו לינק לתשלום                            │
│  📝 בקשות מיוחדות: "רקע עם הלוגו שלנו"                        │
└───────────────────────────────────────────────────────────────┘
```

**Path B event (admin-created):**
```
┌───────────────────────────────────────────────────────────────┐
│ 📦 מקור: נוצר ידנית על ידי אדמין                               │
│                                                               │
│  (אין פרטי הזמנה או תשלום - אירוע שנוצר ישירות)                │
└───────────────────────────────────────────────────────────────┘
```

**Implementation:** Check if `event_requests.approved_event_id = event.id` exists.
If yes → show full purchase info. If no → show "created manually" note.

### 27.4 Complete Contact Preference Flows

There are **two contact preference flows**, plus a **switch mechanism**:

#### Flow 1: "שלחו לי לינק" (send-link) - Autonomous Payment

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step │ What happens                                                     │
│──────│──────────────────────────────────────────────────────────────────│
│  1   │ Client fills wizard, selects "שלחו לי לינק לתשלום"               │
│      │ → contactPreference = 'send-link'                                │
│  2   │ POST /api/order:                                                 │
│      │   a. Save to event_requests (status='pending',                   │
│      │      payment_status='awaiting_payment')                          │
│      │   b. Send admin notification email                               │
│      │   c. Send payment email to client with:                          │
│      │      - Order summary (event type, dates, pricing)                │
│      │      - PayBox button (STUB: href="#")                            │
│      │      - Bit button (STUB: href="#")                               │
│      │      - "צרו איתי קשר" fallback button                            │
│      │      - Payment link token (for future tracking)                  │
│  3   │ Client receives email. Three possible outcomes:                  │
│      │                                                                  │
│      │   3a. Client clicks PayBox/Bit → [STUB - currently no-op]        │
│      │       Future: redirects to payment provider, webhook confirms    │
│      │       payment, payment_status → 'paid'                           │
│      │                                                                  │
│      │   3b. Client clicks "צרו איתי קשר" → switches to call-me flow   │
│      │       (see "Switch Mechanism" below)                             │
│      │                                                                  │
│      │   3c. Client does nothing → request stays pending                │
│      │       Admin sees it in RequestsView and can call them            │
│  4   │ Admin reviews request:                                           │
│      │   - Sees payment_status ('awaiting_payment' / 'paid' / 'waived') │
│      │   - Can approve regardless of payment status (manual override)   │
│      │   - On approve: event is created                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Flow 2: "התקשרו אליי" (call-me) - Admin-Assisted Payment

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step │ What happens                                                     │
│──────│──────────────────────────────────────────────────────────────────│
│  1   │ Client fills wizard, selects "התקשרו אליי"                       │
│      │ → contactPreference = 'call-me'                                  │
│  2   │ POST /api/order:                                                 │
│      │   a. Save to event_requests (status='pending',                   │
│      │      payment_status='awaiting_contact')                          │
│      │   b. Send admin notification email (with client phone + name)    │
│      │   c. NO payment email sent to client                             │
│  3   │ Admin sees request in dashboard                                  │
│      │   - Calls client at the phone number they provided               │
│      │   - Discusses event details, confirms pricing                    │
│      │   - Payment happens over the phone (credit card) or              │
│      │     in person (cash/Bit transfer)                                │
│  4   │ Admin records payment in dashboard:                              │
│      │   - Clicks "סמנו כשולם" button in request card                   │
│      │   - Selects payment method (paybox/bit/bank/cash)                │
│      │   - payment_status → 'paid', payment_method → selected           │
│  5   │ Admin approves request → event is created                        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Switch Mechanism: send-link → call-me

```
Client received payment email but wants to talk first
  ↓
Clicks "צרו איתי קשר" button in payment email
  ↓
GET /api/order/contact-me?id={requestId}
  ↓
1. Update contact_preference → 'call-me' in event_requests
2. Send buildContactMeInsteadEmail to admin (notification)
3. Show branded confirmation page: "נחזור אליכם תוך 48 שעות"
  ↓
Flow continues as call-me (Flow 2, step 3)
```

**There is no reverse switch** (call-me → send-link). If a "call-me" client later
wants a payment link, the admin sends it manually via the "שלחו מייל חופשי" action.

### 27.5 What Triggers Event Creation?

**The answer: Admin approval triggers event creation. NOT payment.**

```
                    ┌──────────────────────────┐
                    │                          │
  Client submits →  │    event_requests        │  ← ORDER is saved here
  order form        │    (status='pending')    │     ALWAYS, immediately
                    │                          │     BEFORE any payment
                    └─────────┬────────────────┘
                              │
                    Admin clicks "אשר"
                              │
                              ▼
                    ┌──────────────────────────┐
                    │                          │
                    │    events                │  ← EVENT is created here
                    │    (status='active')     │     ONLY on admin approval
                    │                          │
                    └──────────────────────────┘
```

**Why not on payment?**
1. Payment services are **stubs right now** - there's no payment webhook to trigger anything
2. Even when payment is live, admin should have **final control** over event creation
3. Some events are **free/promotional** - payment doesn't apply
4. "call-me" events have **offline payment** - can't automate
5. Admin may want to **deny** even paid requests (fraud, spam, bad content)

**Payment verification is advisory, not a gate:**
The admin sees the `payment_status` in the request card but can approve/deny regardless.
When payment services go live, the flow becomes:

```
Future flow (with real PayBox/Bit):
  Client pays → webhook updates payment_status → 'paid'
  Admin sees ✅ paid → clicks approve → event created

  OR: Client doesn't pay → admin sees ⏳ pending → contacts client → resolves
```

### 27.6 The Order Lifecycle - Complete State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     event_requests STATE MACHINE                    │
│                                                                     │
│  ┌──────────┐                                                       │
│  │          │                                                       │
│  │ CREATED  │ ── POST /api/order ──────────────────────┐            │
│  │          │                                           │            │
│  └──────────┘                                           ▼            │
│                                                  ┌─────────────┐    │
│                                                  │             │    │
│                                                  │  PENDING    │    │
│                                                  │             │    │
│                                                  └──┬──────┬───┘    │
│                                                     │      │        │
│                          PAYMENT STATES:            │      │        │
│                          (sub-states of PENDING)    │      │        │
│                                                     │      │        │
│  ┌─── send-link ──────────────────────┐             │      │        │
│  │                                    │             │      │        │
│  │  awaiting_payment ─┬─→ paid        │             │      │        │
│  │                    ├─→ (switches    │             │      │        │
│  │                    │    to call-me) │             │      │        │
│  │                    └─→ (stays       │             │      │        │
│  │                        pending)    │             │      │        │
│  └────────────────────────────────────┘             │      │        │
│                                                     │      │        │
│  ┌─── call-me ────────────────────────┐             │      │        │
│  │                                    │             │      │        │
│  │  awaiting_contact ─┬─→ paid        │             │      │        │
│  │                    └─→ waived      │             │      │        │
│  └────────────────────────────────────┘             │      │        │
│                                                     │      │        │
│                              admin approves ────────┘      │        │
│                              admin denies ─────────────────┘        │
│                                     │                      │        │
│                                     ▼                      ▼        │
│                            ┌──────────────┐      ┌──────────────┐   │
│                            │              │      │              │   │
│                            │  APPROVED    │      │   DENIED     │   │
│                            │              │      │              │   │
│                            └──────────────┘      └──────────────┘   │
│                                     │                               │
│                                     ▼                               │
│                            creates events row                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 27.7 Payment Status Tracking - New DB Columns

**Add to `event_requests` table (new migration):**

```sql
-- Migration: 011_payment_tracking.sql

-- ── 1. Payment status tracking ──
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (payment_status IN (
      'not_applicable',      -- admin-created or old requests (no payment flow)
      'awaiting_payment',    -- send-link: waiting for client to pay via link
      'awaiting_contact',    -- call-me: waiting for admin to contact client
      'paid',                -- payment confirmed (by webhook or admin)
      'waived',              -- free/promotional event (admin override)
      'refunded'             -- payment was refunded
    )),
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN (
      'paybox',              -- PayBox online payment
      'bit',                 -- Bit transfer
      'bank_transfer',       -- Direct bank transfer
      'cash',                -- Cash payment (in-person)
      'waived'               -- No payment (free/promo)
    )),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_price INTEGER NOT NULL DEFAULT 0,
    -- Price in agorot (cents). 25000 = ₪250, 30000 = ₪300.
    -- Stored as integer to avoid floating point issues.
  ADD COLUMN IF NOT EXISTS payment_link_token TEXT UNIQUE,
    -- Secure token embedded in payment email links (for future webhook matching).
    -- Generated as crypto.randomUUID() when payment email is sent.
  ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ;
    -- When the payment link stops being valid (for future use).

-- Index for payment link token lookup
CREATE INDEX IF NOT EXISTS idx_event_requests_payment_token
  ON event_requests(payment_link_token)
  WHERE payment_link_token IS NOT NULL;
```

### 27.8 Updated TypeScript Types

```typescript
// Add to database.types.ts:

export type PaymentStatus =
  | 'not_applicable'
  | 'awaiting_payment'
  | 'awaiting_contact'
  | 'paid'
  | 'waived'
  | 'refunded';

export type PaymentMethod =
  | 'paybox'
  | 'bit'
  | 'bank_transfer'
  | 'cash'
  | 'waived'
  | null;

export interface EventRequestPayment {
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_at: string | null;
  total_price: number;        // in agorot (cents)
  payment_link_token: string | null;
  payment_link_expires_at: string | null;
}

// Updated EventRequest interface - add these fields:
export interface EventRequest {
  // ... all existing fields ...
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_at: string | null;
  total_price: number;
  payment_link_token: string | null;
  payment_link_expires_at: string | null;
}
```

### 27.9 Price Calculation Rules

```typescript
// In config.ts (already exists):
export const BASE_PRICE = 250;   // ₪250 - base event package
export const MSG_ADDON  = 50;    // ₪50  - WhatsApp messaging add-on

// Price calculation (used in order route + email templates):
function calculateTotalPrice(wantsGuestMessages: boolean): number {
  const shekel = BASE_PRICE + (wantsGuestMessages ? MSG_ADDON : 0);
  return shekel * 100; // convert to agorot for storage
}

// Examples:
// Base only:          250 * 100 = 25000 agorot
// Base + messaging:   300 * 100 = 30000 agorot
```

**Where price is used:**
1. **Order route** (`/api/order`): calculates and stores `total_price` in `event_requests`
2. **Payment email** (`buildClientPaymentEmail`): renders price breakdown
3. **Admin request card**: shows price + payment status
4. **Event overview tab**: shows services purchased + total price
5. **Invoice email** (`buildMessagingAddonInvoiceEmail`): shows ₪50 for late add-on

### 27.10 Updated Order Route - Payment Fields

**Changes to `POST /api/order`:**

```typescript
// In the INSERT into event_requests, add:

const paymentLinkToken = crypto.randomUUID();
const totalPrice = calculateTotalPrice(wantsMessages);

const { data: reqRow, error: dbErr } = await supabase
  .from('event_requests')
  .insert({
    // ... all existing fields ...
    
    // ── NEW: Payment tracking ──
    payment_status: contactPref === 'send-link'
      ? 'awaiting_payment'     // client will pay via link
      : 'awaiting_contact',    // admin will call client
    payment_method: null,       // not yet known
    paid_at: null,
    total_price: totalPrice,
    payment_link_token: contactPref === 'send-link' ? paymentLinkToken : null,
    payment_link_expires_at: contactPref === 'send-link'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      : null,
  })
  .select('id')
  .single();
```

### 27.11 Payment Link Lifecycle

**Current state:** PayBox/Bit buttons in the payment email have `href="#"` - they are stubs.
The payment link token and expiration are **infrastructure for the future**.

#### Payment Link Token - What It's For

```
When payment services go live:

1. Payment email includes:  https://eventa.productions/api/payment/checkout?token={paymentLinkToken}

2. This route:
   a. Looks up event_requests by payment_link_token
   b. Checks payment_link_expires_at > now()
   c. If expired → show "הלינק פג תוקף - צרו קשר"
   d. If valid → redirect to PayBox/Bit checkout page with:
      - Amount: total_price (from event_requests)
      - Reference: payment_link_token (for webhook matching)
      - Return URL: /api/payment/callback

3. After payment:
   PayBox/Bit sends webhook → POST /api/payment/webhook
   a. Verify webhook signature
   b. Find event_requests by payment_link_token (from reference)
   c. Update: payment_status='paid', payment_method='paybox'/'bit', paid_at=now()
   d. Send admin notification: "לקוח שילם - ₪300 עבור [eventName]"
```

#### Payment Link Expiration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Link validity** | 7 days from email sent | Gives client a week to decide |
| **What happens when expired** | Client sees error page + "contact us" | Admin can re-send link |
| **Can admin extend?** | Yes - "שלחו לינק תשלום חדש" button | Generates new token + new 7-day expiry |
| **After expiration** | Request stays pending | Admin can still approve with 'waived' payment |

**Expiration check (future implementation):**
```typescript
// In /api/payment/checkout:
if (new Date(request.payment_link_expires_at) < new Date()) {
  return new Response(buildExpiredPaymentPage(), {
    status: 410,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
```

**Expired payment page (Hebrew RTL):**
```
┌───────────────────────────────────────────────────────────────┐
│                        ⏰                                     │
│              לינק התשלום פג תוקף                               │
│                                                               │
│  הלינק שקיבלתם במייל כבר לא תקף.                              │
│  אנא צרו איתנו קשר לקבלת לינק חדש.                           │
│                                                               │
│  📧 contact@eventa.productions                                │
│  📞 054-XXXXXXX                                               │
│                                                               │
│  [חזרו לאתר]                                                  │
└───────────────────────────────────────────────────────────────┘
```

### 27.12 Payment Stub Architecture

**The philosophy:** Build the full data model and UI now, but payment provider
integration is a `href="#"` stub that gets replaced later.

#### What's a Stub vs What's Real

| Component | Status | Notes |
|-----------|--------|-------|
| **PayBox checkout page** | 🔴 STUB | `href="#"` in email template |
| **Bit checkout page** | 🔴 STUB | `href="#"` in email template |
| **Payment webhook** | 🔴 STUB | Route exists but returns 501 |
| **SMS sending** | 🔴 STUB | InforUMobile integration - logs message, doesn't send |
| **WhatsApp sending** | 🔴 STUB | 360dialog integration - logs message, doesn't send |
| `payment_status` column | 🟢 REAL | Tracked in DB, shown in admin UI |
| `payment_method` column | 🟢 REAL | Set by admin manually (or future webhook) |
| `total_price` column | 🟢 REAL | Calculated and stored on order |
| `payment_link_token` | 🟢 REAL | Generated with `crypto.randomUUID()` |
| `payment_link_expires_at` | 🟢 REAL | Set to order time + 7 days |
| Admin "mark as paid" button | 🟢 REAL | Admin sets payment_status='paid' + method |
| Admin "waive payment" button | 🟢 REAL | Admin sets payment_status='waived' |
| Price display in emails | 🟢 REAL | Shows ₪250 / ₪300 breakdown |
| Price display in admin | 🟢 REAL | Shows in request card + event overview |

#### Stub Pattern for Messaging Services

The same stub pattern applies to SMS and WhatsApp:

```typescript
// src/lib/sms-provider.ts - STUB implementation:
export async function sendSms(phone: string, message: string): Promise<SendResult> {
  if (process.env.SMS_PROVIDER_LIVE !== 'true') {
    logger.info('[SMS STUB] Would send SMS', { phone: phone.slice(-4), messageLength: message.length });
    return { success: true, messageId: `stub-${Date.now()}`, stub: true };
  }
  // Real InforUMobile implementation (activated later)
  // ...
}

// src/lib/whatsapp-provider.ts - STUB implementation:
export async function sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<SendResult> {
  if (process.env.WA_PROVIDER_LIVE !== 'true') {
    logger.info('[WA STUB] Would send WhatsApp', { phone: phone.slice(-4), templateName });
    return { success: true, messageId: `stub-${Date.now()}`, stub: true };
  }
  // Real 360dialog implementation (activated later)
  // ...
}
```

**Environment variables for stub control:**

```env
# In .env - set to 'true' to activate real providers:
SMS_PROVIDER_LIVE=false      # InforUMobile SMS
WA_PROVIDER_LIVE=false       # 360dialog WhatsApp
PAYMENT_PROVIDER_LIVE=false  # PayBox/Bit payment
```

#### Future Payment Webhook Route (Stub)

```typescript
// src/app/api/payment/webhook/route.ts - STUB:

export async function POST(request: NextRequest) {
  if (process.env.PAYMENT_PROVIDER_LIVE !== 'true') {
    logger.info('[PAYMENT STUB] Webhook received but payment is in stub mode');
    return NextResponse.json({ received: true, stub: true });
  }

  // Future: verify signature, find request by token, update payment_status
  // See Section 27.11 for full flow
}
```

### 27.13 Admin Payment Controls - New UI Elements

#### In RequestsView - Payment Status Badge

```
┌─── בקשה חדשה ────────────────────────────────────────────────────┐
│ 🎉 ערב רווקים - תל אביב                                          │
│ 📅 15/03/2026, 20:00-23:00                                        │
│                                                                   │
│ 💰 חבילה: בסיסית + הודעות = ₪300                                  │
│ 💳 תשלום: ⏳ ממתין לתשלום              ← NEW payment status badge │
│ 📱 הודעות לאורחים: ✅ כן                                          │
│                                                                   │
│ 👤 ישראל ישראלי | 📞 050-1234567                                   │
│ 📧 israel@gmail.com                                                │
│ 📋 העדפה: שלחו לי לינק                                           │
│                                                                   │
│ 📝 בקשות מיוחדות: "רקע עם הלוגו שלנו"                             │
│                                                                   │
│ הערות אדמין: [___________________________________]                │
│                                                                   │
│ [💳 סמנו כשולם ▾]  [✅ אשרו]  [❌ דחו]      ← NEW payment button │
└───────────────────────────────────────────────────────────────────┘
```

#### "סמנו כשולם" Dropdown

When admin clicks "💳 סמנו כשולם", a dropdown appears:

```
┌──────────────────────────┐
│ בחרו אמצעי תשלום:        │
│                          │
│  💳 PayBox               │
│  📱 Bit                  │
│  🏦 העברה בנקאית          │
│  💵 מזומן                │
│  🎁 ללא תשלום (חינם)     │
│                          │
└──────────────────────────┘
```

Selecting a method:
1. Updates `payment_status` → `'paid'` (or `'waived'` for חינם)
2. Updates `payment_method` → selected method
3. Updates `paid_at` → `now()`
4. Badge changes from `⏳ ממתין` → `✅ שולם (PayBox)`

#### Payment Status Badge Values

| `payment_status` | Badge | Color |
|-------------------|-------|-------|
| `not_applicable` | - (hidden) | - |
| `awaiting_payment` | ⏳ ממתין לתשלום | 🟡 Yellow |
| `awaiting_contact` | 📞 ממתין ליצירת קשר | 🟡 Yellow |
| `paid` | ✅ שולם ({method}) | 🟢 Green |
| `waived` | 🎁 ללא תשלום | 🔵 Blue |
| `refunded` | ↩️ זוכה | 🔴 Red |

### 27.14 Updated Admin Approval Flow

**Changes to `POST /api/admin/requests` (approve action):**

The current approval flow creates an event from request data. Add these steps:

```typescript
// ── Current steps (unchanged): ──
// 1. Validate admin session
// 2. Find request by ID
// 3. Create event:
//    - name, slug, join_code, event_type, status='active',
//      description=special_requests, starts_at, ends_at, is_active=true
//    - Upload background image if exists
// 4. Update request: status='approved', approved_event_id=event.id

// ── NEW steps (added after event creation): ──

// 5. If wantsGuestMessages:
//    a. Set wa_messages_enabled=true on the new event
//    b. Set guest_list_uploaded=false, guest_list_count=0
//    c. Generate portal token:
//       INSERT INTO client_portal_tokens (event_id, token, is_active)
//       VALUES (newEvent.id, crypto.randomUUID(), true)
//    d. Send upload instructions email to contact_email (Email #1)

// 6. Log payment status at time of approval:
//    The admin can approve events regardless of payment_status.
//    The request card shows the payment status, and admin decides.
//    If payment_status is still 'awaiting_payment' or 'awaiting_contact'
//    at approval time, that's OK - admin takes responsibility.
```

### 27.15 Resending the Payment Link

If the payment link expires or the client lost the email, the admin can resend:

**Admin action: "📧 שלחו לינק תשלום חדש"** (appears in request card for pending requests)

```typescript
// 1. Generate new token
const newToken = crypto.randomUUID();

// 2. Update event_requests:
await supabase
  .from('event_requests')
  .update({
    payment_link_token: newToken,
    payment_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  .eq('id', requestId);

// 3. Send new payment email with new token
const paymentEmail = buildClientPaymentEmail({
  // ... same params as original ...
  requestId,
  baseUrl,
  // token is embedded in the email template's PayBox/Bit URLs
});

await transporter.sendMail({ ... });
```

### 27.16 Security Considerations for Payment

| Threat | Mitigation |
|--------|------------|
| **Guessing payment_link_token** | UUID v4 = 122 bits of entropy, unguessable |
| **Replay attack on webhook** | Verify webhook signature (PayBox/Bit provide HMAC) |
| **Admin spoofing payment** | Audit log: every payment_status change is logged with admin_id + timestamp |
| **Concurrent payment attempts** | DB transaction: update payment_status only if current status is 'awaiting_*' |
| **Storing credit card data** | **NEVER** - all payment is handled by PayBox/Bit externally. We only store status. |
| **Payment link sharing** | Token is single-use intent. Even if shared, payment goes to the correct order. |
| **Expired link abuse** | Check `payment_link_expires_at` before processing any payment action |
| **Rate limiting on checkout** | Checkout route: 5 requests/minute per IP (prevent enumeration) |
| **Price tampering** | Price is calculated server-side from `wantsGuestMessages` boolean. Client never sends price. |

### 27.17 The "call-me" Email (No Payment Link)

When `contactPreference = 'call-me'`, the client does **NOT** receive a payment email.
Instead, only the admin receives a notification email with a highlighted "📞 התקשרו ללקוח" section:

```
┌───────────────────────────────────────────────────────────────┐
│ 📋 הזמנה חדשה - "ערב רווקים ת"א"                              │
│                                                               │
│ [... event details ...]                                       │
│                                                               │
│ 📞 העדפת התקשרות: התקשרו אליי                                 │
│                                                               │
│ ⚠️ הלקוח ביקש שתתקשרו אליו לפני תשלום.                        │
│ 👤 ישראל ישראלי                                                │
│ 📞 050-1234567                                                 │
│ 📧 israel@gmail.com                                            │
│                                                               │
│ [... price summary ...]                                       │
└───────────────────────────────────────────────────────────────┘
```

The admin notification email template already differentiates based on `contactPreference`
(see current `buildAdminNotificationEmail` - it shows the preference field).
The enhancement is adding the ⚠️ callout box when `contactPreference = 'call-me'`.

### 27.18 Complete Decision Summary

| Question | Answer |
|----------|--------|
| **Is the order saved before or after payment?** | **BEFORE.** Always saved to `event_requests` immediately on form submission. |
| **Can a client pay without admin involvement?** | **Not yet.** PayBox/Bit are stubs. When live: yes, autonomous payment via link. |
| **What triggers event creation?** | **Admin approval only.** Not payment. Admin clicks "אשר". |
| **Can admin approve without payment?** | **Yes.** Payment is advisory. Admin has full discretion. |
| **Does the client get a payment email?** | **Only if** `contactPreference = 'send-link'` AND they provided an email. |
| **How long does the payment link last?** | **7 days.** Then it shows an expiry page. Admin can resend with a new 7-day link. |
| **What happens if they don't pay?** | Request stays pending. Admin sees it, calls them, or it sits there. |
| **Can a send-link client switch to call-me?** | **Yes.** Via the "צרו איתי קשר" button in the payment email. |
| **Can a call-me client switch to send-link?** | **No.** Admin sends payment email manually if needed. |
| **Are admin-created events different from purchased ones?** | **Same `events` table structure.** But purchased events have a linked `event_requests` row with contact/payment/pricing data. Admin-created events don't. |
| **What fields differ between the two paths?** | See Section 27.2 - admin creates with 5 fields, client purchase has 15+. |
| **Is PayBox/Bit integration needed now?** | **No.** Stubs (`href="#"`) are intentional. Activated by env var later. |
| **Is SMS/WhatsApp integration needed now?** | **No.** Same stub pattern. Activated by env var later. |

### 27.19 Implementation Files for Section 27

| File | Type | What changes |
|------|------|-------------|
| `supabase/migrations/011_payment_tracking.sql` | New | Add payment columns to `event_requests` |
| `src/lib/database.types.ts` | Modified | Add `PaymentStatus`, `PaymentMethod`, `EventRequestPayment` types |
| `src/lib/config.ts` | Modified | Add `PAYMENT_LINK_EXPIRY_DAYS = 7` |
| `src/app/api/order/route.ts` | Modified | Add payment fields to INSERT, generate payment_link_token |
| `src/app/api/admin/requests/route.ts` | Modified | Add payment controls, portal token on approval |
| `src/app/api/payment/webhook/route.ts` | New (stub) | Payment webhook - returns 501 in stub mode |
| `src/app/api/payment/checkout/route.ts` | New (stub) | Payment checkout redirect - returns 501 in stub mode |
| `src/lib/email-templates.ts` | Modified | Add call-me callout in admin email, update payment email links |
| `src/app/admin/_components/requests/RequestCard.tsx` | Modified | Add payment badge + "mark as paid" dropdown |
| `src/app/admin/_components/useAdminData.ts` | Modified | Add `markAsPaid()`, `waivePayment()`, `resendPaymentLink()` functions |
| `src/lib/sms-provider.ts` | New (stub) | SMS provider with stub/live toggle |
| `src/lib/whatsapp-provider.ts` | New (stub) | WA provider with stub/live toggle |

**Total new/modified files for Section 27:** 12 files (3 new, 9 modified)

---
---

# Part IV: Pretty URLs & Link Reuse

> **Section 28** tackles making event links as short, memorable, and easy to share as possible.
> The current URLs are long and ugly. We can do much better - especially since events are
> short-lived and archived after 7 days, which opens up slug recycling.

---

## 28. Pretty Event URLs & Slug Recycling

### 28.1 Current URL Structure - The Problem

The full URL a guest sees when scanning a QR or clicking a link:

```
https://eventa.productions/dating/singles-night-tel-aviv-b2c4?k=a1b2c3d4e5f6g7h8
└─────────────────────┘└──────┘└──────────────────────────┘ └──────────────────┘
         domain          path        slug (long)              join_code (16 hex)
```

**Problems:**
1. **Slug is long** - Hebrew is stripped, so "ערב רווקים תל אביב" becomes `singles-night-tel-aviv-b2c4` (28 chars)
2. **Join code is long** - 16 hex chars (`a1b2c3d4e5f6g7h8`) adds clutter
3. **`?k=` query param** - not clean, harder to type, can get stripped by some apps
4. **Total URL length** - can exceed 80+ characters. Bad for QR codes (bigger = harder to scan), bad for sharing via text/WhatsApp
5. **Slug is never freed** - archived events keep their slug forever, wasting nice short slugs

### 28.2 Design Goals

1. **As short as possible** - ideally under 40 characters total
2. **Human-readable** - someone should be able to type it from memory or dictation
3. **No query parameters** - everything in the path
4. **Slug recycling** - freed slugs should be reusable for future events
5. **Collision-safe** - no two active events can have the same slug
6. **QR-optimized** - shorter URLs = smaller QR = easier to scan
7. **No Hebrew in URL** - browsers handle it but it encodes to ugly `%D7%...` in copy/paste

### 28.3 New URL Structure

```
https://eventa.productions/e/tlv-singles
└─────────────────────┘└─┘└───────────┘
         domain         ▲    slug
                        │
                   short prefix (instead of /dating/)
```

**Key changes:**

| Current | New | Why |
|---------|-----|-----|
| `/dating/{slug}?k={joinCode}` | `/e/{slug}` | Shorter path, no query param |
| Slug: `singles-night-tel-aviv-b2c4` | Slug: `tlv-singles` | Shorter, city+type pattern |
| Join code in URL | Join code embedded in slug lookup | Auth moved to session/fingerprint |
| 16-char hex join code | 4-char suffix only if needed | Collision avoidance, not security |

**Result:** `eventa.productions/e/tlv-singles` - **35 chars total** (vs 80+)

### 28.4 The Join Code Problem - Why Remove It from the URL?

Currently, the join code serves two purposes:
1. **Event lookup** - finding the right event (slug already does this)
2. **Authorization** - proving the user was "invited" (scanned the QR)

But the join code is **not real security** - it's visible in the QR, visible in the URL,
and anyone who has the link has the code. It's security theater.

**What actually matters:**
- Can we find the event? → **slug** (unique)
- Is the event active? → **check `is_active` + `status`** in DB
- Is this device allowed? → **fingerprint + session** (existing system)

**Proposal:** Keep the `join_code` column in the database for admin features
(rotate code to invalidate old QRs, verify legitimacy), but **remove it from the
public-facing URL**. The join flow uses the slug for lookup and checks event status.

```
Current flow:  slug + join_code → find event → create session
New flow:      slug             → find event → check is_active → create session
```

**Security impact:** Minimal. The join code was never real auth - it's a public value
printed on QR codes at events. Removing it from the URL doesn't reduce security.
The real protection is:
- Event must be `is_active = true`
- Admin can disable the event instantly
- Fingerprint system tracks devices
- Ban system blocks bad actors

**If we still want a lightweight gate** (prevent random people from joining if they
guess the slug), we can keep a **short code**. See Section 28.6 for details.

### 28.5 Smart Slug Generation - Short & Memorable

Instead of slugifying the full Hebrew event name (which produces empty or generic results),
generate slugs from **structured components**:

#### Slug Components

```typescript
interface SlugComponents {
  city?: string;              // from event location or admin input
  eventType: string;          // wedding, party, singles, corporate
  suffix?: string;            // 2-3 char disambiguator (only if needed)
}
```

#### City Abbreviations (Hebrew → Short English)

```typescript
const CITY_CODES: Record<string, string> = {
  'תל אביב': 'tlv',
  'ירושלים': 'jlm',
  'חיפה': 'haifa',
  'באר שבע': 'bsheva',
  'רמת גן': 'rg',
  'הרצליה': 'herz',
  'נתניה': 'netanya',
  'ראשון לציון': 'rishon',
  'פתח תקווה': 'pt',
  'אשדוד': 'ashdod',
  'רחובות': 'rehovot',
  'כפר סבא': 'ks',
  'הוד השרון': 'hod',
  'רעננה': 'raanana',
  'מודיעין': 'modiin',
  'אילת': 'eilat',
  'טבריה': 'tiberias',
};

const TYPE_CODES: Record<string, string> = {
  'wedding': 'wedding',
  'party': 'party',
  'singles': 'singles',
  'corporate': 'corp',
  'bar-bat-mitzva': 'bnei-mitzva',
  'birthday': 'bday',
  'other': 'event',
};
```

#### Slug Generation Algorithm

```typescript
async function generatePrettySlug(
  eventName: string,
  eventType: string,
  startsAt: string,      // ISO date - used for date component
  supabase: SupabaseClient
): Promise<string> {
  
  // 1. Try to extract city from event name (Hebrew matching)
  const city = extractCity(eventName);  // returns city code or null
  const type = TYPE_CODES[eventType] || 'event';
  
  // 2. Build base slug
  //    Priority: city-type > type-monthday > type-suffix
  let base: string;
  if (city) {
    base = `${city}-${type}`;              // e.g. "tlv-singles"
  } else {
    // Use short name from event name (first meaningful English word)
    const nameSlug = eventName
      .replace(/[\u0590-\u05ff]+/g, '')     // strip Hebrew
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '')
      .toLowerCase();
    base = nameSlug ? `${nameSlug}` : type;  // e.g. "rooftop" or "singles"
  }
  
  // 3. Check if base slug is available (among active/non-archived events)
  const isAvailable = await checkSlugAvailable(base, supabase);
  if (isAvailable) return base;             // Best case: "tlv-singles" ✅
  
  // 4. Try with month-day: "tlv-singles-15m"  (15th of March)
  const date = new Date(startsAt);
  const monthDay = `${date.getDate()}${['j','f','m','a','y','n','l','g','s','o','v','d'][date.getMonth()]}`;
  const withDate = `${base}-${monthDay}`;
  if (await checkSlugAvailable(withDate, supabase)) return withDate;
  
  // 5. Fallback: append 2-char random suffix: "tlv-singles-a7"
  for (let i = 0; i < 5; i++) {
    const suffix = crypto.randomBytes(1).toString('hex'); // 2 hex chars
    const candidate = `${base}-${suffix}`;
    if (await checkSlugAvailable(candidate, supabase)) return candidate;
  }
  
  // 6. Ultimate fallback (should never reach): 4-char suffix
  return `${base}-${crypto.randomBytes(2).toString('hex')}`;
}
```

#### Example Slugs Generated

| Event Name (Hebrew) | Type | Generated Slug | URL |
|---------------------|------|---------------|-----|
| ערב רווקים תל אביב | singles | `tlv-singles` | `eventa.productions/e/tlv-singles` |
| ערב רווקים חיפה | singles | `haifa-singles` | `eventa.productions/e/haifa-singles` |
| מסיבת רווקים ירושלים | party | `jlm-party` | `eventa.productions/e/jlm-party` |
| ערב רווקים תל אביב (2nd) | singles | `tlv-singles-15m` | `eventa.productions/e/tlv-singles-15m` |
| חתונה של דנה ויוסי | wedding | `wedding` | `eventa.productions/e/wedding` |
| Rooftop Party | party | `rooftop-party` | `eventa.productions/e/rooftop-party` |
| (fallback) | singles | `singles-a7` | `eventa.productions/e/singles-a7` |

### 28.6 The Short Join Code - Lightweight Gate (Optional)

If we want to keep a basic gate so that knowing just the slug isn't enough to join,
we can embed a **short code** in the URL path itself (not as a query param):

```
https://eventa.productions/e/tlv-singles/a7b3
                                         └──┘
                                    4-char short code
```

**This is optional.** The recommended approach is **no code** for maximum simplicity:

| Option | URL | Length | Security | Recommendation |
|--------|-----|--------|----------|----------------|
| A: No code | `/e/tlv-singles` | ~35 chars | Slug is public | ✅ **Recommended** - simplest |
| B: Short code | `/e/tlv-singles/a7b3` | ~40 chars | 65K combinations | Good balance |
| C: Current | `/dating/slug-b2c4?k=a1b2...` | ~80+ chars | 16 hex chars | ❌ Too long |

**If Option B is chosen:**

```typescript
// Generate 4-char short code (2 bytes = 65,536 combinations)
function generateShortCode(): string {
  return crypto.randomBytes(2).toString('hex');  // e.g. "a7b3"
}

// URL structure:
// /e/[slug]/[shortCode]
// Both slug and shortCode must match to join

// Routing: src/app/e/[slug]/[code]/page.tsx
// OR: src/app/e/[slug]/page.tsx (reads code from path or ignores it)
```

**Trade-off:** 65K combinations means someone could brute-force it (~65K requests).
But with rate limiting (5 attempts/minute per IP), that's 218+ hours of guessing.
And the event only lasts a few hours. So it's effectively secure.

### 28.7 Slug Recycling - Freeing Slugs from Archived Events

This is the key insight: events live for a few hours and are archived 7 days later.
There's no reason to permanently occupy slugs like `tlv-singles` forever.

#### The Problem

Currently, `slug` is `UNIQUE NOT NULL` on the `events` table. Archived events
keep their row (status='archived') forever. So `tlv-singles` is **permanently taken**
after the first use - even though the event ended weeks ago.

#### The Solution: Partial Unique Index

Replace the full UNIQUE constraint with a **partial unique index** that only
enforces uniqueness among non-archived events:

```sql
-- Migration: 012_slug_recycling.sql

-- Step 1: Drop the existing full UNIQUE constraint on slug
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_slug_key;
DROP INDEX IF EXISTS events_slug_key;

-- Step 2: Create partial unique index - only active (non-archived) slugs must be unique
CREATE UNIQUE INDEX idx_events_slug_active
  ON events(slug)
  WHERE status != 'archived';

-- Step 3: Keep a regular (non-unique) index for lookups on archived events
CREATE INDEX IF NOT EXISTS idx_events_slug_all
  ON events(slug);

-- Step 4: Add original_slug column to preserve the slug at creation time.
-- When an event is archived, its slug is changed to include the event ID suffix
-- to free the nice slug for reuse. The original_slug preserves the pretty version.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS original_slug TEXT;
```

#### How Recycling Works

```
Timeline:

  Mar 15 - Event "tlv-singles" created   → slug = "tlv-singles"  ✅
  Mar 15 - Event starts, runs, ends
  Mar 22 - Cleanup cron archives event:
             1. original_slug = "tlv-singles"  (preserve for reference)
             2. slug = "tlv-singles--a1b2c3d4"  (append event ID prefix to free the slug)
             3. status = 'archived'
  Mar 25 - New event "tlv-singles" requested → slug = "tlv-singles"  ✅ Available!
```

**The archival step frees the slug** by appending a `--{id_prefix}` suffix.
The partial unique index only checks non-archived events, so the old
`tlv-singles--a1b2c3d4` doesn't conflict with the new `tlv-singles`.

#### Updated Cleanup Route

Add to the archival step in `src/app/api/cleanup/route.ts`:

```typescript
// ── Step 0 (new): Free the slug for reuse ──
const idPrefix = eventId.slice(0, 8); // first 8 chars of UUID
await supabase
  .from('events')
  .update({
    original_slug: event.slug,                  // preserve original
    slug: `${event.slug}--${idPrefix}`,         // free the pretty slug
  })
  .eq('id', eventId);

// ... existing steps 1-4 (snapshot, storage, cascade delete, mark archived) ...
```

### 28.8 Slug Availability Check - Active Events Only

```typescript
async function checkSlugAvailable(slug: string, supabase: SupabaseClient): Promise<boolean> {
  // Only check non-archived events (archived slugs are recycled)
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .neq('status', 'archived')     // ← key difference from current code
    .maybeSingle();
  
  return !data; // available if no active event uses this slug
}
```

This replaces the current uniqueness check in both:
- `POST /api/admin/events` (admin creation)
- `POST /api/admin/requests` (request approval)

### 28.9 Event Lookup - Active First, Then Archived

When a user visits `/e/tlv-singles`, the lookup must prioritize **active events**:

```typescript
// In join route / event page:
async function findEventBySlug(slug: string): Promise<Event | null> {
  const supabase = getServiceClient();
  
  // 1. Try to find an active (non-archived) event with this slug
  const { data: active } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .neq('status', 'archived')
    .single();
  
  if (active) return active;
  
  // 2. No active event - check if archived (for "event ended" page)
  //    Check both slug and original_slug for archived events
  const { data: archived } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('status', 'archived')
    .eq('original_slug', slug)     // match by the pretty slug it used to have
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (archived) {
    // Return minimal data for "event ended" page
    return { ...archived, _isArchived: true } as Event;
  }
  
  return null; // slug never existed
}
```

**Page behavior:**
| Lookup result | What the user sees |
|---------------|--------------------|
| Active event found | Normal join flow |
| Active event found, `is_active=false` | "האירוע מושהה" (event paused) |
| Archived event found | "האירוע הסתיים" (event ended) |
| No event found | 404 page |

### 28.10 Route Structure Changes

**Current routing:**
```
src/app/dating/[eventSlug]/page.tsx          → /dating/{slug}
src/app/dating/[eventSlug]/join/page.tsx     → /dating/{slug}/join
src/app/dating/[eventSlug]/setup/page.tsx    → /dating/{slug}/setup
src/app/dating/[eventSlug]/user/[id]/...     → /dating/{slug}/user/{id}
src/app/dating/[eventSlug]/banned/page.tsx   → /dating/{slug}/banned
src/app/dating/[eventSlug]/unavailable/...   → /dating/{slug}/unavailable
```

**New routing (add parallel `/e/` routes):**
```
src/app/e/[slug]/page.tsx                    → /e/{slug}
src/app/e/[slug]/join/page.tsx               → /e/{slug}/join
src/app/e/[slug]/setup/page.tsx              → /e/{slug}/setup
src/app/e/[slug]/user/[id]/page.tsx          → /e/{slug}/user/{id}
src/app/e/[slug]/banned/page.tsx             → /e/{slug}/banned
src/app/e/[slug]/unavailable/page.tsx        → /e/{slug}/unavailable
```

**Backward compatibility:** Keep the old `/dating/` routes as **redirects** to `/e/`:

```typescript
// src/app/dating/[eventSlug]/page.tsx - change to redirect:
import { redirect } from 'next/navigation';

export default function DatingLegacyRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { eventSlug } = use(params);
  const sp = use(searchParams);
  const joinCode = sp.k;
  
  // If old URL has ?k= join code, redirect to new URL (join code is ignored)
  redirect(`/e/${eventSlug}`);
}
```

### 28.11 Admin-Controlled Override: Custom Slug

Let admin set a **custom slug** when approving or creating an event:

```
┌─── אישור בקשה ────────────────────────────────────────────────┐
│ 🎉 ערב רווקים - תל אביב                                      │
│                                                               │
│ לינק האירוע:                                                  │
│ eventa.productions/e/ [tlv-singles        ]  ← editable       │
│                                                               │
│ 💡 מומלץ: קצר, באנגלית, ללא רווחים                             │
│                                                               │
│ [✅ אשרו]  [❌ דחו]                                           │
└───────────────────────────────────────────────────────────────┘
```

The slug field is **pre-filled** with the auto-generated pretty slug, but the admin
can change it to anything they want (validated: lowercase, alphanumeric + hyphens,
3-30 chars, not taken).

```typescript
// Slug validation:
const slugPattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
// - 3-30 chars
// - lowercase alphanumeric + hyphens
// - can't start or end with hyphen
// - no consecutive hyphens
```

### 28.12 QR Code Impact

Shorter URLs produce **smaller QR codes** that are easier to scan:

```
Current URL (83 chars):
https://eventa.productions/dating/singles-night-tel-aviv-b2c4?k=a1b2c3d4e5f6g7h8
→ QR Version 6 (41×41 modules) - medium, works but dense

New URL (43 chars):
https://eventa.productions/e/tlv-singles
→ QR Version 3 (29×29 modules) - small, clean, easy to scan

New URL with short code (48 chars):
https://eventa.productions/e/tlv-singles/a7b3
→ QR Version 4 (33×33 modules) - still small and clean
```

**QR version reduction = faster scanning**, especially in low-light event venues.

### 28.13 Pre-Event WhatsApp Link - Impact

The pre-event WhatsApp message (Section 25.2) includes a join link.
With pretty URLs, the message becomes much cleaner:

```
Current message link:
https://eventa.productions/dating/singles-night-tel-aviv-b2c4?k=a1b2c3d4e5f6g7h8

New message link:
https://eventa.productions/e/tlv-singles
```

This is **much more clickable** in WhatsApp - short links look trustworthy,
long links look suspicious.

### 28.14 Migration Strategy for Pretty URLs

```
Phase 1: Database changes
  - Run migration 012_slug_recycling.sql (partial unique index, original_slug column)
  - Backfill original_slug = slug for all existing events

Phase 2: Route changes
  - Create /e/[slug]/ route tree (copy from /dating/[eventSlug]/)
  - Convert /dating/[eventSlug]/ to redirect to /e/
  - Update join flow: slug-only lookup (no join code in URL)
  - Keep join_code in DB for admin rotate feature

Phase 3: Slug generation
  - Replace randomSuffix() slug generation with generatePrettySlug()
  - Add city extraction from Hebrew event names
  - Add admin custom slug field in CreateEventDialog and RequestsView

Phase 4: Cleanup route update
  - Add slug recycling step to archival (free pretty slug on archive)

Phase 5: QR + links update
  - Update QRDialog to use /e/{slug} URL (no ?k= param)
  - Update admin page URL copy to use /e/{slug}
  - Update all email templates to use /e/{slug}
  - Update WhatsApp message templates to use /e/{slug}
```

### 28.15 Implementation Files for Section 28

| File | Type | What changes |
|------|------|-------------|
| `supabase/migrations/012_slug_recycling.sql` | New | Partial unique index, `original_slug` column |
| `src/app/e/[slug]/page.tsx` | New | Main event page (pretty URL) |
| `src/app/e/[slug]/join/page.tsx` | New | Join page (no join code in URL) |
| `src/app/e/[slug]/setup/page.tsx` | New | Setup page |
| `src/app/e/[slug]/user/[id]/page.tsx` | New | User profile page |
| `src/app/e/[slug]/banned/page.tsx` | New | Banned page |
| `src/app/e/[slug]/unavailable/page.tsx` | New | Unavailable page |
| `src/app/dating/[eventSlug]/page.tsx` | Modified | Redirect to `/e/{slug}` |
| `src/app/dating/[eventSlug]/join/page.tsx` | Modified | Redirect to `/e/{slug}/join` |
| `src/lib/slug.ts` | New | `generatePrettySlug()`, `extractCity()`, `CITY_CODES`, `checkSlugAvailable()` |
| `src/app/api/admin/events/route.ts` | Modified | Use `generatePrettySlug()`, custom slug field |
| `src/app/api/admin/requests/route.ts` | Modified | Use `generatePrettySlug()`, custom slug on approval |
| `src/app/api/auth/join/route.ts` | Modified | Slug-only lookup (no join code required in URL) |
| `src/app/api/cleanup/route.ts` | Modified | Slug recycling on archival |
| `src/app/admin/_components/QRDialog.tsx` | Modified | Use `/e/{slug}` URL format |
| `src/app/admin/page.tsx` | Modified | URL copy uses `/e/{slug}` |
| `src/lib/validations.ts` | Modified | Add `prettySlugSchema` validation |

**Total new/modified files for Section 28:** 17 files (8 new, 9 modified)

### 28.16 Decision Summary

| Question | Answer |
|----------|--------|
| **New URL format?** | `/e/{slug}` - short prefix, no query params |
| **Remove join code from URL?** | **Yes.** Join code stays in DB (admin feature), removed from public URL |
| **Keep `/dating/` routes?** | **Yes** - as redirects to `/e/` for backward compatibility |
| **Can slugs be reused?** | **Yes** - archived events free their slug during cleanup cron |
| **How is uniqueness enforced?** | Partial unique index: only non-archived events must have unique slugs |
| **Slug generation?** | Smart: city code + event type, then date suffix, then random suffix |
| **Can admin customize slug?** | **Yes** - editable field pre-filled with auto-generated slug |
| **Max slug length?** | 30 characters |
| **Min slug length?** | 3 characters |
| **QR impact?** | Major improvement - smaller QR (Version 3-4 vs 6), faster scanning |
