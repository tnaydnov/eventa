# Eventa — Comprehensive Guidelines Audit

> **Date:** June 2025  
> **Codebase commit:** `96b3127` (main)  
> **Stack:** Next.js 16.1.6 · React 19.2.4 · TypeScript 5.9.3 · Supabase (PG17) · Vercel Frankfurt  
> **Auditor:** Copilot deep-read of 100% of source files (lib, API routes, components, hooks, stores, schema, config, pages)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented / needs minor work |
| ❌ | Not implemented |
| 🔜 | Deferred by user / ChatGPT priority notes |

---

## Table of Contents

1. [Production-Readiness & Deployment](#1-production-readiness--deployment)
2. [Security — Authentication & Sessions](#2-security--authentication--sessions)
3. [Security — API & Input](#3-security--api--input)
4. [Security — Data & Storage](#4-security--data--storage)
5. [Database & Schema](#5-database--schema)
6. [Realtime & WebSockets](#6-realtime--websockets)
7. [Performance & Caching](#7-performance--caching)
8. [Error Handling & Observability](#8-error-handling--observability)
9. [PWA & Service Worker](#9-pwa--service-worker)
10. [Client Architecture](#10-client-architecture)
11. [Admin System](#11-admin-system)
12. [Cybersecurity Hardening](#12-cybersecurity-hardening)
13. [Testing](#13-testing)
14. [i18n / Localisation](#14-i18n--localisation)

---

## 1. Production-Readiness & Deployment

### ✅ 1.1 Environment Variables — Fail-Closed on Missing Secrets

**Status: IMPLEMENTED**

- **Where:** [`src/app/api/admin/login/route.ts`](src/app/api/admin/login/route.ts#L95) — `ADMIN_PASSWORD` check; if missing → 500 "Server configuration error".
- **Where:** [`src/app/api/cleanup/route.ts`](src/app/api/cleanup/route.ts#L39) — `CRON_SECRET` check; if missing → 500.
- **Where:** [`src/app/api/admin/_helpers.ts`](src/app/api/admin/_helpers.ts#L24) — `hasCronAuth()` returns false if `CRON_SECRET` is not set.
- **Where:** [`src/lib/session.ts`](src/lib/session.ts) — `SESSION_SECRET` read from env; used in HMAC — if missing, signing/verification will fail (crypto throws).
- **Where:** [`src/lib/admin-auth.ts`](src/lib/admin-auth.ts) — `ADMIN_JWT_SECRET` read from env; same fail-closed behavior.
- **How:** Every route that needs a secret checks for its existence before using it. If the env var is missing, the route returns 500 with a generic error, never falling through.

### ✅ 1.2 Vercel Region Pinning

**Status: IMPLEMENTED**

- **Where:** [`vercel.json`](vercel.json) — `"regions": ["fra1"]` (Frankfurt).
- **Why:** Co-locates serverless functions with Supabase's EU region for minimal latency.
- **Also:** `maxDuration: 15` seconds for all functions.

### ✅ 1.3 Cron Jobs Configured

**Status: IMPLEMENTED**

- **Where:** [`vercel.json`](vercel.json) — two cron entries:
  - `auto-archive` runs at 03:00 UTC daily (`/api/admin/auto-archive`).
  - `cleanup` runs at 04:00 UTC daily (`/api/cleanup`).
- **How:** Both endpoints accept GET (Vercel Cron sends GET) and POST. Auth via `CRON_SECRET` bearer token with timing-safe SHA-256 comparison.

### ✅ 1.4 Build Optimization

**Status: IMPLEMENTED**

- **Where:** [`next.config.js`](next.config.js) — `reactStrictMode: true`, `optimizePackageImports` for `framer-motion`, `recharts`, `zod`, `@supabase/supabase-js`.
- **Why:** Tree-shakes heavy dependencies, reduces bundle size.

### ✅ 1.5 Node Version Constraint

**Status: IMPLEMENTED**

- **Where:** [`package.json`](package.json) — `"engines": { "node": ">=20" }`.

---

## 2. Security — Authentication & Sessions

### ✅ 2.1 Custom JWT Sessions (HMAC-SHA256)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/session.ts`](src/lib/session.ts)
- **How:**
  - `signSessionToken()` builds a JWT with `{ typ: 'session', sub, eid, esl, enm, iss, aud, iat, exp }`.
  - HMAC-SHA256 signature using `SESSION_SECRET`.
  - `verifySessionToken()` uses `crypto.timingSafeEqual` for signature comparison.
  - Discriminator check: rejects tokens where `typ !== 'session'` — prevents admin tokens from being used as session tokens and vice versa.
  - Validates `iss` (issuer) and `aud` (audience) claims against config values.
  - Expiry check: `exp < now` → rejected.
- **Cookie flags:** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` from `SESSION_MAX_AGE_S` (30 days).

### ✅ 2.2 Admin JWT (Separate Cookie)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/admin-auth.ts`](src/lib/admin-auth.ts)
- **How:**
  - `signAdminToken()` builds JWT with `{ typ: 'admin', iss, aud, iat, exp }`.
  - Uses separate `ADMIN_JWT_SECRET` env var.
  - `verifyAdminFromRequest()`: timing-safe comparison, discriminator `typ === 'admin'`, iss/aud validation.
  - **Cookie name:** `ws_admin` (different from `ws_session`).
  - **Cookie flags:** `HttpOnly`, `Secure`, `SameSite=Strict` (stronger than session), `Partitioned`, `Path=/api/admin`.

### ✅ 2.3 CSRF Protection

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/session.ts`](src/lib/session.ts) — `checkCsrf()`.
- **How:** Compares `Origin` header against `Host` header. Rejects if they don't match.
- **Applied at:**
  - All `secureGuard()` protected routes (CSRF is step 1 of the guard pipeline).
  - Auth join route (`/api/auth/join`).
  - Order form route (`/api/order`).
  - Admin cookie-auth routes (via `adminGuard()` — only for cookie-based auth, not cron).
- **Defense-in-depth:** Even the public order form checks CSRF despite not requiring a session.

### ✅ 2.4 Timing-Safe Password Comparison (Admin Login)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/login/route.ts`](src/app/api/admin/login/route.ts#L100-L105)
- **How:** Both input and secret are SHA-256 hashed to fixed 32-byte buffers before `crypto.timingSafeEqual`. This prevents length-leak attacks (comparing raw strings of different lengths would reveal the secret's length).

### ✅ 2.5 Brute-Force Lockout (Admin Login)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/login/route.ts`](src/app/api/admin/login/route.ts#L18-L60)
- **How:**
  - In-memory map tracks failed attempts per IP.
  - After 10 failures within 15 minutes → locked out.
  - Lazy cleanup: stale entries purged when map exceeds 10K entries or 10 minutes since last cleanup.
  - Successful login clears the failure counter.
  - Audit log entries: `LOGIN_LOCKED_OUT`, `LOGIN_FAILED`, `LOGIN_SUCCESS`.

### ✅ 2.6 Session Verification on Every Load

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/SessionProvider.tsx`](src/components/SessionProvider.tsx)
- **How:**
  - On mount: calls `GET /api/auth/verify` to validate the cookie server-side.
  - On app resume (`visibilitychange`): re-verifies via `useAppResume` hook.
  - Handles 403 (banned) → redirect to event page.
  - Handles 410 (event inactive — paused/archived/deleted) → redirect with reason.
  - Falls back to localStorage session data if cookie verify fails initially.

### ✅ 2.7 Ban Enforcement on Verify

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/auth/verify/route.ts`](src/app/api/auth/verify/route.ts#L30-L48)
- **How:** After session validation, checks `is_banned` on the participant row. If banned → clears cookie and returns 403.
- **Fail-closed:** If the DB query errors, returns 500 (not 200).

### ✅ 2.8 Event Status Enforcement on Verify

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/auth/verify/route.ts`](src/app/api/auth/verify/route.ts#L50-L93)
- **How:** Checks event `status` and `is_active`. Kicks users from paused/archived events and clears their cookie. Returns 410 with `reason` field.

### 🔜 2.9 Refresh Token Rotation

**Status: DEFERRED**

- **ChatGPT priority notes explicitly say:** "defer refresh token rotation."
- **Current state:** Single long-lived JWT (30 days). No refresh mechanism.
- **Risk level:** Low for event-scoped app (events are short-lived, typically hours to days). Token effectively expires with the event.

---

## 3. Security — API & Input

### ✅ 3.1 Centralized Route Guard (`secureGuard`)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/route-helpers.ts`](src/lib/route-helpers.ts) — `secureGuard()`.
- **Pipeline:** CSRF → session verification → rate limit → ban check (cached) → event status check.
- **Used by:** ALL `/api/secure/*` routes (profile, messages, photos, upload-url, blocks, heartbeat, likes, conversations, likes/seen, conversations/read).
- **Cached ban check:** Bounded Map (`MAX_CACHE_SIZE=5000`), TTL: 5 min for non-banned, 10s for banned. Eviction on size overflow.
- **Cached event status:** Same pattern, TTL: 5 min (active), 30s (inactive). Evictable via `evictEventStatusCache()`.

### ✅ 3.2 Rate Limiting

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)
- **How:** In-memory sliding window per IP. Four pre-configured tiers:
  - `standard`: 30 req/min (profile, verify, heartbeat, conversations, likes, messages).
  - `auth`: 5 req/min (admin login).
  - `upload`: 10 req/min (photos, upload-url).
  - `strict`: 3 req/min (blocks, account delete, admin writes, cron).
- **Applied to:** Every single API route has rate limiting. Including health, order, cleanup, admin routes.
- **Bounded store:** MAX_STORE_SIZE = 10K entries, 5-min cleanup interval.
- **⚠️ Limitation (documented in code):** In-memory rate limiting doesn't persist across Vercel serverless instances. Each cold start gets a fresh rate limit store. This is acceptable for the app's scale but noted.

### ✅ 3.3 Input Validation (Zod)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/validations.ts`](src/lib/validations.ts) — Comprehensive Zod schemas.
- **Schemas defined:**
  - `joinEventSchema` — event slug + join code.
  - `profileSetupSchema` — display_name, gender, attracted_to, bio, age, city, looking_for.
  - `adminLoginSchema` — password.
  - `createEventSchema` — name, slug, event_type, description, starts_at, ends_at.
  - `updateEventSchema` — partial of create + status/is_active/background.
  - `sendMessageSchema` — conversationId (UUID), text, type, mediaPath.
  - `photoReorderSchema` — array of {id, order_index}.
  - `likeSeenSchema` — fromParticipantId or all flag.
  - `envSchema` — validates all required env vars.
  - Image file validation: type allowlist (no SVG), 20MB limit, extension-to-MIME fallback for Android, magic byte validation.
- **Applied at:** Every route that accepts user input validates with the appropriate Zod schema before processing.

### ✅ 3.4 Input Sanitization

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/sanitize.ts`](src/lib/sanitize.ts)
- **How:**
  - **Server-side:** Double-pass tag stripping (`<[^>]*>` regex twice) + HTML entity decoding (`&amp;` → `&`, etc.).
  - **Client-side:** DOMPurify with `ALLOWED_TAGS=[]`, `ALLOWED_ATTR=[]` (strips everything).
  - `sanitizeWithLimit(text, maxLength)` combines sanitization with length truncation.
- **Applied to:** Profile fields (display_name, bio, city), message text — all go through `sanitizeWithLimit()` before DB insertion.

### ✅ 3.5 Path Traversal Protection

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/route-helpers.ts`](src/lib/route-helpers.ts) — `isSafePath()`.
- **How:** URL-decodes (to catch `%2e%2e` encoding), then rejects paths containing `..`, `//`, or leading `/`. Handles double-encoding.
- **Applied to:** Photo storage paths (POST photos, DELETE photos), upload URL generation, message media paths.

### ✅ 3.6 UUID Validation

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/session.ts`](src/lib/session.ts) — `isValidUUID()`.
- **How:** Regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
- **Applied to:** All routes that accept IDs (photoId, messageId, participantId, eventId, conversationId, blockedId, toId).

### ✅ 3.7 Ownership Verification

**Status: FULLY IMPLEMENTED**

Every data mutation verifies the authenticated user owns the resource:

- **Photos POST:** `storagePath` must start with `{eventId}/` and contain `session.sub`.
- **Photos DELETE:** Queries photo, checks `participant_id === session.sub`.
- **Photos PATCH (reorder):** Verifies all photo IDs belong to `session.sub`.
- **Messages POST:** Verifies sender is part of the conversation via DB query.
- **Messages PATCH (delete):** Verifies `sender_participant_id === session.sub`.
- **Upload URL:** Path must start with `{session.eid}/{session.sub}/` or `chat/{session.eid}/`.
- **Profile PATCH:** Updates with `.eq('id', session.sub).eq('event_id', session.eid)`.
- **Conversations read:** Parallel a/b update — only the correct side matches.

### ✅ 3.8 Block Enforcement on Actions

**Status: FULLY IMPLEMENTED**

- **Messages POST:** Bidirectional block check before sending.
- **Likes POST:** Bidirectional block check before liking.
- **Conversations POST:** Bidirectional block check before creating conversation.
- **Pattern:** All use `.or()` for both directions: `blocker=me&blocked=other OR blocker=other&blocked=me`.
- **Fail-closed:** If the block check query errors, returns 500 (never allows the action).

### ✅ 3.9 Self-Action Prevention

**Status: FULLY IMPLEMENTED**

- **Blocks:** `blockedId === blockerId` → 400.
- **Likes:** `toId === session.sub` → 400.
- **Conversations:** `otherId === session.sub` → 400.

### ✅ 3.10 Fingerprint Sanitization

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/auth/join/route.ts`](src/app/api/auth/join/route.ts#L47-L58)
- **How:** `FP_PATTERN = /^[a-f0-9-]+$/i` — only hex chars and hyphens allowed. Truncated to 64 chars (device) / 128 chars (hardware). Non-matching fingerprints are set to null.

### ✅ 3.11 Magic Byte Validation (File Uploads)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/validations.ts`](src/lib/validations.ts) — `validateImageMagicBytes()`.
- **How:** Checks first bytes against known signatures (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `52 49 46 46`, GIF: `47 49 46`, HEIC: `66 74 79 70`).
- **Applied at:**
  - Background image upload (`/api/admin/events/[eventId]/background`).
  - Client-side photo upload (`lib/api/photos.ts`).
  - Client-side image validation (`lib/validations.ts`).

### ✅ 3.12 Decompression Bomb Defense

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/image-compression.ts`](src/lib/image-compression.ts#L18-L30)
- **How:** Before compression, checks raw file size (20MB max) and image dimensions (8000px max) using `createImageBitmap`. Rejects oversized images before they consume memory.

### ✅ 3.13 Body Size Guard (Admin Routes)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/_helpers.ts`](src/app/api/admin/_helpers.ts#L45-L50)
- **How:** `adminGuard()` checks `Content-Length` header against `ADMIN_MAX_BODY_BYTES` (512 KB default). Rejects with 413 if exceeded.

---

## 4. Security — Data & Storage

### ✅ 4.1 Row-Level Security (RLS) on All Tables

**Status: FULLY IMPLEMENTED**

- **Where:** [`supabase/schema.sql`](supabase/schema.sql) + [`supabase/migrations/003_rls_event_scoping.sql`](supabase/migrations/003_rls_event_scoping.sql)
- **How:**
  - RLS enabled on ALL 11 tables.
  - `get_request_event_id()` function extracts `x-event-id` from request headers.
  - Anon role: **SELECT only** (event-scoped via `x-event-id` header check). No INSERT, UPDATE, or DELETE for anon.
  - Service role: Bypasses RLS (used by API routes via `getServiceClient()`).
- **Column exclusions in SELECT policies:** Participant photos SELECT policy explicitly excludes `device_fingerprint`, `hardware_fingerprint`, and `join_code` columns via column-list.

### ✅ 4.2 Fingerprint Column Security (Realtime)

**Status: FULLY IMPLEMENTED**

- **Where:** [`supabase/migrations/004_check_constraints_and_realtime.sql`](supabase/migrations/004_check_constraints_and_realtime.sql)
- **How:** Column-list publications: `publication eventa_realtime` includes specific columns per table, explicitly excluding `device_fingerprint`, `hardware_fingerprint`, and `join_code` from the `participants` publication.
- **Tables in publication:** events, participants, likes, conversations, messages, blocks, notifications.

### ✅ 4.3 REPLICA IDENTITY Configuration

**Status: FULLY IMPLEMENTED**

- **Where:** [`supabase/production-setup.sql`](supabase/production-setup.sql)
- **How:**
  - `REPLICA IDENTITY FULL` for: messages, likes, blocks, conversations, notifications (required by column-list publications for DELETE/UPDATE events).
  - `REPLICA IDENTITY DEFAULT` for: participants, events (sufficient since column-list publications already handle them).

### ✅ 4.4 Signed Upload URLs (No Client-Side Service Key)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/secure/upload-url/route.ts`](src/app/api/secure/upload-url/route.ts)
- **How:** Client requests a signed upload URL via authenticated API route. Server generates the URL with service key, client uploads directly to Supabase Storage using the signed URL. The anon key is never used for writes.
- **Path validation:** Files must be scoped to `{eventId}/{participantId}/` (profile photos) or `chat/{eventId}/` (chat media). Extension allowlist enforced.

### ✅ 4.5 Storage Cleanup on Deletion

**Status: FULLY IMPLEMENTED**

- **Account delete:** Photos + chat media files deleted from storage before DB records.
- **Block cascade:** Chat media deleted from storage when conversations are deleted.
- **Event archive:** All participant photos deleted from storage during purge.
- **Event delete:** Photos, chat media, and background images all cleaned from storage.
- **Cleanup cron:** Batch-deletes all storage files for events past retention.
- **Background upload:** Old format files cleaned when uploading a new format (e.g., old .jpg removed when uploading .png).

### ✅ 4.6 Fingerprint Stripping from API Responses

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/auth/join/route.ts`](src/app/api/auth/join/route.ts#L231-L235)
- **How:** When returning reconnected participant data, fingerprints are stripped: `({ device_fingerprint, hardware_fingerprint, ...safe }) => safe`.
- **Client helpers:** `PARTICIPANT_COLUMNS` constant in [`src/lib/api/helpers.ts`](src/lib/api/helpers.ts) explicitly lists only safe columns — never includes fingerprints.
- **Admin participants:** GET returns only `id, display_name, gender, age, is_banned, created_at` — no fingerprints.

### ✅ 4.7 PublicParticipant Type (No Fingerprints)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/database.types.ts`](src/lib/database.types.ts)
- **How:** `PublicParticipant` type uses `Omit<Participant, 'device_fingerprint' | 'hardware_fingerprint'>` — TypeScript-level enforcement that fingerprints never leak to clients.

---

## 5. Database & Schema

### ✅ 5.1 CHECK Constraints

**Status: FULLY IMPLEMENTED**

- **Where:** [`supabase/migrations/004_check_constraints_and_realtime.sql`](supabase/migrations/004_check_constraints_and_realtime.sql)
- **Constraints:**
  - `event_type` ∈ {wedding, bar_mitzvah, bat_mitzvah, birthday, corporate, party, other}
  - `event_status` ∈ {active, paused, ended, archived, draft}
  - `display_name` ≤ 30 chars
  - `bio` ≤ 200 chars
  - `city` ≤ 50 chars
  - `age` 16–120
  - `message text` ≤ 2000 chars
  - `event name` ≤ 100 chars
  - `event slug` ≤ 100 chars
  - `event description` ≤ 500 chars
  - `order_index` 0–20

### ✅ 5.2 Performance Indexes

**Status: FULLY IMPLEMENTED**

- **Where:** [`supabase/migrations/002_performance_indexes.sql`](supabase/migrations/002_performance_indexes.sql)
- **Indexes:** 12 indexes covering all major query patterns:
  - participants: `(event_id)`, `(event_id, device_fingerprint)`, `(event_id, hardware_fingerprint)`
  - likes: `(event_id, from_participant_id)`, `(event_id, to_participant_id)`
  - conversations: `(event_id, a_participant_id)`, `(event_id, b_participant_id)`
  - messages: `(conversation_id, created_at)`
  - blocks: `(event_id, blocker_id)`, `(event_id, blocked_id)`
  - participant_photos: `(participant_id, event_id)`
  - banned_devices: `(event_id, device_fingerprint)`

### ✅ 5.3 Activity Log

**Status: FULLY IMPLEMENTED**

- **Where:** Schema table `activity_log` with `(event_id, participant_id, action, created_at)`.
- **Logged actions:** join, like, message, block, heartbeat.
- **Method:** Fire-and-forget `Promise.resolve()` — doesn't block the response.
- **Consumer:** Analytics endpoints use activity_log for usage timelines.

### ✅ 5.4 Analytics Snapshots (Permanent)

**Status: FULLY IMPLEMENTED**

- **Where:** Schema table `event_analytics_snapshots` with `(event_id PK, snapshot JSONB, created_at)`.
- **How:** Before archiving an event, the full `EventAnalytics` object (60+ metrics) is computed and stored. The snapshot is NEVER deleted by cleanup — it's permanent history.
- **Fallback:** If full analytics computation fails, basic counts are stored with `_partial: true` flag.

### ✅ 5.5 Data Retention & Cleanup

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/cleanup/route.ts`](src/app/api/cleanup/route.ts), [`src/app/api/admin/auto-archive/route.ts`](src/app/api/admin/auto-archive/route.ts)
- **Flow:**
  1. `auto-archive` (3am daily): Auto-ends events past `ends_at`. Archives events past `ends_at + RETENTION_DAYS`.
  2. `cleanup` (4am daily): Safety net — archives anything `auto-archive` missed. Purges all user data for archived events.
- **Retention:** `RETENTION_DAYS = 7` (configurable in constants).
- **Dry-run mode:** Both endpoints support `?dry_run=true` for preview.

### ✅ 5.6 Cascade Delete Order

**Status: FULLY IMPLEMENTED**

All delete operations respect FK ordering: messages → conversations → likes → blocks → notifications → activity_log → photos → participants → event.

- Account delete: Correct FK order with parallel independent deletes.
- Event delete: Same pattern with storage cleanup first.
- Event archive: Sequential purge in FK-safe order.
- Block cascade: Messages → conversations (with media cleanup).

### ✅ 5.7 Duplicate Handling (Idempotent Operations)

**Status: FULLY IMPLEMENTED**

- **Likes:** Duplicate like (`23505` unique constraint) → returns existing like + checks for match.
- **Blocks:** Duplicate block (`23505`) → returns `{ success: true }` idempotently.
- **Conversations:** Race condition on create → re-fetches existing conversation.
- **Analytics snapshots:** Uses `upsert` with `onConflict: 'event_id'`.

---

## 6. Realtime & WebSockets

### ✅ 6.1 Centralized RealtimeHub (Singleton)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/realtimeHub.ts`](src/lib/realtimeHub.ts)
- **How:** Singleton channel manager outside React lifecycle. Reference counting per channel key. Channels created once and shared across all subscribers. `subscribe()` returns `unsubscribe()` function for cleanup.

### ✅ 6.2 Auto-Reconnection

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/realtimeHub.ts`](src/lib/realtimeHub.ts#L95-L130)
- **How:** Listens for `visibilitychange` (tab becomes visible) and `online` (network restored) events. Calls `reconnectStaleChannels()` which checks each channel's state and rebuilds dead/errored channels.

### ✅ 6.3 Polling Fallback (15s)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/RealtimeNotificationListener.tsx`](src/components/RealtimeNotificationListener.tsx)
- **How:** 15-second `setInterval` polls for unread conversations and likes alongside Realtime subscriptions. This ensures data freshness even if Realtime drops.

### ✅ 6.4 React Hook (`useRealtimeHub`)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/hooks/useRealtimeHub.ts`](src/hooks/useRealtimeHub.ts)
- **How:** Stable wrapper handlers via binding keys. Only re-subscribes on `channelKey` or `enabled` change. Properly unsubscribes on unmount.

### ✅ 6.5 Event-Scoped Channels

**Status: FULLY IMPLEMENTED**

- **How:** All Realtime channels include `eventId` in their filter. Channel keys are formatted as `{table}:{eventId}`. The anon client auto-injects `x-event-id` header for RLS scoping.

### ✅ 6.6 Deduplication of Realtime Events

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/RealtimeNotificationListener.tsx`](src/components/RealtimeNotificationListener.tsx)
- **How:** `seenIds` Set tracks processed event payloads to prevent duplicate processing. Pruned when size exceeds 500 entries (keeps most recent 250).

### ✅ 6.7 Name Cache for Notifications

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/RealtimeNotificationListener.tsx`](src/components/RealtimeNotificationListener.tsx)
- **How:** `nameCache` Map with 5-min TTL and max 200 entries. Used to display participant names in toast notifications without extra DB queries. Evicts oldest entries on overflow.

---

## 7. Performance & Caching

### ✅ 7.1 Parallel Database Queries

**Status: FULLY IMPLEMENTED (EXTENSIVELY)**

Nearly every route that needs multiple DB queries runs them in `Promise.all()`:

- **Auth join:** Ban checks (device + hardware) in parallel.
- **Heartbeat:** `last_seen_at` query + activity_log insert in parallel.
- **Blocks:** Context check (likes fwd/rev + conversation) in parallel. Cascade deletes (likes + notifications) in parallel.
- **Conversations:** Block check + existing conversation lookup in parallel.
- **Conversations read:** a-side + b-side update in parallel.
- **Likes DELETE:** Like delete + notification delete in parallel.
- **Admin stats:** 5 count queries in parallel.
- **Admin analytics:** 7 queries in parallel (participants, photos, likes, conversations, messages, blocks, activity).
- **Global analytics:** 8 queries in parallel.
- **Client-side:** `getGridParticipants()`: 3 queries in parallel. `getConversations()`: 4 queries in parallel. `buildParticipantPhotoMaps()`: batched `.in()` queries in parallel.

### ✅ 7.2 Fire-and-Forget for Non-Critical Writes

**Status: FULLY IMPLEMENTED**

All activity_log inserts and notification inserts use the pattern:
```typescript
Promise.resolve(supabase.from('activity_log').insert({...}))
  .catch(err => logger.error('[ROUTE] error:', err));
```
This prevents non-critical logging from blocking the API response.

### ✅ 7.3 Bounded In-Memory Caches

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/route-helpers.ts`](src/lib/route-helpers.ts)
- **Caches:**
  - Ban check cache: `MAX_CACHE_SIZE=5000`, TTL 5min (non-banned) / 10s (banned).
  - Event status cache: `MAX_CACHE_SIZE=5000`, TTL 5min (active) / 30s (inactive).
- **Eviction:** When cache exceeds `MAX_CACHE_SIZE`, entire cache is cleared (simple but effective).
- **Client-side:** Blocked IDs cache (30s TTL). Name cache (5min TTL, max 200). Conversation ID cache in RealtimeNotificationListener.

### ✅ 7.4 Heartbeat Throttle (2-min Stale Check)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/secure/heartbeat/route.ts`](src/app/api/secure/heartbeat/route.ts#L47-L56)
- **How:** Only updates `last_seen_at` if the current value is more than 2 minutes old. Prevents unnecessary DB writes on every 60s heartbeat.

### ✅ 7.5 Health Endpoint Caching

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/health/route.ts`](src/app/api/health/route.ts)
- **How:** Response cached for 5 seconds in module-level variable. Rate-limited to 20 req/min per IP. Prevents DB amplification from health check abuse.

### ✅ 7.6 Image Compression (Client-Side)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/image-compression.ts`](src/lib/image-compression.ts)
- **Profiles:** Max 2048px, max 2MB output.
- **Chat images:** Max 1600px, max 1.5MB output.
- **Method:** Uses `browser-image-compression` library. EXIF stripped via canvas redraw. No forced WebP (Safari compat).

### ✅ 7.7 Keyset Pagination (Messages)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/api/conversations.ts`](src/lib/api/conversations.ts) — `getMessagesBefore()`.
- **How:** Uses `created_at < cursor` ordering instead of OFFSET-based pagination. Efficient for large message histories.

### ✅ 7.8 Batched Photo Queries

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/api/helpers.ts`](src/lib/api/helpers.ts) — `buildParticipantPhotoMaps()`.
- **How:** Uses `.in()` queries with `BATCH_SIZE=50` chunks, run in parallel. Builds a Map of participant ID → photo URLs for efficient grid rendering.

### ⚠️ 7.9 Service Worker Caching Strategy

**Status: PARTIALLY IMPLEMENTED**

- **Where:** [`src/app/sw.ts`](src/app/sw.ts)
- **Implemented:**
  - Precaching of build assets (via Serwist).
  - NetworkOnly for all `/api/` routes (correct — no stale API responses).
  - CacheFirst for Supabase Storage images (photos/backgrounds).
  - StaleWhileRevalidate for Google Fonts.
  - Cache-Control: `no-cache, no-store` for `sw.js` itself ([vercel.json](vercel.json)).
- **Gap:** No explicit cache size limit or expiry for the image cache. Could grow unbounded on devices with many events.

---

## 8. Error Handling & Observability

### ✅ 8.1 Structured Logger

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/logger.ts`](src/lib/logger.ts)
- **How:**
  - JSON lines in production, colored text in development.
  - Levels: trace, debug, info, warn, error, fatal.
  - `child()` method for bound context (e.g., `logger.child({ route: 'join' })`).
  - `normalizeMeta()` handles Error objects, plain objects, and primitives.
  - Filter by `LOG_LEVEL` env var.

### ✅ 8.2 Consistent Error Responses

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/route-helpers.ts`](src/lib/route-helpers.ts) — `jsonError()`.
- **How:** All API routes return errors via `jsonError(message, status)` or `NextResponse.json({ error }, { status })`. Never leaks stack traces. Always includes a human-readable error message.
- **Pattern:** Generic errors to clients ("Server error"), detailed errors to logs.

### ✅ 8.3 Error Boundary (Client)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx)
- **How:** Class component wrapping the app. Catches render errors, shows Hebrew error UI with reload button. Prevents white screen of death.

### ✅ 8.4 Global Error Page

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/error.tsx`](src/app/error.tsx)
- **How:** Next.js App Router error boundary. Shows Hebrew error message with retry button. Uses `'use client'` directive.

### ✅ 8.5 404 Page

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/not-found.tsx`](src/app/not-found.tsx)
- **How:** Custom Hebrew 404 page with navigation back to home.

### ✅ 8.6 Network Status Indicator

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/NetworkStatus.tsx`](src/components/NetworkStatus.tsx)
- **How:** Listens for `online`/`offline` events. Shows banner when offline. Shows "back online" confirmation briefly when reconnected.

### ✅ 8.7 Request ID Generation

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/route-helpers.ts`](src/lib/route-helpers.ts) — `generateRequestId()`.
- **How:** UUID v4 via `crypto.randomUUID()`. Available for correlation but not yet attached to all log entries.

### ⚠️ 8.8 Admin Audit Logging

**Status: IMPLEMENTED but fire-and-forget**

- **Where:** [`src/lib/admin-auth.ts`](src/lib/admin-auth.ts) — `adminAuditLog()`.
- **How:** Logs admin actions with structured metadata. All destructive admin operations (create, update, delete, archive, ban/unban, rotate code, background upload) are logged.
- **Events logged:** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_LOCKED_OUT`, `EVENT_CREATE`, `EVENT_UPDATE`, `EVENT_DELETE`, `EVENT_ARCHIVE`, `PARTICIPANT_BAN`, `PARTICIPANT_UNBAN`, `JOIN_CODE_ROTATE`, `BACKGROUND_UPLOAD`, `BACKGROUND_REMOVE`, `AUTO_ARCHIVE`.
- **⚠️ Gap:** Audit logs go to `logger.info()` (stdout/Vercel logs) only. Not persisted to a dedicated audit table in the database. Vercel logs have limited retention.

### 🔜 8.9 External Monitoring / APM

**Status: DEFERRED**

- **ChatGPT priority notes:** "defer heavy analytics SDKs."
- **Current state:** Health endpoint exists. No Sentry, Datadog, or similar.
- **Recommendation for future:** Sentry (free tier covers most needs) when scale warrants it.

---

## 9. PWA & Service Worker

### ✅ 9.1 Serwist Service Worker

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/sw.ts`](src/app/sw.ts), [`next.config.js`](next.config.js)
- **How:** `@serwist/next` integration. Precaches build assets. Runtime caching strategies per route type.

### ✅ 9.2 Web App Manifest

**Status: FULLY IMPLEMENTED**

- **Where:** [`public/manifest.json`](public/manifest.json)
- **Contents:** App name, short name, icons, theme color, background color, display mode (standalone), start URL.

### ✅ 9.3 SW No-Cache Headers

**Status: FULLY IMPLEMENTED**

- **Where:** [`vercel.json`](vercel.json) — Custom header: `Cache-Control: no-cache, no-store, must-revalidate` for `/sw.js`.
- **Why:** Ensures browsers always fetch the latest service worker, preventing stale SW from serving outdated caches.

### ✅ 9.4 API Routes Excluded from SW Cache

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/sw.ts`](src/app/sw.ts) — `NetworkOnly` for all `/api/` routes.
- **Why:** API responses must never be served from cache (stale session data, stale bans, etc.).

### ❌ 9.5 Push Notifications

**Status: REMOVED (by design)**

- **Commit:** `96b3127` — Full removal of Web Push / VAPID system.
- **Why:** User decision. 14 files modified, 3 deleted, 695 lines removed.
- **Pending user action:** Run `DROP TABLE IF EXISTS push_subscriptions CASCADE;` in Supabase SQL editor. Remove VAPID env vars from Vercel.

---

## 10. Client Architecture

### ✅ 10.1 Zustand State Management

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/stores/`](src/lib/stores/) — 9 stores.
- **Stores:**
  - `session` — localStorage persistence, `clearSession()` cascade-resets ALL other stores.
  - `grid` — participants array + gender filter.
  - `chats` — conversations + messages.
  - `likes` — received/sent likes.
  - `matches` — pending match popup + matches array.
  - `notifications` — unread counts, grid highlights.
  - `blocks` — blocked IDs Set.
  - `swipe` — view mode toggle, dismissed/liked IDs.
  - `toast` — single message with auto-clear timer.

### ✅ 10.2 Session Cascade Reset

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/stores/session.ts`](src/lib/stores/session.ts) — `clearSession()`.
- **How:** Dynamically imports and resets ALL other stores when session is cleared. Prevents stale data from surviving logout/event-switch.

### ✅ 10.3 Mobile-Only Guard

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/MobileGuard.tsx`](src/components/MobileGuard.tsx)
- **How:** Checks `window.innerWidth <= 768` and mobile user agent. Blocks desktop access with a Hebrew message saying the app is for mobile devices.

### ✅ 10.4 App Resume Hook

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/hooks/useAppResume.ts`](src/hooks/useAppResume.ts)
- **How:** Fires callback on `visibilitychange` when document becomes visible. Uses ref-based callback to avoid re-subscriptions. Used by SessionProvider for session re-verification.

### ✅ 10.5 HeartbeatPinger

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/HeartbeatPinger.tsx`](src/components/HeartbeatPinger.tsx)
- **How:** POSTs to `/api/secure/heartbeat` every 60 seconds. Pauses when tab is hidden. Handles 403 (banned) → redirect, 410 (event inactive) → redirect.

### ✅ 10.6 Event Background System

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/EventBackground.tsx`](src/components/EventBackground.tsx)
- **How:** Fixed background image with dark overlay (`rgba(6,6,6,0.92)`). Sets `data-event-bg` attribute for CSS overrides. Lazy-loaded image.

### ✅ 10.7 Toast System

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/Toast.tsx`](src/components/Toast.tsx) + [`src/lib/stores/toast.ts`](src/lib/stores/toast.ts)
- **How:** Single active toast with auto-clear timer. AnimatePresence for smooth enter/exit. Used for match notifications, error messages, etc.

### ✅ 10.8 Skeleton Loading States

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/components/Skeletons.tsx`](src/components/Skeletons.tsx)
- **How:** Grid, Chats, and Likes skeleton components with CSS shimmer animation. Shown while data is loading.

---

## 11. Admin System

### ✅ 11.1 Full CRUD for Events

**Status: FULLY IMPLEMENTED**

- **Routes:** GET (list with filter/sort/search), POST (create), PATCH (update), DELETE (cascade delete).
- **Where:** [`src/app/api/admin/events/route.ts`](src/app/api/admin/events/route.ts), [`src/app/api/admin/events/[eventId]/route.ts`](src/app/api/admin/events/[eventId]/route.ts), [`src/app/api/admin/events/[eventId]/delete/route.ts`](src/app/api/admin/events/[eventId]/delete/route.ts)

### ✅ 11.2 Participant Management (Ban/Unban)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/[eventId]/participants/route.ts`](src/app/api/admin/events/[eventId]/participants/route.ts)
- **How:** GET lists all participants with `profile_complete` flag. PATCH toggles `is_banned` and syncs `banned_devices` table (both fingerprints). Ban cache evicted immediately.

### ✅ 11.3 Join Code Rotation

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/[eventId]/rotate/route.ts`](src/app/api/admin/events/[eventId]/rotate/route.ts)
- **How:** Generates new cryptographically random join code via `generateJoinCode()` (crypto.randomBytes). Old code immediately invalidated.

### ✅ 11.4 Background Image Upload

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/[eventId]/background/route.ts`](src/app/api/admin/events/[eventId]/background/route.ts)
- **How:** Multipart form data. MIME type allowlist (JPEG/PNG/WebP). Magic byte validation. 5MB size limit. Old format images cleaned. Cache-busting timestamp on public URL.

### ✅ 11.5 Deep Analytics (Per-Event)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/[eventId]/analytics/route.ts`](src/app/api/admin/events/[eventId]/analytics/route.ts) — 684 lines.
- **Metrics (60+):** Demographics, age distribution, attraction breakdown, likes/matches/conversations/messages/blocks, funnel (6-stage), timing metrics, usage timeline (5-min buckets), peak activity, response rate, ghost rate, photo impact, mutual attraction heatmap, block-after-match rate, most popular participants (anonymized).
- **Archived events:** Served from `event_analytics_snapshots` table.

### ✅ 11.6 Global Analytics (Cross-Event)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/global-analytics/route.ts`](src/app/api/admin/global-analytics/route.ts) — 541 lines.
- **Metrics:** All per-event metrics aggregated across all events (live + archived). Growth timelines (monthly). Top event rankings (5 categories). Event comparison table.

### ✅ 11.7 Event Archiving with Snapshot

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/[eventId]/archive/route.ts`](src/app/api/admin/events/[eventId]/archive/route.ts)
- **Flow:** Compute full analytics → save snapshot → purge user data → mark event archived. Snapshot is permanent.

### ✅ 11.8 Dual Auth (Cookie + Cron)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/_helpers.ts`](src/app/api/admin/_helpers.ts) — `adminGuard()`.
- **How:** Accepts either `ws_admin` cookie (browser dashboard) or `Authorization: Bearer CRON_SECRET` (Vercel Cron). CSRF check only for cookie auth (cron doesn't have Origin header).

### ✅ 11.9 Admin Search with Injection Prevention

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/admin/events/route.ts`](src/app/api/admin/events/route.ts#L54-L61)
- **How:** Search input stripped of all chars except alphanumeric, Hebrew, spaces, and hyphens. Prevents PostgREST filter injection. Sort field whitelisted.

---

## 12. Cybersecurity Hardening

### ✅ 12.1 Security Headers

**Status: FULLY IMPLEMENTED**

- **Where:** [`next.config.js`](next.config.js) — `headers()`.
- **Headers set:**
  - `X-Frame-Options: DENY` — prevents clickjacking.
  - `X-Content-Type-Options: nosniff` — prevents MIME sniffing.
  - `X-XSS-Protection: 1; mode=block` — legacy XSS protection.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — HSTS 2 years.
  - `Content-Security-Policy: frame-ancestors 'none'` — CSP frame protection.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` — disables unused browser APIs.
  - `Cross-Origin-Opener-Policy: same-origin` — isolation against Spectre-class attacks.

### ✅ 12.2 Fail-Closed Security Pattern

**Status: CONSISTENTLY APPLIED**

Every security check in the codebase follows fail-closed:

- **Ban checks:** If query errors → treated as banned (deny access).
- **Block checks:** If query errors → return 500 (deny action).
- **Session verify:** If DB errors → return 500 (deny access).
- **Event status:** If query errors → return 500 (deny access).
- **CSRF:** Missing Origin header → request rejected.
- **Rate limits:** Counts not persisting across instances is the only fail-open gap (documented, acceptable).

### ✅ 12.3 Timing-Safe Comparisons Everywhere

**Status: FULLY IMPLEMENTED**

- Session JWT verification: `crypto.timingSafeEqual`.
- Admin JWT verification: `crypto.timingSafeEqual`.
- Admin password: SHA-256 both sides → `crypto.timingSafeEqual`.
- Cron secret: SHA-256 both sides → `crypto.timingSafeEqual`.

### ✅ 12.4 Dual Fingerprinting

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/lib/device-fingerprint.ts`](src/lib/device-fingerprint.ts)
- **Fingerprint 1 (`device_fingerprint`):** localStorage UUID — persists across sessions but wiped in incognito.
- **Fingerprint 2 (`hardware_fingerprint`):** Canvas + WebGL + screen + navigator properties → SHA-256. Survives incognito mode.
- **Ban enforcement:** Both fingerprints checked in `banned_devices` table. Both stored when banning.
- **Reconnection:** Tries localStorage UUID first, then hardware fingerprint (catches incognito re-visits).

### ✅ 12.5 Device Ban Synchronization

**Status: FULLY IMPLEMENTED**

- **Admin ban:** Inserts BOTH fingerprints into `banned_devices`.
- **Admin unban:** Removes BOTH fingerprints from `banned_devices`.
- **Account self-delete:** Removes own fingerprints from `banned_devices` (clean slate for re-registration).

### ✅ 12.6 Block Cascade (Data Hygiene)

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/secure/blocks/route.ts`](src/app/api/secure/blocks/route.ts)
- **Cascade order:** Record block context → insert block → delete bidirectional likes → delete bidirectional notifications → delete conversation (fetch media paths first → delete messages → delete conversations → clean storage).
- **Context preservation:** `had_like`, `had_conversation`, `had_match` stored on the block row BEFORE cascade delete, so analytics can report block reasons accurately.

### ✅ 12.7 HTML Escaping in Email Templates

**Status: FULLY IMPLEMENTED**

- **Where:** [`src/app/api/order/route.ts`](src/app/api/order/route.ts#L27-L34)
- **How:** Custom `escapeHtml()` function escapes `&`, `<`, `>`, `"`, `'` before interpolating into HTML email template. Prevents HTML injection via order form.

### 🔜 12.8 Behavioral Signals / Bot Detection

**Status: DEFERRED**

- **ChatGPT priority notes:** "defer behavior signals/bot detection."
- **Current state:** No CAPTCHA, no behavioral analysis, no bot fingerprinting.
- **Mitigation:** Rate limiting + dual fingerprinting + CSRF checks provide baseline protection.

### 🔜 12.9 TLS Tuning

**Status: DEFERRED**

- **ChatGPT priority notes:** "defer TLS tuning."
- **Current state:** Vercel handles TLS termination. HSTS header is set (2 years, preload). No custom cipher suite configuration (Vercel doesn't expose this).

---

## 13. Testing

### ❌ 13.1 Unit Tests

**Status: NOT IMPLEMENTED**

- No test files found in the codebase.
- No test runner configured in `package.json` (no jest, vitest, or similar).
- **Priority:** Medium. The codebase is relatively small (~6000 lines of application code). Manual testing has been sufficient for the current scale.

### ❌ 13.2 Integration Tests

**Status: NOT IMPLEMENTED**

- No API route tests.
- No database integration tests.

### ❌ 13.3 E2E Tests

**Status: NOT IMPLEMENTED**

- No Playwright, Cypress, or similar.

---

## 14. i18n / Localisation

### ⚠️ 14.1 Current State

**Status: HEBREW ONLY (by design for now)**

- **User directive:** "LEAVE the languages support and i18n for last."
- **Current state:** All user-facing text is hardcoded in Hebrew throughout components, pages, and label constants.
- **Where labels live:** [`src/lib/constants.ts`](src/lib/constants.ts) — Hebrew labels for `looking_for`, `event_type`, `event_status`.
- **RTL:** Properly set via `dir="rtl"` on `<html>` tag in root layout.
- **Admin dashboard:** Hebrew.
- **Legal pages:** Hebrew.
- **Error messages to users:** Hebrew.
- **API error messages:** English (server-side, not shown to users directly).

### ❌ 14.2 i18n Framework

**Status: NOT IMPLEMENTED (deferred)**

- No `next-intl`, `react-i18next`, or similar installed.
- No message/translation files.
- Will be addressed last per user directive.

---

## Summary Scorecard

| Category | Items | ✅ Done | ⚠️ Partial | ❌ Missing | 🔜 Deferred |
|----------|-------|---------|------------|-----------|-------------|
| Production & Deploy | 5 | 5 | 0 | 0 | 0 |
| Auth & Sessions | 9 | 8 | 0 | 0 | 1 |
| API & Input Security | 13 | 13 | 0 | 0 | 0 |
| Data & Storage Security | 7 | 7 | 0 | 0 | 0 |
| Database & Schema | 7 | 7 | 0 | 0 | 0 |
| Realtime & WebSockets | 7 | 7 | 0 | 0 | 0 |
| Performance & Caching | 9 | 8 | 1 | 0 | 0 |
| Error Handling & Observability | 9 | 7 | 1 | 0 | 1 |
| PWA & Service Worker | 5 | 4 | 0 | 1 | 0 |
| Client Architecture | 8 | 8 | 0 | 0 | 0 |
| Admin System | 9 | 9 | 0 | 0 | 0 |
| Cybersecurity | 9 | 7 | 0 | 0 | 2 |
| Testing | 3 | 0 | 0 | 3 | 0 |
| i18n | 2 | 0 | 1 | 1 | 0 |
| **TOTAL** | **102** | **90** | **3** | **5** | **4** |

### Overall: **90/102 items fully implemented (88%)**

---

## Pending User Actions (from previous sessions)

1. **Run in Supabase SQL editor:**
   ```sql
   DROP TABLE IF EXISTS push_subscriptions CASCADE;
   ```

2. **Remove from Vercel environment variables:**
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

---

## Items Requiring Future Attention (Not Urgent)

### Minor Gaps (⚠️)

1. **SW image cache unbounded** — Add max entries / expiry to the CacheFirst strategy for Supabase Storage images in `sw.ts`. Low risk (mobile storage is typically sufficient).

2. **Audit logs not persisted to DB** — `adminAuditLog()` writes to stdout only. For regulatory needs or long-term audit trails, consider an `admin_audit_log` table. Currently Vercel log retention is limited.

3. **Hebrew-only UI** — All user-facing text is hardcoded Hebrew. Deferred per user directive.

### Deferred by Design (🔜)

4. **Refresh token rotation** — Single 30-day JWT. Acceptable for event-scoped app. Revisit if sessions need to survive longer than events.

5. **Bot detection / behavioral signals** — No CAPTCHA or behavioral analysis. Rate limiting + fingerprinting provides baseline. Revisit at scale.

6. **TLS tuning** — Handled by Vercel. HSTS preload already configured.

7. **External APM / monitoring** — No Sentry or equivalent. Health endpoint exists. Add when scale warrants.

### Missing (❌)

8. **Testing** — No unit, integration, or E2E tests. The codebase is well-structured for testing (pure functions in lib/, clear API boundaries). Vitest + Playwright would be the natural choices for Next.js.

9. **i18n framework** — Deferred to last. RTL already working.

10. **Push notifications** — Deliberately removed. Table cleanup pending.
