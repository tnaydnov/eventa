# Eventa - Complete Technical Architecture Document

> **Last updated**: February 20, 2026

---

## 1. What Is Eventa

Eventa is a **Hebrew-language, mobile-first, event-scoped dating Progressive Web App (PWA)**. Participants at real-world events (weddings, parties, corporate events, bar mitzvahs) scan a QR code, build a profile in under a minute, browse other participants in a photo grid or swipe view, send likes, get matched on mutual likes, and chat - all scoped to that single event and auto-deleted after 7 days.

---

## 2. Technology Stack - Exact Versions

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Language** | TypeScript | `^5.9.3` | Strict mode (`strict: true`), `ES2022` target. Type safety across the full stack - shared types between API routes and client. |
| **Runtime** | Node.js | `>=20.0.0` | Required for native `crypto.timingSafeEqual`, `SubtleCrypto`, and modern ESM (`"type": "module"`). |
| **Framework** | Next.js (App Router) | `^16.1.6` | Server/client component model lets landing pages SSR for SEO while the dating app is fully client-rendered for interactivity. Built-in API routes eliminate a separate backend. |
| **React** | React + ReactDOM | `^19.2.4` | React 19's `use()` hook for async params, improved concurrent rendering. Required for Next.js 16 compatibility. |
| **Database** | Supabase (PostgreSQL 17) | `@supabase/supabase-js ^2.95.3` | Postgres 17 (`major_version = 17` in config.toml). Managed hosting with built-in Realtime, Storage, and Row Level Security - eliminates the need for separate backend infrastructure. |
| **Realtime** | Supabase Realtime | (bundled with supabase-js) | WebSocket-based `postgres_changes` for instant delivery of likes, messages, blocks, and event updates. |
| **State Management** | Zustand | `^5.0.11` | Lightweight (~1KB), no boilerplate, no providers. Stores persist to `localStorage`. Cross-store reset on session clear prevents data leaks between events. |
| **Forms** | React Hook Form + Zod | `^7.71.1` / `^4.3.6` | Uncontrolled forms for performance on mobile. Zod schemas shared between client validation and server-side API routes - single source of truth. |
| **Styling** | Tailwind CSS 4 + hand-written CSS | `^4.1.18` | Tailwind via PostCSS plugin (`@tailwindcss/postcss`). 9 modular CSS files for different UI areas (grid, chat, profile, landing, etc.) - no CSS modules or CSS-in-JS, keeping bundle size minimal. |
| **Animations** | Framer Motion | `^12.34.0` | Swipe gestures, match popups, page transitions. Tree-shaken via `optimizePackageImports`. |
| **Image Compression** | browser-image-compression | `^2.0.2` | Client-side compression to WebP (max 1600px, max 800KB) using Web Workers - reduces upload size by ~80% before it hits the server. |
| **Image Cropping** | react-easy-crop | `^5.5.6` | Touch-friendly crop UI for profile photos on mobile. |
| **Image Optimization** | Sharp | `^0.33.5` | Used by Next.js `<Image>` component for server-side resizing/format conversion. |
| **Charts** | Recharts | `^3.7.0` | Admin analytics dashboards - event timelines, engagement funnels, demographics. |
| **QR Codes** | qrcode | `^1.5.4` | Generates event join QR codes in the admin panel. |
| **Email** | Nodemailer | `^8.0.1` | Sends HTML order-form emails via SMTP. |
| **Sanitization** | DOMPurify | `^3.3.1` | Client-side HTML sanitization. Server-side uses regex-based stripping (no DOM in Node.js). |
| **Service Worker** | Serwist (Next.js plugin) | `^9.5.5` | Service worker with precaching + runtime caching. Modern replacement for Workbox/next-pwa. |
| **Linting** | ESLint | `^10.0.0` | Next.js lint rules. |
| **Build Tool** | PostCSS | `^8.5.6` | Tailwind CSS 4 integration. |
| **Deployment** | Vercel | Frankfurt (`fra1`) | Lowest latency to Israel (primary Hebrew-speaking audience). Serverless functions with 15s max duration. |

---

## 3. Architecture Design

### 3.1 Application Architecture Pattern: Monolithic Full-Stack with Serverless API

Everything lives in one Next.js repository:

- **Static/SSR pages** (landing, legal pages) - server-rendered for SEO
- **Client-side SPA** (the dating app at `/dating/[eventSlug]/*`) - fully interactive, no server rendering
- **API routes** (`/api/*`) - serverless functions on Vercel, acting as the backend
- **Database** - managed Supabase (external PostgreSQL 17)

**Why this architecture**: A solo-developer project doesn't benefit from microservices overhead. Next.js App Router gives you SSR, API routes, and client SPA in one deployment. Supabase eliminates the need to manage Postgres, file storage, or WebSocket infrastructure separately.

### 3.2 Routing Structure

```
/                                    → SSR landing page (homepage)
/dating                              → SSR product landing page
/dating/[eventSlug]/join             → Client: join flow (enter code)
/dating/[eventSlug]/setup            → Client: profile setup
/dating/[eventSlug]/                 → Client: participant grid (main view)
/dating/[eventSlug]/user/[id]        → Client: view profile
/dating/[eventSlug]/likes            → Client: received likes
/dating/[eventSlug]/chats            → Client: conversations list
/dating/[eventSlug]/chat/[id]        → Client: chat thread
/dating/[eventSlug]/profile          → Client: own profile
/dating/[eventSlug]/banned           → Client: ban screen
/dating/[eventSlug]/unavailable      → Client: event ended screen
/admin                               → Client: admin dashboard (SPA)
/about                               → SSR: about page
/faq                                 → SSR: FAQ page
/privacy                             → SSR: privacy policy
/terms                               → SSR: terms of service
/safety                              → SSR: safety tips
/cookies                             → SSR: cookie policy
/community                           → SSR: community guidelines
```

### 3.3 The Event-Scoped Layout Shell

`src/app/dating/[eventSlug]/layout.tsx` wraps every dating page with:

| Component | Purpose |
|---|---|
| `SessionProvider` | Restores/verifies JWT session, loads user data, listens for event status changes via Realtime |
| `EventBackground` | Dynamic event background image |
| `NetworkStatus` | Offline/online floating banner |
| `HeartbeatPinger` | 60s heartbeat to server; enforces bans and event status in real-time |
| `RealtimeNotificationListener` | Global likes/messages/blocks Realtime processor with polling fallback |
| `MatchPopup` | Dynamically imported (`ssr: false`) match celebration overlay |

**Rationale**: All cross-cutting concerns are in the layout so individual pages don't need to worry about session state, realtime, or connectivity. The layout is a client component (`'use client'`) because the dating app requires full interactivity.

---

## 4. Constraints & Design Rationale

### 4.1 Mobile-Only, Browser-Only

- **`MobileGuard` component** blocks desktop users (viewport > 768px + no mobile user agent). The app is designed for event attendees on their phones.
- **No native app** - PWA via `manifest.json` with `"display": "standalone"` and `"orientation": "portrait"`. Users add to home screen from Chrome/Safari.
- **Rationale**: Event attendees won't download an app for a one-night event. QR scan → browser → instant access. PWA gives app-like UX (fullscreen, home screen icon) without app store friction. Zero install time is critical when people are at a live event.

### 4.2 Realtime Requirements

The app needs **instant** feedback for:

| Event | Behavior |
|---|---|
| **Like received** | Toast notification appears immediately + grid card highlight badge |
| **Mutual match** | Full-screen match celebration popup with animation |
| **New message** | Real-time message in chat thread + toast if viewing different screen |
| **Block** | Participant removed from grid and conversations instantly |
| **Event status change** | If admin pauses/ends event, all connected users see it immediately and are redirected |
| **Like removed** | Grid highlight removed + "like removed" toast |

**Primary mechanism**: Supabase Realtime WebSocket (`postgres_changes`). 7 tables are published to `supabase_realtime` with `REPLICA IDENTITY FULL` (required to deliver both old and new row data in change payloads).

**Fallback mechanism**: A 15-second polling interval acts as a safety net in case WebSocket messages are dropped. Mobile browsers aggressively kill background WebSocket connections - this ensures no notification is permanently lost. Polling is paused when the tab is hidden via `document.visibilityState` to save battery and bandwidth.

**Reconnection strategy**: The `RealtimeHub` singleton detects when the app returns from background (`visibilitychange` event + `online` event) and reconstructs stale WebSocket channels. A 500ms delay allows the network stack to wake up first before attempting reconnection.

**Deduplication**: A `seenIds` set with 5-minute auto-pruning prevents duplicate notifications when both Realtime and polling deliver the same event.

### 4.3 Performance on Mobile Browsers

| Concern | Solution | Why |
|---|---|---|
| **Bundle size** | `optimizePackageImports` for zustand, zod, framer-motion; tree-shaking; dynamic imports for heavy components (MatchPopup, charts) | Mobile networks are slow; every KB matters |
| **Image loading** | Client-side WebP compression (1600px max, 800KB max) via Web Workers before upload; Next.js `<Image>` with Supabase remote patterns for optimized serving | Users upload 5–10MB photos from phone cameras; compressing before upload saves bandwidth and storage |
| **Rendering** | No SSR for dating pages (all `'use client'`); uncontrolled forms via react-hook-form; Zustand stores (no Context re-renders) | SSR adds TTFB latency and is pointless for authenticated app pages. Uncontrolled forms avoid re-renders on every keystroke. Zustand avoids the cascading re-render problem of React Context. |
| **Heartbeat debounce** | `last_seen_at` only updated when stale > 2 minutes despite 60s heartbeat interval | Reduces DB writes by ~30× |
| **Caching** | Ban check cached 5min (10s if banned), event status cached 5min (30s if paused), blocked-IDs cached 30s, participant names cached 5min | Avoids redundant DB queries on every API call |
| **Batched queries** | Participant + photo loading uses batches of 50 UUIDs (PostgREST URL length limit) with `Promise.all` | Prevents 414 URI Too Long errors while maximizing parallelism |
| **Fire-and-forget** | Activity logging and notification inserts never block API responses | User waits for the like/message to save, not for analytics |
| **CSS approach** | 9 modular hand-written CSS files, no runtime CSS-in-JS | Zero JS overhead for styling; styles are statically extracted |
| **Font loading** | `display: 'swap'` on both fonts | Prevents Flash of Invisible Text (FOIT) on slow connections |

### 4.4 Hebrew RTL Support

- `<html lang="he" dir="rtl">` in root layout
- All UI text is in Hebrew
- PWA manifest: `"lang": "he"`, `"dir": "rtl"`
- **Fonts**: **Rubik** (supports Hebrew + Latin subsets) as primary, **Great Vibes** as decorative script font
- Font loading: `display: 'swap'` to prevent FOIT

### 4.5 Data Privacy & Lifecycle

```
Event created → active → ended (auto, when ends_at passes) → archived (auto, after 7 days)
```

- **7-day retention (`RETENTION_DAYS = 7`)**: All user data is auto-deleted 7 days after the event ends. Two Vercel Cron jobs handle this:
  - `auto-archive` (daily at 3:00 AM UTC) - transitions events past `ends_at` to "ended", then archives after retention period
  - `cleanup` (daily at 4:00 AM UTC) - saves analytics snapshots, deletes all storage files in batches of 100, cascade-deletes all DB data, marks event as archived
- **Account self-deletion**: Users can delete their entire account at any time - full cascade (photos from storage, all DB records, session cookie cleared)
- **Analytics survive archiving**: `event_analytics_snapshots` table preserves aggregate statistics permanently for business reporting, even after all user-level data is purged
- **Event row is never deleted** by automatic processes - only by explicit admin action

---

## 5. Security Architecture

### 5.1 Authentication - Dual JWT System

| Token | Cookie Name | SameSite | HttpOnly | Secure | Max Age | Purpose |
|---|---|---|---|---|---|---|
| **Participant session** | `ws_session` | `Lax` | Yes | Yes (prod) | 30 days | Contains `participantId`, `eventId`, `eventSlug`, `eventName`. Lax allows top-level navigations (QR code → join page). |
| **Admin session** | `ws_admin` | `Strict` | Yes | Yes (prod) | 24 hours | Contains admin flag + issued-at. Strict prevents any cross-site request including top-level navigations. |

Both are **hand-rolled HMAC-SHA256 JWTs** using Node.js `crypto` module - no dependency on external JWT libraries. Signature verification uses `crypto.timingSafeEqual` to prevent timing attacks.

**Why hand-rolled JWT**: Eliminates a dependency. The token format is simple (3 fields + expiry). A `typ` discriminator field prevents admin tokens from being used as participant sessions and vice versa.

### 5.2 API Security Pipeline - `secureGuard()`

Every authenticated API call passes through this pipeline:

```
1. CSRF check (Origin header must match Host header)
   ↓
2. JWT session verification (cookie extraction → signature check → expiry check → typ discriminator)
   ↓
3. Rate limiting (per-IP, sliding window, configurable tiers)
   ↓
4. Ban check (cached lookup - dual fingerprint)
   ↓
5. Event status check (cached - rejects if event is paused, archived, or ended)
```

If any step fails, the request is rejected with the appropriate HTTP status code and the pipeline short-circuits.

### 5.3 Rate Limiting

In-memory sliding window rate limiter with configurable tiers:

| Tier | Max Requests | Window | Used For |
|---|---|---|---|
| `standard` | 30/min | 60s | Normal API calls |
| `auth` | 5/min | 60s | Login/join attempts |
| `upload` | 10/min | 60s | File uploads |
| `strict` | 3/min | 60s | Abuse-prone endpoints |

**Store protection**: Capped at 10,000 entries with LRU-style eviction (oldest 10% deleted when cap is exceeded). Stale entries cleaned every 5 minutes.

**Production caveat**: The in-memory store does NOT persist across Vercel serverless cold starts. For true production rate limiting, would need to be replaced with Upstash Redis or Vercel KV. Currently sufficient because cold starts naturally reset per-instance counters and the 15s function timeout limits abuse windows.

### 5.4 Ban Enforcement - Dual Fingerprint System

| Fingerprint Type | Storage | Survives Incognito | Survives Clear Data | Purpose |
|---|---|---|---|---|
| `device_fingerprint` | `localStorage` UUID | No | No | Primary identifier for normal usage, allows session resumption |
| `hardware_fingerprint` | Canvas + WebGL + screen + navigator hash (SHA-256) | **Yes** | **Yes** | Catches banned users who switch to incognito or clear browser data |

**Join-time check**: Both fingerprints are checked against the `banned_devices` table on every join attempt.

**Runtime enforcement**: `HeartbeatPinger` sends a heartbeat every 60s. The server checks ban status (cached 5min, 10s if already flagged as banned). If banned → client forcefully redirected to `/banned`, session cleared.

**Admin ban action**: When an admin bans a user, the ban cache is immediately evicted via `evictBanCache()` so the next heartbeat catches it within seconds.

### 5.5 Content Security

| Measure | Implementation |
|---|---|
| **Content Security Policy** | Restrictive CSP on all routes; no `unsafe-eval` in production; whitelisted Supabase, Google Fonts domains |
| **Input sanitization** | Server: HTML entity decoding → regex tag stripping. Client: DOMPurify with zero allowed tags/attributes |
| **Path traversal protection** | `isSafePath()` decodes URL encoding, rejects `..`, `//`, `\\`, null bytes, absolute paths, Windows drive letters |
| **Signed upload URLs** | Clients never use the Supabase anon key for writes. API generates scoped, time-limited signed URLs via service role |
| **No SELECT \*** | All queries use explicit column lists (`PARTICIPANT_COLUMNS`, `PHOTO_COLUMNS`, etc.) to prevent schema leakage |
| **UUID validation** | `isValidUUID()` regex check before interpolating any user-supplied ID into query filters |

### 5.6 Additional Security Headers

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self)
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### 5.7 Admin-Specific Security

- **Brute-force lockout**: 10 failed login attempts in 15 minutes → locked out for 15 minutes
- **Timing-safe password comparison**: Password is SHA-256 hashed before `timingSafeEqual` comparison
- **Audit logging**: All admin actions logged with structured JSON (IP, action, timestamp)
- **CRON_SECRET**: Vercel Cron jobs authenticate via `Authorization: Bearer <CRON_SECRET>` with timing-safe comparison

---

## 6. Database Architecture

### 6.1 Schema - 13 Tables

| # | Table | RLS Policy | Realtime Published | Purpose |
|---|---|---|---|---|
| 1 | `events` | SELECT for anon | Yes | Event configuration, status lifecycle, background image |
| 2 | `participants` | SELECT for anon | Yes | User profiles: name, gender, attracted_to, bio, age, city, looking_for, ban status |
| 3 | `participant_photos` | SELECT for anon | No | Photo storage paths with `order_index` for ordering |
| 4 | `conversations` | SELECT for anon | Yes | Chat threads between two participants with read timestamps |
| 5 | `messages` | SELECT for anon | Yes | Text + image messages with soft-delete support |
| 6 | `likes` | SELECT for anon | Yes | Unidirectional likes with `seen_at` tracking |
| 7 | `blocks` | SELECT for anon | Yes | Blocks with interaction context (`had_like`, `had_match`, `had_conversation`) |
| 8 | `notifications` | SELECT for anon | Yes | In-app notification records (like_received, new_message) |
| 9 | `banned_devices` | No anon access | No | Device fingerprints for ban enforcement |
| 10 | `activity_log` | No anon access | No | Usage timeline for analytics (joins, likes, messages, etc.) |
| 11 | `event_analytics_snapshots` | No anon access | No | Preserved aggregate analytics after archiving |
| 12 | `banned_devices` (hardware) | No anon access | No | Hardware fingerprint bans (separate from device fingerprint) |

### 6.2 Enums (PostgreSQL)

- `gender`: male, female, other
- `attracted_to`: men, women, all
- `message_type`: text, image, system
- `notification_type`: like_received, new_message

Additional TypeScript-only enums (validated via Zod, stored as TEXT with CHECK constraints):
- `looking_for`: serious, casual, friends, figuring_out
- `event_type`: wedding, party, brit, bar_mitzvah, corporate, meetup, other
- `event_status`: draft, active, paused, ended, archived

### 6.3 RLS Strategy - Event-Scoped Isolation

The anon Supabase client injects a custom `x-event-id` HTTP header on every REST request via a custom `fetch` wrapper in the Supabase client configuration (`setEventContext()`). On the PostgreSQL side:

1. A function `get_request_event_id()` extracts this header from the PostgREST request context (`current_setting('request.header.x-event-id', true)`)
2. RLS policies enforce `event_id = get_request_event_id()` on SELECT
3. A `is_postgrest_context()` function distinguishes PostgREST requests from Realtime WebSocket connections (which don't have the header)
4. Realtime connections allow SELECT (event scoping is enforced by filter clauses in the subscription)

**Result**: A participant in Event A physically cannot read data from Event B at the database level, even if they craft malicious client-side queries.

**Write strategy**: Anon role has no INSERT/UPDATE/DELETE policies on any table. All writes go through API routes using the `service_role` key (which bypasses RLS). This moves all write authorization logic into TypeScript where it can be tested and reasoned about, rather than complex SQL policies.

### 6.4 Indexes - 25+ Covering Indexes

Designed around actual query patterns:

- **FK lookups**: `idx_participants_event`, `idx_photos_participant`, `idx_likes_to`, `idx_likes_from`, etc.
- **Composite indexes**: `idx_conversations_event`, `idx_messages_conversation` (conversation_id, created_at)
- **Partial indexes**: `WHERE is_banned = false`, `WHERE is_read = false` for common filtered queries
- **Fingerprint lookups**: `idx_participants_fingerprint`, `idx_participants_hw_fingerprint` (partial: WHERE NOT NULL)
- **Activity timeline**: `idx_activity_log_event_time` (event_id, created_at)

### 6.5 Realtime Configuration

7 tables added to the `supabase_realtime` publication:
- `messages`, `likes`, `blocks`, `conversations`, `notifications`, `participants`, `events`

All 7 have `REPLICA IDENTITY FULL` set - required for Supabase Realtime to deliver complete old + new row data in change payloads (without this, only the primary key is delivered for UPDATE/DELETE events).

### 6.6 Storage Buckets

| Bucket | Visibility | Purpose |
|---|---|---|
| `photos` | Public (read) | Participant profile photos and chat images |
| `backgrounds` | Public (read) | Event background images |

Writes are never done directly by the client. The API generates **signed upload URLs** scoped to specific paths, and the client uploads directly to Supabase Storage using those URLs.

---

## 7. API Endpoints - Complete Map

### 7.1 Public / Authentication

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /api/health` | GET | Health check - pings Supabase, returns `{status, latency, timestamp}` |
| `POST /api/order` | POST | Order form - sends HTML booking email via SMTP (Nodemailer) |
| `POST /api/auth/join` | POST | **Main entry**: validates slug + join code, checks dual fingerprint bans, creates or reconnects participant, issues JWT session cookie |
| `GET /api/auth/verify` | GET | Verifies session cookie, checks ban/event status; clears cookie on failure |
| `DELETE /api/auth/verify` | DELETE | Logout - clears session cookie |

### 7.2 Authenticated Participant Endpoints (via `secureGuard()`)

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/secure/heartbeat` | POST | Client heartbeat every 60s; inserts activity log; updates `last_seen_at` (2-min debounce) |
| `PATCH /api/secure/profile` | PATCH | Update profile fields (Zod validated, sanitized) |
| `POST /api/secure/photos` | POST | Create photo DB record (validates path ownership, 10-photo limit) |
| `DELETE /api/secure/photos` | DELETE | Delete photo (storage file + DB record, ownership verified) |
| `PATCH /api/secure/photos` | PATCH | Reorder photos (batch `order_index` update) |
| `POST /api/secure/upload-url` | POST | Generate signed upload URL (path scoping + extension whitelist) |
| `POST /api/secure/likes` | POST | Send like (block check, dedup, match detection, activity log) |
| `DELETE /api/secure/likes` | DELETE | Remove like + associated notification |
| `POST /api/secure/likes/seen` | POST | Mark likes as seen (single or all) |
| `POST /api/secure/conversations` | POST | Get or create conversation (block/self-chat guard, race-condition safe) |
| `POST /api/secure/conversations/read` | POST | Mark conversation as read |
| `POST /api/secure/messages` | POST | Send message (membership check, block check, Zod schema, sanitization) |
| `PATCH /api/secure/messages` | PATCH | Soft-delete message (sender only - sets `is_deleted`, clears content) |
| `POST /api/secure/blocks` | POST | Block participant (full cascade: records context, deletes likes/convos/messages/notifications/media) |
| `POST /api/account/delete` | POST | **Permanent account deletion** - full cascade + session clear |

### 7.3 Admin Endpoints (via `adminGuard()`)

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/admin/login` | POST | Admin login (timing-safe comparison, brute-force lockout) |
| `POST /api/admin/logout` | POST | Clear admin cookie |
| `GET /api/admin/events` | GET | List events with filtering, sorting, search |
| `POST /api/admin/events` | POST | Create event (auto-slug, auto-join-code, Zod validated) |
| `PATCH /api/admin/events/[eventId]` | PATCH | Update event (cache eviction on status change) |
| `GET /api/admin/events/[eventId]/stats` | GET | Quick aggregate counts (participants, conversations, likes, messages, blocks) |
| `GET /api/admin/events/[eventId]/analytics` | GET | **Deep analytics** (646 lines): demographics, engagement funnels, match rates, peak hours, response times |
| `GET /api/admin/events/[eventId]/participants` | GET | List participants with `profile_complete` flag |
| `PATCH /api/admin/events/[eventId]/participants` | PATCH | Ban/unban (syncs `banned_devices`, evicts ban cache) |
| `POST /api/admin/events/[eventId]/archive` | POST | Save analytics snapshot, purge all user data, set status → archived |
| `DELETE /api/admin/events/[eventId]/delete` | DELETE | Full cascade delete (event + all data + storage files) |
| `POST /api/admin/events/[eventId]/background` | POST | Upload background image (MIME validation, 5MB limit) |
| `DELETE /api/admin/events/[eventId]/background` | DELETE | Remove background image |
| `POST /api/admin/events/[eventId]/rotate` | POST | Rotate (regenerate) event join code |
| `GET/POST /api/admin/auto-archive` | GET/POST | **Vercel Cron** (daily 3AM UTC): auto-transitions event lifecycle |
| `GET /api/admin/global-analytics` | GET | **Cross-event analytics** (510 lines): aggregates live + archived data |
| `GET/POST /api/cleanup` | GET/POST | **Vercel Cron** (daily 4AM UTC): archives old events, purges data |

---

## 8. State Management Architecture

### 8.1 Zustand Stores - 10 Stores

| Store | Persisted | Purpose |
|---|---|---|
| `useSessionStore` | `localStorage` | Event context (eventId, slug, name), participantId, own photos. `clearSession()` cascade-resets ALL other stores. |
| `useGridStore` | No | Visible participants list + gender filter |
| `useChatsStore` | No | Conversation list + currently-viewed messages |
| `useLikesStore` | No | Received and sent likes |
| `useBlocksStore` | No | Blocked participant IDs set |
| `useToastStore` | No | Toast notification queue |
| `useNotificationStore` | No | Unread like/message counters, grid highlights (badge indicators on cards), unread conversation ID tracking |
| `useSwipeStore` | No | Grid vs swipe view mode, dismissed/liked ID sets |
| `useMatchStore` | No | Match popup queue, matches list |

### 8.2 Cascade Reset Pattern

```typescript
useSessionStore.clearSession()
  → dynamically imports and calls .getState().reset() on ALL other stores
  → prevents data from Event A leaking into Event B
```

**Why Zustand over Redux/Context**:
- No Provider wrapper needed (critical for the layout shell pattern where each component mounts independently)
- Minimal re-renders (only subscribed selectors trigger)
- Tiny bundle (~1KB gzipped)
- Simple API - no actions/reducers/dispatch ceremony
- Event-scoped data doesn't need persistence - it's refetched from the server on every reconnect

---

## 9. Realtime Architecture - RealtimeHub

### 9.1 Singleton Pattern

`RealtimeHub` is a module-level singleton (`Map<string, ManagedChannel>`) that lives **outside the React component tree**. This is critical because:

- React StrictMode double-mounts components in dev - the hub uses reference counting to survive this
- Fast-refresh and navigation unmount/remount components - channels persist across navigations
- Only one WebSocket connection per channel key, shared across all subscribers

### 9.2 Channel Lifecycle

```
Component mounts → useRealtimeHub hook → hub.subscribe(channelKey, bindings, handlers)
  → getOrCreate(channelKey): if channel exists, refCount++; else create new channel
  → handlers stored in Map<bindingKey, Set<handler>>

Component unmounts → subscription.unsubscribe()
  → remove handler from set → refCount--
  → if refCount === 0: supabase.removeChannel() → channels.delete(key)
```

### 9.3 Auto-Reconnection

```
User backgrounds app (locks phone, switches to another app)
  → WebSocket silently dies
  → User returns to app
  → visibilitychange event fires (or 'online' event)
  → 500ms delay (network stack wakeup)
  → reconnectStaleChannels(): checks each channel.state
  → if not 'joined' or 'joining': tear down old channel, rebuild with same bindings + handlers
  → re-subscribe
```

### 9.4 useRealtimeHub Hook

- Handlers stored in `useRef` so they always have latest closure values without triggering re-subscriptions
- Only `channelKey` and `enabled` flag changes cause re-subscription
- Cleanup in `useEffect` return - safe for StrictMode

---

## 10. PWA Architecture

### 10.1 Service Worker (Serwist)

Built from `src/app/sw.ts` at build time via `@serwist/next`:

- **Precaching**: All static assets from the Next.js build manifest
- **Runtime caching**: Next.js default strategies (NetworkFirst for pages, CacheFirst for static assets) + custom `NetworkOnly` for `/api/admin` and `/api/auth` (prevents stale session responses from cache)
- **Skip waiting + clients claim**: New SW version activates immediately without waiting for all tabs to close
- **Navigation preload**: Enabled for faster navigations on repeat visits

### 10.2 PWA Manifest

```json
{
  "id": "/dating",
  "name": "Eventa Dating",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/dating",
  "start_url": "/dating",
  "theme_color": "#0a0a0a",
  "lang": "he",
  "dir": "rtl",
  "categories": ["social", "lifestyle"]
}
```

### 10.4 Build Pipeline

```
next build --webpack
  → Serwist plugin compiles src/app/sw.ts → public/sw.js
  → fix-sw-paths.cjs post-processes precache manifest paths
  → Deploy to Vercel
```

---

## 11. Client-Side API Layer

### 11.1 Organization

- `src/lib/api/*.ts` - Individual API function files (auth, grid, likes, matches, conversations, photos, blocks, profile, account)
- `src/lib/api/index.ts` - Barrel re-export of all ~30 client-side API functions
- `src/lib/api/helpers.ts` - Server-side data helpers (photo URL building, blocked-IDs cache, batch loading)

### 11.2 Data Fetching Pattern

Client components call typed API functions which make `fetch()` calls to Next.js API routes. The API routes use the Supabase `service_role` client for database operations and return JSON responses. No direct Supabase client calls for writes - only reads (via the anon client with RLS) and realtime subscriptions.

---

## 12. Deployment Configuration

### 12.1 Vercel (`vercel.json`)

```json
{
  "regions": ["fra1"],
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 15 }
  },
  "crons": [
    { "path": "/api/admin/auto-archive", "schedule": "0 3 * * *" },
    { "path": "/api/cleanup",            "schedule": "0 4 * * *" }
  ]
}
```

- **Region**: Frankfurt (`fra1`) - lowest latency to Israel
- **Function timeout**: 15 seconds max (sufficient for all operations including analytics aggregation)
- **Cron jobs**: Two daily maintenance tasks for event lifecycle management

### 12.2 Service Worker Headers

```json
{
  "source": "/sw.js",
  "headers": [
    { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
    { "key": "Service-Worker-Allowed", "value": "/" }
  ]
}
```

The SW is never cached by the browser - ensures updates propagate immediately.

---

## 13. SEO & Discoverability

| Feature | Implementation |
|---|---|
| **Sitemap** | Dynamic `sitemap.ts` - 9 URLs with change frequencies and priorities |
| **Robots** | `robots.txt` - allows all, blocks `/admin`, `/api/` |
| **Structured data** | `application/ld+json` Organization schema in root layout |
| **Open Graph** | Full OG metadata on landing pages with `og-image.png` (1536×1024) |
| **Twitter Cards** | `summary_large_image` card type |
| **Canonical URLs** | `alternates.canonical` on all public pages |
| **Meta robots** | `index: true, follow: true` in root layout metadata |

---

## 14. Environment Variables

| Variable | Context | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Yes | Supabase anon key (read-only via RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Full DB access, bypasses RLS |
| `JWT_SECRET` | Server only | Yes (min 32 chars) | HMAC key for session JWTs |
| `ADMIN_PASSWORD` | Server only | Yes (min 12 chars) | Admin login password |
| `CRON_SECRET` | Server only | Yes (min 16 chars) | Bearer token for Vercel Cron authentication |
| `SMTP_HOST` | Server only | Optional | SMTP server for order emails |
| `SMTP_PORT` | Server only | Optional | SMTP port |
| `SMTP_USER` | Server only | Optional | SMTP username |
| `SMTP_PASS` | Server only | Optional | SMTP password |

All validated at startup via Zod schema (`validateEnv()` in `src/lib/validations.ts`).

---

## 15. Key Constants

```typescript
MAX_PHOTOS = 10              // Max profile photos per participant
MAX_BACKGROUND_SIZE = 5MB    // Max event background image size
MAX_NAME_LENGTH = 30         // Display name character limit
MAX_BIO_LENGTH = 200         // Bio character limit
MAX_CITY_LENGTH = 50         // City field character limit
MAX_MESSAGE_LENGTH = 2000    // Chat message character limit
MAX_IMAGE_SIZE = 20MB        // Raw upload limit (before compression)
RETENTION_DAYS = 7           // Days after event ends before data deletion
STORAGE_BATCH_SIZE = 100     // Files deleted per storage batch during cleanup
HEARTBEAT_INTERVAL = 60s     // Client heartbeat frequency
LAST_SEEN_DEBOUNCE = 2min    // Min interval between last_seen_at DB updates
POLL_INTERVAL = 15s          // Notification polling fallback interval
BAN_CACHE_TTL = 5min         // Ban check cache (10s if banned)
EVENT_CACHE_TTL = 5min       // Event status cache (30s if paused)
BLOCKED_IDS_CACHE_TTL = 30s  // Blocked-IDs query cache
NAME_CACHE_TTL = 5min        // Participant display name cache
SEEN_IDS_PRUNE = 5min        // Realtime notification dedup set auto-prune
```

---

## 16. Admin Dashboard

A full single-page admin panel at `/admin`:

- **Event management**: Create, edit, pause, end, archive, delete events
- **Participant moderation**: View participants, ban/unban with dual fingerprint enforcement
- **QR code generation**: For event join links (using `qrcode` library)
- **Background image upload**: Per-event custom backgrounds (5MB limit, webp/jpeg/png)
- **Per-event analytics**: Demographics, engagement funnels, match rates, peak hours, response times, photo impact analysis (646-line analytics endpoint)
- **Global analytics**: Cross-event comparison, growth timelines, aggregate engagement metrics (510-line endpoint)
- **Auto-archiving**: Events auto-transition through `active → ended → archived` lifecycle

---

## 17. File Structure Summary

```
├── next.config.js              # Next.js + Serwist SW config + CSP headers
├── vercel.json                 # Vercel deployment: region, crons, function limits
├── tsconfig.json               # TypeScript strict mode, ES2022, path aliases
├── postcss.config.js           # Tailwind CSS 4 via @tailwindcss/postcss
├── package.json                # All dependencies + build scripts
│
├── public/
│   ├── manifest.json           # PWA manifest (Hebrew, RTL, standalone)
│   ├── robots.txt              # Search engine directives
│   ├── sw.js                   # Compiled service worker (build output)
│   └── icons/                  # App icons (192, 512, maskable variants)
│
├── scripts/
│   ├── fix-sw-paths.cjs        # Post-build SW path adjustment
│   ├── generate-icons.cjs      # Icon generation script
│   └── seed-fake-users.cjs     # Development data seeding
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, metadata, structured data)
│   │   ├── page.tsx            # Homepage (SSR)
│   │   ├── sitemap.ts          # Dynamic XML sitemap
│   │   ├── sw.ts               # Service worker source (Serwist)
│   │   ├── globals.css         # Tailwind + 9 modular CSS imports
│   │   ├── styles/             # 9 CSS modules (base, layout, grid, chat, etc.)
│   │   │
│   │   ├── dating/
│   │   │   ├── page.tsx        # Product landing (SSR with dynamic imports)
│   │   │   ├── layout.tsx      # SEO metadata
│   │   │   ├── _components/    # DemoPhone, OrderForm
│   │   │   └── [eventSlug]/
│   │   │       ├── layout.tsx  # Event shell (SessionProvider, Realtime, etc.)
│   │   │       ├── page.tsx    # Participant grid
│   │   │       ├── _components/# SwipeCard, SwipeView
│   │   │       ├── join/       # Join flow
│   │   │       ├── setup/      # Profile setup
│   │   │       ├── profile/    # Own profile view/edit
│   │   │       ├── user/       # Other user profile
│   │   │       ├── likes/      # Received likes
│   │   │       ├── chats/      # Conversation list
│   │   │       ├── chat/       # Chat thread
│   │   │       ├── banned/     # Ban screen
│   │   │       └── unavailable/# Event ended screen
│   │   │
│   │   ├── admin/
│   │   │   ├── page.tsx        # Admin SPA root
│   │   │   ├── layout.tsx      # Admin layout
│   │   │   ├── admin.css       # Admin styles
│   │   │   └── _components/    # AdminLogin, Sidebar, events/, analytics/, charts/
│   │   │
│   │   ├── api/                # 30+ API route files
│   │   │   ├── auth/           # join, verify
│   │   │   ├── secure/         # heartbeat, profile, photos, likes, messages, blocks, etc.
│   │   │   ├── admin/          # events CRUD, analytics, participants, cron jobs
│   │   │   ├── account/        # delete account
│   │   │   ├── order/          # booking form email
│   │   │   ├── health/         # health check
│   │   │   └── cleanup/        # data retention cron
│   │   │
│   │   └── (legal pages)       # about, faq, privacy, terms, safety, cookies, community
│   │
│   ├── components/             # 17 shared components
│   │   ├── SessionProvider.tsx
│   │   ├── RealtimeNotificationListener.tsx
│   │   ├── HeartbeatPinger.tsx
│   │   ├── NetworkStatus.tsx
│   │   ├── MobileGuard.tsx
│   │   ├── MatchPopup.tsx
│   │   ├── TabBar.tsx
│   │   ├── Toast.tsx
│   │   ├── ImageCropper.tsx
│   │   ├── EventBackground.tsx
│   │   ├── AppHeader.tsx
│   │   ├── BlockConfirmDialog.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Icons.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Skeletons.tsx
│   │   ├── Animations.tsx
│   │   └── LegalPageLayout.tsx
│   │
│   ├── hooks/
│   │   ├── useRealtimeHub.ts   # React wrapper for RealtimeHub singleton
│   │   └── useAppResume.ts     # visibilitychange callback hook
│   │
│   ├── lib/
│   │   ├── supabase.ts         # Anon + service client setup, event context injection
│   │   ├── realtimeHub.ts      # Singleton channel manager (257 lines)
│   │   ├── session.ts          # JWT sign/verify for participant sessions
│   │   ├── admin-auth.ts       # JWT sign/verify for admin sessions
│   │   ├── route-helpers.ts    # secureGuard(), adminGuard(), caching, path validation
│   │   ├── rate-limit.ts       # Sliding window rate limiter
│   │   ├── validations.ts      # All Zod schemas (profile, event, message, join, etc.)
│   │   ├── constants.ts        # Shared constants + Hebrew labels
│   │   ├── sanitize.ts         # Server + client HTML sanitization
│   │   ├── image-compression.ts# Client-side WebP compression
│   │   ├── device-fingerprint.ts# Canvas + WebGL + screen + navigator fingerprinting
│   │   ├── database.types.ts   # Full TypeScript types for all tables + enums
│   │   ├── api.ts              # Legacy (barrel)
│   │   ├── api/                # 11 client API function files
│   │   └── stores/             # 10 Zustand store files
│   │
│   └── shared/                 # Shared utilities
│
└── supabase/
    ├── config.toml             # Local dev config (Postgres 17, Realtime enabled)
    ├── schema.sql              # Base schema (291 lines)
    ├── production-setup.sql    # Full production schema with RLS + indexes
    ├── migration-security.sql  # RLS hardening migration
    └── migrations/             # 7 incremental migrations
        ├── 001_admin_dashboard.sql
        ├── 002_performance_indexes.sql
        ├── 003_rls_event_scoping.sql
        ├── 004_check_constraints_and_realtime.sql
        ├── 005_nullable_last_message_at.sql
        ├── 006_push_subscriptions.sql  # (table dropped - push removed)
        └── 007_hardware_fingerprint.sql
```
