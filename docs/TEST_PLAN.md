# Eventa - Comprehensive Test Plan

> **Status:** Plan only - no tests implemented yet.
> **Created:** Session 14
> **Scope:** Every function, route, store, component, hook, and user flow.

---

## Table of Contents

1. [Testing Stack & Setup](#1-testing-stack--setup)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [E2E Tests](#4-e2e-tests)
5. [Test Matrix Summary](#5-test-matrix-summary)

---

## 1. Testing Stack & Setup

| Layer | Tool | Why |
|-------|------|-----|
| Unit + Integration | **Vitest** | Native ESM, fast, TS-first, compatible with Next.js |
| Component | **React Testing Library** + Vitest | Standard for React 19 |
| E2E | **Playwright** | Cross-browser, mobile viewport, reliable |
| Mocking | **MSW (Mock Service Worker)** | Intercept `fetch()` in both unit & integration |
| DB (integration) | **Supabase local** or **test project** | Isolated data per run |
| Coverage | **v8** (via Vitest) | Built-in |

### File conventions

```
__tests__/
  unit/
    lib/                    # Pure function tests
    stores/                 # Zustand store tests
    components/             # Component render tests
  integration/
    api/                    # API route handler tests
  e2e/
    flows/                  # Playwright user flow tests
```

---

## 2. Unit Tests

### 2.1 `lib/session.ts` - Session & Auth (7 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-SES-01 | `signSessionToken()` | Sign with valid data → returns JWT string | Non-empty string, 3 dot-separated parts |
| U-SES-02 | `signSessionToken()` | Payload includes pid, eid, role, iss, aud, exp, iat | All fields present in decoded token |
| U-SES-03 | `verifySessionToken()` | Verify a just-signed token | Returns correct `SessionPayload` |
| U-SES-04 | `verifySessionToken()` | Expired token (mock time) | Returns `null` |
| U-SES-05 | `verifySessionToken()` | Tampered signature | Returns `null` |
| U-SES-06 | `verifySessionToken()` | Wrong issuer | Returns `null` |
| U-SES-07 | `verifySessionToken()` | Wrong audience | Returns `null` |
| U-SES-08 | `verifySessionToken()` | Empty/malformed string | Returns `null` |
| U-SES-09 | `sessionCookieHeader()` | Returns valid Set-Cookie string | Contains `ws_session=`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` |
| U-SES-10 | `clearSessionCookieHeader()` | Returns expire cookie | Contains `Max-Age=0` |
| U-SES-11 | `getSessionFromRequest()` | Request with valid `ws_session` cookie | Returns `SessionPayload` |
| U-SES-12 | `getSessionFromRequest()` | Request with no cookie | Returns `null` |
| U-SES-13 | `getSessionFromRequest()` | Request with invalid cookie | Returns `null` |
| U-SES-14 | `checkCsrf()` | `x-csrf-token: 1` + valid `Origin` header | Returns `true` |
| U-SES-15 | `checkCsrf()` | Missing `x-csrf-token` | Returns `false` |
| U-SES-16 | `checkCsrf()` | Mismatched `Origin` | Returns `false` |
| U-SES-17 | `checkCsrf()` | `Referer` fallback when no `Origin` | Returns `true` if valid |
| U-SES-18 | `isValidUUID()` | Valid UUID v4 | Returns `true` |
| U-SES-19 | `isValidUUID()` | Empty string, random text, partial UUID | Returns `false` |
| U-SES-20 | `isValidUUID()` | UUID with wrong length | Returns `false` |

### 2.2 `lib/admin-auth.ts` - Admin Auth (7 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-ADM-01 | `signAdminToken()` | Returns JWT with admin role | Contains `role: admin` |
| U-ADM-02 | `signAdminToken()` | Expiry matches `ADMIN_MAX_AGE_S` | `exp - iat == ADMIN_MAX_AGE_S` |
| U-ADM-03 | `verifyAdminToken()` | Valid token | Returns `true` |
| U-ADM-04 | `verifyAdminToken()` | Expired token | Returns `false` |
| U-ADM-05 | `verifyAdminToken()` | `null` / `undefined` input | Returns `false` |
| U-ADM-06 | `verifyAdminToken()` | Tampered token | Returns `false` |
| U-ADM-07 | `adminCookieHeader()` | Valid Set-Cookie string | Contains `ws_admin=`, `HttpOnly`, `Secure`, `SameSite=Strict` |
| U-ADM-08 | `clearAdminCookieHeader()` | Expire cookie | Contains `Max-Age=0` |
| U-ADM-09 | `getAdminTokenFromRequest()` | Request with `ws_admin` cookie | Returns token string |
| U-ADM-10 | `getAdminTokenFromRequest()` | No cookie | Returns `null` |
| U-ADM-11 | `verifyAdminFromRequest()` | Valid admin cookie | Returns `true` |
| U-ADM-12 | `verifyAdminFromRequest()` | Invalid admin cookie | Returns `false` |
| U-ADM-13 | `adminAuditLog()` | Logs action with correct format | Logger called with `[ADMIN]` prefix, action, details, timestamp |

### 2.3 `lib/validations.ts` - Zod Schemas & Image Validation (10 schemas, 3 functions)

| ID | Target | Test | Expected |
|----|--------|------|----------|
| U-VAL-01 | `validateEnv()` | All env vars present | No throw |
| U-VAL-02 | `validateEnv()` | Missing `SUPABASE_URL` | Throws with descriptive message |
| U-VAL-03 | `validateEnv()` | Missing `JWT_SECRET` | Throws |
| U-VAL-04 | `profileSetupSchema` | Valid profile data | Parses successfully |
| U-VAL-05 | `profileSetupSchema` | `display_name` empty string | Fails validation |
| U-VAL-06 | `profileSetupSchema` | `display_name` exceeds `MAX_NAME_LENGTH` | Fails validation |
| U-VAL-07 | `profileSetupSchema` | `bio` exceeds `MAX_BIO_LENGTH` | Fails validation |
| U-VAL-08 | `profileSetupSchema` | `city` exceeds `MAX_CITY_LENGTH` | Fails validation |
| U-VAL-09 | `profileSetupSchema` | `age` < 16 | Fails validation |
| U-VAL-10 | `profileSetupSchema` | `age` > 120 | Fails validation |
| U-VAL-11 | `profileSetupSchema` | `gender` invalid value | Fails validation |
| U-VAL-12 | `profileSetupSchema` | `attracted_to` invalid value | Fails validation |
| U-VAL-13 | `profileSetupSchema` | `looking_for` invalid value | Fails validation |
| U-VAL-14 | `profileSetupSchema` | All valid enum combinations | Parses for each gender × attracted_to × looking_for |
| U-VAL-15 | `adminLoginSchema` | Valid `{ password }` | Parses |
| U-VAL-16 | `adminLoginSchema` | Empty password | Fails |
| U-VAL-17 | `createEventSchema` | Valid event data | Parses |
| U-VAL-18 | `createEventSchema` | Missing required fields | Fails with field-level errors |
| U-VAL-19 | `createEventSchema` | `title` > max length | Fails |
| U-VAL-20 | `createEventSchema` | `event_type` invalid | Fails |
| U-VAL-21 | `createEventSchema` | `event_date` in the past | Validates (no past check in schema) |
| U-VAL-22 | `updateEventSchema` | Partial valid update | Parses |
| U-VAL-23 | `updateEventSchema` | `status` invalid | Fails |
| U-VAL-24 | `sendMessageSchema` | Valid text message | Parses |
| U-VAL-25 | `sendMessageSchema` | `text` > `MAX_MESSAGE_LENGTH` | Fails |
| U-VAL-26 | `sendMessageSchema` | `type` not in `messageTypeValues` | Fails |
| U-VAL-27 | `sendMessageSchema` | Image type with `media_path` | Parses |
| U-VAL-28 | `joinEventSchema` | Valid `{ slug, joinCode }` | Parses |
| U-VAL-29 | `joinEventSchema` | Missing fields | Fails |
| U-VAL-30 | `photoReorderSchema` | Valid array of `{ id, order_index }` | Parses |
| U-VAL-31 | `photoReorderSchema` | Empty array | Behavior check |
| U-VAL-32 | `photoReorderSchema` | Negative `order_index` | Fails |
| U-VAL-33 | `likeSeenSchema` | Valid `{ from_participant_id }` | Parses |
| U-VAL-34 | `likeSeenSchema` | Invalid UUID | Fails |
| U-VAL-35 | `getEffectiveImageType()` | JPEG file → `image/jpeg` | Correct type |
| U-VAL-36 | `getEffectiveImageType()` | `.jpg` extension fallback | Returns `image/jpeg` |
| U-VAL-37 | `getEffectiveImageType()` | Unknown MIME returns as-is | Pass-through |
| U-VAL-38 | `validateImageFile()` | Valid JPEG < 10MB | Returns `null` (no error) |
| U-VAL-39 | `validateImageFile()` | File > 10MB | Returns error string |
| U-VAL-40 | `validateImageFile()` | Non-image MIME type | Returns error string |
| U-VAL-41 | `validateImageFile()` | GIF file (not allowed) | Returns error string |
| U-VAL-42 | `validateImageMagicBytes()` | JPEG magic bytes (FF D8 FF) | Returns `null` |
| U-VAL-43 | `validateImageMagicBytes()` | PNG magic bytes (89 50 4E 47) | Returns `null` |
| U-VAL-44 | `validateImageMagicBytes()` | WebP magic bytes (RIFF...WEBP) | Returns `null` |
| U-VAL-45 | `validateImageMagicBytes()` | Random bytes → mismatch | Returns error string |
| U-VAL-46 | `validateImageMagicBytes()` | Empty buffer | Returns error string |
| U-VAL-47 | `validateImageMagicBytes()` | PDF masquerading as image | Returns error string |

### 2.4 `lib/sanitize.ts` - Input Sanitization (2 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-SAN-01 | `sanitize()` | Normal text | Returns unchanged |
| U-SAN-02 | `sanitize()` | `<script>alert(1)</script>` | Strips script tag |
| U-SAN-03 | `sanitize()` | `<img onerror=alert(1)>` | Strips event handler |
| U-SAN-04 | `sanitize()` | HTML entities | Properly handled |
| U-SAN-05 | `sanitize()` | Hebrew text with diacritics | Preserved |
| U-SAN-06 | `sanitize()` | Emoji | Preserved |
| U-SAN-07 | `sanitize()` | Empty string | Returns empty string |
| U-SAN-08 | `sanitizeWithLimit()` | Text within limit | Returns full text |
| U-SAN-09 | `sanitizeWithLimit()` | Text exceeding limit | Truncated to max length |
| U-SAN-10 | `sanitizeWithLimit()` | XSS + exceeds limit | Sanitized AND truncated |
| U-SAN-11 | `sanitizeWithLimit()` | Limit = 0 | Returns empty string |

### 2.5 `lib/rate-limit.ts` - Rate Limiting (2 functions, 1 config)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-RAT-01 | `checkRateLimit()` | First request | Returns `{ allowed: true }` |
| U-RAT-02 | `checkRateLimit()` | Exactly at limit | Returns `{ allowed: true }` |
| U-RAT-03 | `checkRateLimit()` | One over limit | Returns `{ allowed: false }` |
| U-RAT-04 | `checkRateLimit()` | Window expires → requests allowed again | `allowed: true` after window |
| U-RAT-05 | `checkRateLimit()` | Different IPs → independent limits | Each IP has own counter |
| U-RAT-06 | `checkRateLimit()` | Different route names → independent limits | Each route has own counter |
| U-RAT-07 | `getClientIp()` | `x-forwarded-for: 1.2.3.4, 5.6.7.8` | Returns `1.2.3.4` |
| U-RAT-08 | `getClientIp()` | No forwarded header | Returns `unknown` |
| U-RAT-09 | `getClientIp()` | `x-real-ip` header | Returns its value |
| U-RAT-10 | `RATE_LIMITS` | Has `default`, `auth`, `upload`, `admin` tiers | All 4 exist with `max` and `windowMs` |

### 2.6 `lib/route-helpers.ts` - Route Security Pipeline (5 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-RTH-01 | `jsonError()` | Returns JSON response with error field | `{ error: string }`, correct status code |
| U-RTH-02 | `jsonError()` | Content-Type header | `application/json` |
| U-RTH-03 | `evictBanCache()` | Removes entry from ban cache | Subsequent check hits DB |
| U-RTH-04 | `evictEventStatusCache()` | Removes entry from event cache | Subsequent check hits DB |
| U-RTH-05 | `secureGuard()` | Valid session + CSRF + not banned + active event | Returns `{ session, ... }` |
| U-RTH-06 | `secureGuard()` | Missing session cookie | Returns 401 error |
| U-RTH-07 | `secureGuard()` | Invalid session token | Returns 401 error |
| U-RTH-08 | `secureGuard()` | Missing CSRF header | Returns 403 error |
| U-RTH-09 | `secureGuard()` | Banned participant | Returns 403 with "banned" |
| U-RTH-10 | `secureGuard()` | Ban result cached (no re-query within TTL) | Only 1 DB call for repeated checks |
| U-RTH-11 | `secureGuard()` | Event not active (ended/paused/archived) | Returns 403 with event status |
| U-RTH-12 | `secureGuard()` | Event status cached | Only 1 DB call within TTL |
| U-RTH-13 | `secureGuard()` | Cache eviction works → next call re-queries | Fresh data after evict |
| U-RTH-14 | `secureGuard()` | Cache bounded at `MAX_CACHE_SIZE` | Oldest entries evicted |
| U-RTH-15 | `isSafePath()` | Normal path `photos/abc.jpg` | Returns `true` |
| U-RTH-16 | `isSafePath()` | Path traversal `../../etc/passwd` | Returns `false` |
| U-RTH-17 | `isSafePath()` | Null bytes | Returns `false` |
| U-RTH-18 | `isSafePath()` | URL-encoded traversal `%2e%2e%2f` | Returns `false` |
| U-RTH-19 | `isSafePath()` | Empty string | Returns `false` |
| U-RTH-20 | `isSafePath()` | Path with spaces | Returns `true` |

### 2.7 `lib/device-fingerprint.ts` - Device Identification (2 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-DFP-01 | `generateDeviceFingerprint()` | Returns SHA-256 hex string | 64-char hex string |
| U-DFP-02 | `generateDeviceFingerprint()` | Deterministic for same environment | Same hash for same mocked canvas/WebGL/screen |
| U-DFP-03 | `generateDeviceFingerprint()` | Different screen → different hash | Hash changes |
| U-DFP-04 | `getDeviceIdentifiers()` | Returns `{ deviceFingerprint, hardwareFingerprint }` | Both non-empty strings |
| U-DFP-05 | `getDeviceIdentifiers()` | `deviceFingerprint` persisted in localStorage | Second call returns same value |
| U-DFP-06 | `getDeviceIdentifiers()` | New localStorage UUID if not present | UUID v4 format |
| U-DFP-07 | `getDeviceIdentifiers()` | Canvas not supported → graceful fallback | Returns fingerprint (with empty canvas data) |

### 2.8 `lib/image-compression.ts` - Image Processing (4 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-IMG-01 | `compressImage()` | Compresses large image | Output size < input size |
| U-IMG-02 | `compressImage()` | Respects `maxWidth` / `maxHeight` | Compressed image ≤ limits |
| U-IMG-03 | `compressImage()` | Decompression bomb defense (huge dimensions) | Rejects or handles safely |
| U-IMG-04 | `compressImage()` | Very small image → no compression needed | Returns similar size |
| U-IMG-05 | `compressProfilePhoto()` | Uses profile-specific config (800px, 0.8 quality) | Output within expected range |
| U-IMG-06 | `compressChatImage()` | Uses chat-specific config (1200px, 0.7 quality) | Output within expected range |
| U-IMG-07 | `createThumbnailUrl()` | Returns data URL | Starts with `data:image/` |
| U-IMG-08 | `createThumbnailUrl()` | Thumbnail is small | Output URL length within reasonable bounds |

### 2.9 `lib/supabase.ts` - Client Setup (3 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-SUP-01 | `setEventContext()` | Sets `eventId` | Subsequent requests include `x-event-id` header |
| U-SUP-02 | `setEventContext(null)` | Clears context | Header removed |
| U-SUP-03 | `getServiceClient()` | Returns Supabase client | Client has `service_role` key |
| U-SUP-04 | `getServiceClient()` | Singleton - same instance | Two calls return same reference |
| U-SUP-05 | `generateJoinCode()` | Returns 6-char uppercase alphanumeric | Matches `/^[A-Z0-9]{6}$/` |
| U-SUP-06 | `generateJoinCode()` | No ambiguous characters (O/0/I/1) | None of those chars appear |

### 2.10 `lib/config.ts` - Configuration Constants

| ID | Test | Expected |
|----|------|----------|
| U-CFG-01 | `SESSION_MAX_AGE_S` equals 30 days | `30 * 24 * 60 * 60` |
| U-CFG-02 | `ADMIN_MAX_AGE_S` equals 24 hours | `24 * 60 * 60` |
| U-CFG-03 | `JWT_ISSUER` is derived from `NEXT_PUBLIC_SITE_URL`'s host | Exact match |
| U-CFG-04 | `JWT_AUDIENCE` is `'eventa-app'` | Exact match |
| U-CFG-05 | All cache TTLs are positive numbers | `> 0` |
| U-CFG-06 | `MAX_CACHE_SIZE` is reasonable (500–50000) | Within range |
| U-CFG-07 | Order field max lengths are positive | All `> 0` |

### 2.11 `lib/constants.ts` - Domain Constants

| ID | Test | Expected |
|----|------|----------|
| U-CON-01 | `MAX_PHOTOS` is 10 | Exact match |
| U-CON-02 | `MAX_BACKGROUND_SIZE_BYTES` is 5MB | `5 * 1024 * 1024` |
| U-CON-03 | `MAX_NAME_LENGTH` is 30 | Exact match |
| U-CON-04 | `MAX_BIO_LENGTH` is 200 | Exact match |
| U-CON-05 | `MAX_CITY_LENGTH` is 50 | Exact match |
| U-CON-06 | `MAX_MESSAGE_LENGTH` is 2000 | Exact match |
| U-CON-07 | `RETENTION_DAYS` is 7 | Exact match |
| U-CON-08 | `LOOKING_FOR_LABELS` has all `lookingForValues` keys | Keys match |
| U-CON-09 | `EVENT_TYPE_LABELS` has all `eventTypeValues` keys | Keys match |
| U-CON-10 | `EVENT_STATUS_LABELS` has all `eventStatusValues` keys | Keys match |
| U-CON-11 | All label values are non-empty Hebrew strings | Length > 0 |
| U-CON-12 | `EVENT_TYPE_ICONS` has keys for all event types | Keys match |

### 2.12 `lib/logger.ts` - Structured Logger

| ID | Test | Expected |
|----|------|----------|
| U-LOG-01 | `logger.info()` | Calls `console.log` with structured JSON in production |
| U-LOG-02 | `logger.warn()` | Calls `console.warn` |
| U-LOG-03 | `logger.error()` | Calls `console.error` |
| U-LOG-04 | Logger includes timestamp, level, message | All fields present |
| U-LOG-05 | Logger includes optional `extra` object | Merged into log entry |
| U-LOG-06 | Development mode → colored output | ANSI codes present |

---

### 2.13 Zustand Stores - State Management

#### 2.13.1 `stores/session.ts` - Session Store (4 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-SES-01 | `setSession()` | Sets session + persists to localStorage | `getState().session` matches, localStorage has `eventa_session` |
| U-STO-SES-02 | `setParticipant()` | Sets participant object | `getState().participant` matches |
| U-STO-SES-03 | `setPhotos()` | Sets photos array | `getState().photos` matches |
| U-STO-SES-04 | `clearSession()` | Clears session, participant, photos | All `null` / empty |
| U-STO-SES-05 | `clearSession()` | Removes localStorage entry | `eventa_session` gone |
| U-STO-SES-06 | `clearSession()` | Cascade resets all other stores | grid, chats, likes, blocks, matches, notifications, swipe, toast all reset |

#### 2.13.2 `stores/grid.ts` - Grid Store (6 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-GRD-01 | `setParticipants()` | Replaces array | Exact match |
| U-STO-GRD-02 | `setFilter()` | Changes filter to `'men'` / `'women'` / `'all'` | Filter updated |
| U-STO-GRD-03 | `removeParticipant()` | Removes by ID | Participant gone from array |
| U-STO-GRD-04 | `removeParticipant()` | Non-existent ID → no-op | Array unchanged |
| U-STO-GRD-05 | `addParticipant()` | Adds new participant | Appended to array |
| U-STO-GRD-06 | `addParticipant()` | Duplicate ID → no-op | Array length unchanged |
| U-STO-GRD-07 | `updateParticipant()` | Updates specific fields | Only targeted fields changed |
| U-STO-GRD-08 | `updateParticipant()` | Non-existent ID → no-op | Array unchanged |
| U-STO-GRD-09 | `reset()` | Clears participants, filter → `'all'` | Empty array, filter reset |

#### 2.13.3 `stores/chats.ts` - Chats Store (6 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-CHT-01 | `setConversations()` | Replaces array | Exact match |
| U-STO-CHT-02 | `addMessage()` | Appends to `currentMessages` | New message at end |
| U-STO-CHT-03 | `setCurrentMessages()` | Replaces messages array | Exact match |
| U-STO-CHT-04 | `removeConversation()` | Removes by ID | Conversation gone |
| U-STO-CHT-05 | `removeConversation()` | Non-existent ID → no-op | Array unchanged |
| U-STO-CHT-06 | `updateConversationPreview()` | Updates text, time, increments unread | Fields updated, unread +1 |
| U-STO-CHT-07 | `updateConversationPreview()` | `incrementUnread: false` | Unread count unchanged |
| U-STO-CHT-08 | `updateConversationPreview()` | Re-sorts conversations by `last_message_at` desc | Updated convo moves to top |
| U-STO-CHT-09 | `reset()` | Clears conversations + messages | Both empty |

#### 2.13.4 `stores/likes.ts` - Likes Store (4 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-LIK-01 | `setReceivedLikes()` | Replaces array | Exact match |
| U-STO-LIK-02 | `setSentLikes()` | Replaces array | Exact match |
| U-STO-LIK-03 | `removeParticipantLikes()` | Removes from both received and sent | Both filtered |
| U-STO-LIK-04 | `removeParticipantLikes()` | Non-existent ID → no-op | Arrays unchanged |
| U-STO-LIK-05 | `reset()` | Clears both arrays | Both empty |

#### 2.13.5 `stores/matches.ts` - Match Store (5 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-MAT-01 | `setPendingMatch()` | Sets match participant | `pendingMatch` set |
| U-STO-MAT-02 | `clearPendingMatch()` | Nulls pendingMatch | `pendingMatch` is `null` |
| U-STO-MAT-03 | `setMatches()` | Replaces array + sets `matchesLoaded: true` | Both updated |
| U-STO-MAT-04 | `removeMatch()` | Removes by participantId | Match gone |
| U-STO-MAT-05 | `removeMatch()` | Non-existent → no-op | Array unchanged |
| U-STO-MAT-06 | `reset()` | Clears pendingMatch, matches, matchesLoaded | All reset |

#### 2.13.6 `stores/blocks.ts` - Blocks Store (2 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-BLK-01 | `setBlocks()` | Sets blocks array + builds `blockedIds` Set | Both correct |
| U-STO-BLK-02 | `setBlocks()` | Excludes own ID from `blockedIds` | Current user's ID not in Set |
| U-STO-BLK-03 | `setBlocks()` | Both blocker and blocked IDs in Set (except self) | Union of both sides |
| U-STO-BLK-04 | `reset()` | Clears blocks + blockedIds | Both empty |

#### 2.13.7 `stores/notifications.ts` - Notification Store (10 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-NOT-01 | `setUnreadLikes()` | Sets count | Exact match |
| U-STO-NOT-02 | `setUnreadMessages()` | Sets count | Exact match |
| U-STO-NOT-03 | `incrementLikes()` | +1 | Previous + 1 |
| U-STO-NOT-04 | `decrementLikes()` | -1, min 0 | `max(0, previous - 1)` |
| U-STO-NOT-05 | `addUnreadConvo()` | Adds to `_unreadConvoIds` + updates `unreadMessages` | Set includes ID, count matches set size |
| U-STO-NOT-06 | `removeUnreadConvo()` | Removes from set + updates count | Set excludes ID |
| U-STO-NOT-07 | `clearUnreadLikes()` | Sets to 0 | `unreadLikes === 0` |
| U-STO-NOT-08 | `addGridHighlight()` | Adds highlight to array | Included |
| U-STO-NOT-09 | `removeGridHighlight()` | Removes all highlights for participant | All removed |
| U-STO-NOT-10 | `removeGridHighlightByType()` | Removes only matching type | Only type-matched removed |
| U-STO-NOT-11 | `reset()` | Clears all counts, sets, highlights | All zeroed/empty |

#### 2.13.8 `stores/swipe.ts` - Swipe Store (8 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-SWP-01 | `setViewMode()` | Toggles `'grid'` / `'swipe'` | Mode updated |
| U-STO-SWP-02 | `dismiss()` | Adds ID to `dismissedIds` | Set includes ID |
| U-STO-SWP-03 | `addLiked()` | Adds ID to `likedIds` | Set includes ID |
| U-STO-SWP-04 | `removeLiked()` | Removes ID from `likedIds` | Set excludes ID |
| U-STO-SWP-05 | `setLikedIds()` | Replaces set + marks `likedIdsLoaded` | Both updated |
| U-STO-SWP-06 | `resetPool()` | Clears `dismissedIds` only | `dismissedIds` empty, `likedIds` preserved |
| U-STO-SWP-07 | `reset()` | Clears everything | All initial state |

#### 2.13.9 `stores/toast.ts` - Toast Store (2 actions)

| ID | Action | Test | Expected |
|----|--------|------|----------|
| U-STO-TST-01 | `show()` | Sets message | `message` matches |
| U-STO-TST-02 | `show()` | Auto-clears after timeout | `message` is `null` after delay |
| U-STO-TST-03 | `show()` | Rapid calls → only last message survives | Previous timer cleared |
| U-STO-TST-04 | `reset()` | Clears message + timer | `message` is `null` |

---

### 2.14 Client API Helpers - `lib/api/`

#### 2.14.1 `api/helpers.ts` (5 exports)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-HLP-01 | `getPhotoUrl()` | Builds public URL from storage path | Correct Supabase URL |
| U-API-HLP-02 | `getPhotoUrl()` | Handles paths with special chars | Properly encoded |
| U-API-HLP-03 | `getBlockedIds()` | Fetches blocked IDs from Supabase | Returns `Set<string>` |
| U-API-HLP-04 | `getBlockedIds()` | Cached - second call doesn't re-fetch | No additional DB query |
| U-API-HLP-05 | `invalidateBlockedCache()` | Clears cache | Next call re-fetches |
| U-API-HLP-06 | `buildParticipantPhotoMaps()` | Batches photo lookup for ID list | Returns maps with all IDs |
| U-API-HLP-07 | `buildParticipantPhotoMaps()` | Empty ID list | Returns empty maps |

#### 2.14.2 `api/auth.ts` (1 function)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-AUT-01 | `joinEvent()` | Sends POST to `/api/auth/join` with body | Correct request shape |
| U-API-AUT-02 | `joinEvent()` | Includes CSRF header | `x-csrf-token: 1` present |
| U-API-AUT-03 | `joinEvent()` | Returns parsed response | `{ participant, event, ... }` |
| U-API-AUT-04 | `joinEvent()` | Server error → returns error object | `{ error: string }` |

#### 2.14.3 `api/account.ts` (1 function)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-ACC-01 | `deleteAccount()` | Sends DELETE to `/api/account/delete` | Correct method + path |
| U-API-ACC-02 | `deleteAccount()` | Includes CSRF header | Present |
| U-API-ACC-03 | `deleteAccount()` | Success → `{ ok: true }` | Correct shape |
| U-API-ACC-04 | `deleteAccount()` | Server error → `{ ok: false, error }` | Error message present |

#### 2.14.4 `api/profile.ts` (2 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-PRF-01 | `updateProfile()` | Sends PATCH to `/api/secure/profile` | Correct method + body |
| U-API-PRF-02 | `updateProfile()` | Includes CSRF + session | Headers present |
| U-API-PRF-03 | `getParticipant()` | Fetches participant by ID | Correct response |

#### 2.14.5 `api/photos.ts` (4 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-PHO-01 | `uploadPhoto()` | Sends POST to `/api/secure/photos` | Multipart form body |
| U-API-PHO-02 | `uploadPhoto()` | Validates file before sending (magic bytes) | Returns error for invalid |
| U-API-PHO-03 | `uploadPhoto()` | Signed URL flow → direct upload to storage | Two-step process |
| U-API-PHO-04 | `uploadPhoto()` | SDK fallback when signed URL fails | Falls back gracefully |
| U-API-PHO-05 | `deletePhoto()` | Sends DELETE with photo ID + path | Correct params |
| U-API-PHO-06 | `reorderPhotos()` | Sends PATCH with order array | Correct body shape |
| U-API-PHO-07 | `getMyPhotos()` | Fetches photos for participant | Returns array |

#### 2.14.6 `api/likes.ts` (7 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-LIK-01 | `sendLike()` | Sends POST to likes endpoint | Correct body |
| U-API-LIK-02 | `sendLike()` | Returns match info if reciprocal | `SendLikeResult` with match data |
| U-API-LIK-03 | `removeLike()` | Sends DELETE | Correct params |
| U-API-LIK-04 | `getReceivedLikes()` | Fetches with participant data + photos | Populated objects |
| U-API-LIK-05 | `getSentLikes()` | Fetches with participant data + photos | Populated objects |
| U-API-LIK-06 | `getSentLikeIds()` | Returns ID array only | String array |
| U-API-LIK-07 | `hasLiked()` | Boolean check by target ID | `true` / `false` |
| U-API-LIK-08 | `markLikeSeen()` | Marks single like as seen | `true` on success |
| U-API-LIK-09 | `markAllLikesSeen()` | Marks all as seen | `true` on success |
| U-API-LIK-10 | `getUnseenLikes()` | Returns unseen count/list | Correct count |

#### 2.14.7 `api/matches.ts` (1 function)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-MAT-01 | `getMatches()` | Self-join query for reciprocal likes | Returns `MatchEntry[]` |
| U-API-MAT-02 | `getMatches()` | No matches → empty array | `[]` |

#### 2.14.8 `api/conversations.ts` (8 functions)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-CNV-01 | `getOrCreateConversation()` | Existing conversation → returns it | Existing ID |
| U-API-CNV-02 | `getOrCreateConversation()` | New → creates and returns | New ID |
| U-API-CNV-03 | `getConversations()` | Fetches with other participant + photos | Populated list |
| U-API-CNV-04 | `getMessages()` | Fetches messages for conversation | Ordered by `created_at` |
| U-API-CNV-05 | `getMessagesBefore()` | Pagination - messages before cursor | Older messages only |
| U-API-CNV-06 | `sendMessage()` | Sends text message | Returns message object |
| U-API-CNV-07 | `deleteMessage()` | Soft-deletes message | `is_deleted: true` |
| U-API-CNV-08 | `uploadChatImage()` | Uploads + sends image message | Returns message with `media_path` |
| U-API-CNV-09 | `markConversationRead()` | Updates `last_read_at` | `true` on success |
| U-API-CNV-10 | `getUnreadConversations()` | Returns conversations with unread messages | Correct list |

#### 2.14.9 `api/blocks.ts` (1 function)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-BLK-01 | `blockParticipant()` | Sends POST to blocks endpoint | Correct body |
| U-API-BLK-02 | `blockParticipant()` | Returns `true` on success | Boolean |

#### 2.14.10 `api/grid.ts` (1 function)

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-API-GRD-01 | `getGridParticipants()` | Fetches filtered participants (excludes blocked, includes cross-attraction) | Correct filtering |
| U-API-GRD-02 | `getGridParticipants()` | Excludes self | Own ID not in results |
| U-API-GRD-03 | `getGridParticipants()` | Excludes blocked users | Blocked IDs not in results |

---

### 2.15 Components - Render & Behavior Tests

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| U-CMP-01 | `LoadingSpinner` | Renders spinner element | SVG/animation visible |
| U-CMP-02 | `Toast` | Shows message from store | Text visible |
| U-CMP-03 | `Toast` | Hides when no message | Not in DOM |
| U-CMP-04 | `ErrorBoundary` | Catches child error | Fallback UI shown |
| U-CMP-05 | `ErrorBoundary` | No error → renders children | Children visible |
| U-CMP-06 | `NetworkStatus` | Online → no banner | Banner hidden |
| U-CMP-07 | `NetworkStatus` | Offline → shows banner | "אין חיבור" visible |
| U-CMP-08 | `LegalPageLayout` | Renders title + children | Title + content visible |
| U-CMP-09 | `Icons` | Each icon renders SVG | 10 SVGs render without error |
| U-CMP-10 | `BlockConfirmDialog` | Renders with participant name | Name visible in dialog |
| U-CMP-11 | `BlockConfirmDialog` | Confirm button calls handler | `onConfirm` called |
| U-CMP-12 | `BlockConfirmDialog` | Cancel button calls handler | `onCancel` called |
| U-CMP-13 | `MatchPopup` | Shows matched participant name + photo | Both visible |
| U-CMP-14 | `MatchPopup` | "שלח/י הודעה" button navigates to chat | Router push called |
| U-CMP-15 | `MatchPopup` | Dismiss clears pending match | `clearPendingMatch()` called |
| U-CMP-16 | `Skeletons` | Each skeleton variant renders | No errors |
| U-CMP-17 | `TabBar` | Renders 4 tabs (grid, likes, chats, profile) | All visible |
| U-CMP-18 | `TabBar` | Active tab highlighted | Correct class applied |
| U-CMP-19 | `TabBar` | Badge shows unread counts | Badge numbers match store |
| U-CMP-20 | `AppHeader` | Renders event name | Text visible |
| U-CMP-21 | `MobileGuard` | Desktop viewport → block message | "Desktop not supported" shown |
| U-CMP-22 | `MobileGuard` | Mobile viewport → renders children | Children visible |
| U-CMP-23 | `ImageCropper` | Renders crop area | Crop tool visible |
| U-CMP-24 | `ImageCropper` | Outputs cropped file on confirm | `onCropComplete` receives `File` |
| U-CMP-25 | `EventBackground` | No background → gradient | Default gradient applied |
| U-CMP-26 | `EventBackground` | Background URL → image | CSS background-image set |
| U-CMP-27 | `SessionProvider` | Hydrates from localStorage | `setSession()` called with stored data |
| U-CMP-28 | `SessionProvider` | No stored session → redirects to join | Router push to join page |
| U-CMP-29 | `HeartbeatPinger` | Sends heartbeat every 60s | Fetch called periodically |
| U-CMP-30 | `RealtimeNotificationListener` | Subscribes to Realtime channels | `subscribe()` called |
| U-CMP-31 | `RealtimeNotificationListener` | Like event → incrementLikes + grid highlight | Store updated |
| U-CMP-32 | `RealtimeNotificationListener` | Message event → addUnreadConvo | Store updated |
| U-CMP-33 | `RealtimeNotificationListener` | Polling fallback every 15s | Fetch called at interval |

### 2.16 Hooks - Custom Hook Tests

| ID | Hook | Test | Expected |
|----|------|------|----------|
| U-HK-01 | `useAppResume` | Fires callback on `visibilitychange` (hidden → visible) | Callback called |
| U-HK-02 | `useAppResume` | Does NOT fire when tab hidden | Callback not called |
| U-HK-03 | `useAppResume` | Cleans up event listener on unmount | No leak |
| U-HK-04 | `useRealtimeHub` | Subscribes on mount | `subscribe()` called |
| U-HK-05 | `useRealtimeHub` | Unsubscribes on unmount | Cleanup function called |
| U-HK-06 | `useRealtimeHub` | Re-subscribes on channel key change | Old unsub + new sub |

### 2.17 `lib/realtimeHub.ts` - Singleton Channel Manager

| ID | Function | Test | Expected |
|----|----------|------|----------|
| U-RTH-HUB-01 | `subscribe()` | First subscriber → creates channel | Channel created + subscribed |
| U-RTH-HUB-02 | `subscribe()` | Second subscriber to same channel → reuses | refCount = 2, no new channel |
| U-RTH-HUB-03 | `subscribe()` | Unsubscribe last ref → removes channel | Channel removed |
| U-RTH-HUB-04 | `subscribe()` | Unsubscribe one of two → keeps channel | refCount = 1 |
| U-RTH-HUB-05 | `isSubscribed()` | Returns true for active channel | `true` |
| U-RTH-HUB-06 | `isSubscribed()` | Returns false for unknown channel | `false` |
| U-RTH-HUB-07 | `getStatus()` | Returns all channels with refCounts | Correct map |
| U-RTH-HUB-08 | Auto-reconnect | Simulated disconnect → reconnects | Channel re-established |

---

### 2.18 Dating Page Components

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| U-DAT-01 | `DemoPhone` | Renders phone mockup | Phone frame visible |
| U-DAT-02 | `OrderForm` | Validates required fields | Shows errors on empty submit |
| U-DAT-03 | `OrderForm` | Valid submission → sends email | Fetch called with form data |
| U-DAT-04 | `SwipeCard` | Renders participant photo + name | Both visible |
| U-DAT-05 | `SwipeCard` | Swipe right → like animation | Animation triggered |
| U-DAT-06 | `SwipeCard` | Swipe left → dismiss animation | Animation triggered |
| U-DAT-07 | `SwipeView` | Shows cards from grid store (minus dismissed/liked) | Filtered list |
| U-DAT-08 | `SwipeView` | Empty pool → reset prompt | "אין עוד אנשים" visible |
| U-DAT-09 | `ProfilePhotoGrid` | Renders photos in grid | All photos visible |
| U-DAT-10 | `ProfilePhotoGrid` | Shows add button when < MAX_PHOTOS | Button visible |
| U-DAT-11 | `ProfilePhotoGrid` | Drag reorder fires callback | `onReorder` called |
| U-DAT-12 | `DeleteAccountDialog` | Confirm triggers delete | `deleteAccount()` called |
| U-DAT-13 | `ChatHeader` | Shows other participant name + photo | Both visible |
| U-DAT-14 | `ChatInputBar` | Text input + send button | Both functional |
| U-DAT-15 | `ChatInputBar` | Image attachment triggers upload flow | File picker opened |
| U-DAT-16 | `MessageBubble` | Own message → right-aligned | Correct class |
| U-DAT-17 | `MessageBubble` | Other's message → left-aligned | Correct class |
| U-DAT-18 | `MessageBubble` | Deleted message → placeholder | "ההודעה נמחקה" visible |
| U-DAT-19 | `MessageBubble` | Image message → shows image | `<img>` tag present |
| U-DAT-20 | Chat `BlockConfirmDialog` | Block from chat → removes conversation | `removeConversation()` called |

---

## 3. Integration Tests

> Integration tests call API route handlers directly (using `NextRequest`) with mocked Supabase and verify the full request→response pipeline including guards, validation, DB calls, and response shape.

### 3.1 `POST /api/auth/join` - Join Event (247 lines)

| ID | Test | Expected |
|----|------|----------|
| I-JOIN-01 | Valid join code + slug → new participant created | 200 + session cookie + participant data |
| I-JOIN-02 | Missing `slug` or `joinCode` | 400 validation error |
| I-JOIN-03 | Invalid join code format | 400 error |
| I-JOIN-04 | Event not found (wrong slug) | 404 error |
| I-JOIN-05 | Event not active (ended/paused/archived/draft) | 403 with status info |
| I-JOIN-06 | Wrong join code for event | 403 "Invalid join code" |
| I-JOIN-07 | Returning user - fingerprint match → reconnects | 200 + existing participant data |
| I-JOIN-08 | Hardware fingerprint match → reconnects | 200 + existing data |
| I-JOIN-09 | Device fingerprint match → reconnects | 200 + existing data |
| I-JOIN-10 | Banned device fingerprint → rejected | 403 "banned" |
| I-JOIN-11 | Banned hardware fingerprint → rejected | 403 "banned" |
| I-JOIN-12 | Rate limited | 429 |
| I-JOIN-13 | Body too large | 413 |
| I-JOIN-14 | Sets `ws_session` cookie with correct attributes | `HttpOnly`, `Secure`, `SameSite=Lax`, correct `Max-Age` |
| I-JOIN-15 | Concurrent join attempts → no duplicate participants | Only 1 participant created |

### 3.2 `POST /api/auth/verify` - Verify Session (107 lines)

| ID | Test | Expected |
|----|------|----------|
| I-VER-01 | Valid session + active event + not banned | 200 + participant data + event data |
| I-VER-02 | No session cookie | 401 |
| I-VER-03 | Expired session | 401 |
| I-VER-04 | Participant banned since last verify | 403 "banned" |
| I-VER-05 | Event ended since last verify | 200 but with event status |
| I-VER-06 | Rate limited | 429 |

### 3.3 `GET /api/health` - Health Check

| ID | Test | Expected |
|----|------|----------|
| I-HLT-01 | Returns 200 with status | `{ status: 'ok' }` |
| I-HLT-02 | Rate limited | 429 |
| I-HLT-03 | Cached for 5s | Second call within 5s returns same |

### 3.4 `POST /api/order` - Order Form

| ID | Test | Expected |
|----|------|----------|
| I-ORD-01 | Valid order data → sends email | 200 |
| I-ORD-02 | Missing required fields | 400 with field errors |
| I-ORD-03 | `name` > `ORDER_NAME_MAX_LENGTH` | 400 |
| I-ORD-04 | `email` > `ORDER_EMAIL_MAX_LENGTH` | 400 |
| I-ORD-05 | `phone` > `ORDER_PHONE_MAX_LENGTH` | 400 |
| I-ORD-06 | Invalid email format | 400 |
| I-ORD-07 | XSS in fields → HTML-escaped in email body | Sanitized output |
| I-ORD-08 | Nodemailer failure → 500 | Error response |
| I-ORD-09 | Rate limited | 429 |

### 3.5 `DELETE /api/account/delete` - Account Deletion (159 lines)

| ID | Test | Expected |
|----|------|----------|
| I-DEL-01 | Valid session → cascade deletes all user data | 200 + cookie cleared |
| I-DEL-02 | Deletes photos from storage | Storage `remove()` called |
| I-DEL-03 | Deletes likes (sent + received) | DB rows gone |
| I-DEL-04 | Deletes messages | DB rows gone |
| I-DEL-05 | Deletes conversations | DB rows gone |
| I-DEL-06 | Deletes blocks | DB rows gone |
| I-DEL-07 | Deletes notifications | DB rows gone |
| I-DEL-08 | Cleans up `banned_devices` entries | Entries removed |
| I-DEL-09 | No session → 401 | Error |
| I-DEL-10 | Missing CSRF → 403 | Error |
| I-DEL-11 | Clears session cookie in response | `ws_session` cookie expired |

### 3.6 `PATCH /api/secure/profile` - Profile Update

| ID | Test | Expected |
|----|------|----------|
| I-PRF-01 | Valid partial update → success | 200 + updated fields |
| I-PRF-02 | `display_name` sanitized | XSS stripped |
| I-PRF-03 | `bio` sanitized | XSS stripped |
| I-PRF-04 | `city` sanitized | XSS stripped |
| I-PRF-05 | Invalid gender value | 400 |
| I-PRF-06 | Age out of range | 400 |
| I-PRF-07 | No session → 401 | Error |
| I-PRF-08 | No CSRF → 403 | Error |
| I-PRF-09 | Banned user → 403 | Error |
| I-PRF-10 | Event not active → 403 | Error |

### 3.7 `POST /api/secure/messages` - Send Message (205 lines)

| ID | Test | Expected |
|----|------|----------|
| I-MSG-01 | Valid text message → success | 200 + message object |
| I-MSG-02 | Text > `MAX_MESSAGE_LENGTH` | 400 |
| I-MSG-03 | Empty text | 400 |
| I-MSG-04 | Text sanitized (XSS) | Script tags stripped |
| I-MSG-05 | Image message with valid `media_path` | 200 |
| I-MSG-06 | Image message with path traversal in `media_path` | 400 (isSafePath check) |
| I-MSG-07 | Recipient is blocked → rejected | 403 |
| I-MSG-08 | Sender is blocked by recipient → rejected | 403 |
| I-MSG-09 | Conversation doesn't exist | 404 |
| I-MSG-10 | Not a participant in conversation | 403 |
| I-MSG-11 | No session → 401 | Error |
| I-MSG-12 | No CSRF → 403 | Error |

### 3.8 `PATCH /api/secure/messages` - Delete Message

| ID | Test | Expected |
|----|------|----------|
| I-MSG-DEL-01 | Own message → soft delete | `is_deleted: true` |
| I-MSG-DEL-02 | Other's message → 403 | Error |
| I-MSG-DEL-03 | Already deleted message → idempotent | Still 200 |
| I-MSG-DEL-04 | Non-existent message | 404 |

### 3.9 `POST /api/secure/photos` - Upload Photo

| ID | Test | Expected |
|----|------|----------|
| I-PHO-01 | Valid JPEG upload → success | 200 + photo record |
| I-PHO-02 | Valid PNG upload | 200 |
| I-PHO-03 | Valid WebP upload | 200 |
| I-PHO-04 | GIF upload → rejected | 400 |
| I-PHO-05 | Non-image file → rejected | 400 |
| I-PHO-06 | File > 10MB → rejected | 400 |
| I-PHO-07 | Magic bytes mismatch (fake MIME) → rejected | 400 |
| I-PHO-08 | Already at `MAX_PHOTOS` → rejected | 400 "Max photos reached" |
| I-PHO-09 | Assigns correct `order_index` | Sequential from existing |
| I-PHO-10 | Ownership - photo linked to session participant | `participant_id` matches |
| I-PHO-11 | No session → 401 | Error |

### 3.10 `DELETE /api/secure/photos` - Delete Photo

| ID | Test | Expected |
|----|------|----------|
| I-PHO-DEL-01 | Own photo → deletes from DB + storage | Both removed |
| I-PHO-DEL-02 | Other's photo → 403 | Error |
| I-PHO-DEL-03 | Non-existent photo | 404 |

### 3.11 `PATCH /api/secure/photos` - Reorder Photos

| ID | Test | Expected |
|----|------|----------|
| I-PHO-RO-01 | Valid reorder array → updates `order_index` | Indices updated |
| I-PHO-RO-02 | IDs not owned by user → 403 | Error |
| I-PHO-RO-03 | Duplicate indices | 400 |

### 3.12 `POST /api/secure/upload-url` - Signed Upload URL

| ID | Test | Expected |
|----|------|----------|
| I-SGN-01 | Valid request → returns signed URL | URL + path |
| I-SGN-02 | Path scope validation - must be in user's directory | Path starts with correct prefix |
| I-SGN-03 | Path traversal attempt | Rejected |
| I-SGN-04 | No session → 401 | Error |

### 3.13 `POST /api/secure/blocks` - Block User (145 lines)

| ID | Test | Expected |
|----|------|----------|
| I-BLK-01 | Valid block → cascade operations | 200 |
| I-BLK-02 | Cascade: removes likes (both directions) | Likes deleted |
| I-BLK-03 | Cascade: removes notifications | Notifications deleted |
| I-BLK-04 | Cascade: soft-deletes messages | Messages marked deleted |
| I-BLK-05 | Cascade: removes conversations | Conversations deleted |
| I-BLK-06 | Cascade: removes storage (photos in conversations) | Storage cleaned |
| I-BLK-07 | Block self → rejected | 400 |
| I-BLK-08 | Block non-existent user → error | 404 |
| I-BLK-09 | Block already-blocked user → idempotent | 200 (no duplicate) |
| I-BLK-10 | No session → 401 | Error |

### 3.14 `POST /api/secure/heartbeat` - Heartbeat

| ID | Test | Expected |
|----|------|----------|
| I-HRT-01 | Updates `last_seen_at` | DB field updated |
| I-HRT-02 | Throttled - 2-min stale threshold | Second call within 2 min → no DB write |
| I-HRT-03 | Call after 2 min → updates | DB write occurs |
| I-HRT-04 | No session → 401 | Error |

### 3.15 `POST /api/secure/likes` - Send Like

| ID | Test | Expected |
|----|------|----------|
| I-LIK-01 | Valid like → success | 200 + like record |
| I-LIK-02 | Reciprocal like → match detected | Response includes `match: true` |
| I-LIK-03 | Like blocked user → rejected | 403 |
| I-LIK-04 | Like self → rejected | 400 |
| I-LIK-05 | Duplicate like → idempotent | 200 (no error, no duplicate row) |
| I-LIK-06 | Creates notification for recipient | Notification row created |
| I-LIK-07 | No session → 401 | Error |

### 3.16 `DELETE /api/secure/likes` - Remove Like

| ID | Test | Expected |
|----|------|----------|
| I-LIK-DEL-01 | Existing like → deleted | 200 |
| I-LIK-DEL-02 | Non-existent like → idempotent | 200 |
| I-LIK-DEL-03 | No session → 401 | Error |

### 3.17 `POST /api/secure/likes/seen` - Mark Like Seen

| ID | Test | Expected |
|----|------|----------|
| I-LIK-SEEN-01 | Valid `from_participant_id` → marks seen | `seen_at` set |
| I-LIK-SEEN-02 | Invalid UUID | 400 |
| I-LIK-SEEN-03 | No session → 401 | Error |

### 3.18 `POST /api/secure/conversations` - Get or Create Conversation

| ID | Test | Expected |
|----|------|----------|
| I-CNV-01 | Existing conversation → returns it | Existing ID |
| I-CNV-02 | New → creates conversation | New ID |
| I-CNV-03 | Blocked user → rejected | 403 |
| I-CNV-04 | Self → rejected | 400 |
| I-CNV-05 | Race condition - concurrent creates → single conversation | Only 1 row |
| I-CNV-06 | No session → 401 | Error |

### 3.19 `POST /api/secure/conversations/read` - Mark Conversation Read

| ID | Test | Expected |
|----|------|----------|
| I-CNV-RD-01 | Participant A reads → `a_last_read_at` updated | Timestamp set |
| I-CNV-RD-02 | Participant B reads → `b_last_read_at` updated | Timestamp set |
| I-CNV-RD-03 | Not a participant → 403 | Error |
| I-CNV-RD-04 | No session → 401 | Error |

### 3.20 `POST /api/admin/login` - Admin Login

| ID | Test | Expected |
|----|------|----------|
| I-ADM-LGN-01 | Correct password → 200 + `ws_admin` cookie | Cookie set |
| I-ADM-LGN-02 | Wrong password → 401 | Error |
| I-ADM-LGN-03 | Missing password → 400 | Validation error |
| I-ADM-LGN-04 | Brute-force - 5 wrong attempts → lockout | 429 "locked" |
| I-ADM-LGN-05 | Timing-safe comparison | No timing leak between short vs. long passwords |
| I-ADM-LGN-06 | Rate limited | 429 |

### 3.21 `POST /api/admin/logout` - Admin Logout

| ID | Test | Expected |
|----|------|----------|
| I-ADM-LGT-01 | Clears `ws_admin` cookie | Cookie expired |
| I-ADM-LGT-02 | Succeeds even without cookie | 200 |

### 3.22 `GET /api/admin/events` - List Events

| ID | Test | Expected |
|----|------|----------|
| I-ADM-EVT-01 | Authenticated → returns event list | 200 + array |
| I-ADM-EVT-02 | Search query → filtered results | Matching events only |
| I-ADM-EVT-03 | Search injection (`'; DROP TABLE`) → safe | No SQL injection |
| I-ADM-EVT-04 | Not authenticated → 401 | Error |

### 3.23 `POST /api/admin/events` - Create Event

| ID | Test | Expected |
|----|------|----------|
| I-ADM-EVT-CR-01 | Valid data → creates event | 201 + event with join code |
| I-ADM-EVT-CR-02 | Missing required fields | 400 |
| I-ADM-EVT-CR-03 | Duplicate title → allowed (no unique constraint) | 201 |
| I-ADM-EVT-CR-04 | Generated join code is unique | 6-char alphanumeric |
| I-ADM-EVT-CR-05 | Not authenticated → 401 | Error |
| I-ADM-EVT-CR-06 | CSRF check for cookie auth | 403 without CSRF |

### 3.24 `PATCH /api/admin/events/[eventId]` - Update Event

| ID | Test | Expected |
|----|------|----------|
| I-ADM-EVT-UP-01 | Valid partial update → 200 | Updated fields |
| I-ADM-EVT-UP-02 | Invalid event ID → 404 | Error |
| I-ADM-EVT-UP-03 | Invalid status value → 400 | Error |
| I-ADM-EVT-UP-04 | Not authenticated → 401 | Error |

### 3.25 `GET /api/admin/events/[eventId]/stats` - Event Quick Stats

| ID | Test | Expected |
|----|------|----------|
| I-ADM-STA-01 | Returns 5 parallel counts | participants, likes, matches, conversations, messages |
| I-ADM-STA-02 | Invalid event ID → 400 | Error |
| I-ADM-STA-03 | Not authenticated → 401 | Error |

### 3.26 `GET /api/admin/events/[eventId]/participants` - List Participants

| ID | Test | Expected |
|----|------|----------|
| I-ADM-PRT-01 | Returns participant list | 200 + array with photos |
| I-ADM-PRT-02 | Invalid event ID → 400 | Error |
| I-ADM-PRT-03 | Not authenticated → 401 | Error |

### 3.27 `PATCH /api/admin/events/[eventId]/participants` - Ban/Unban

| ID | Test | Expected |
|----|------|----------|
| I-ADM-BAN-01 | Ban participant → `is_banned: true` | Updated |
| I-ADM-BAN-02 | Ban adds device to `banned_devices` | Row(s) created |
| I-ADM-BAN-03 | Unban participant → `is_banned: false` | Updated |
| I-ADM-BAN-04 | Unban removes from `banned_devices` | Row(s) deleted |
| I-ADM-BAN-05 | Ban evicts ban cache | Cache entry removed |
| I-ADM-BAN-06 | Invalid participant ID → 404 | Error |
| I-ADM-BAN-07 | Not authenticated → 401 | Error |

### 3.28 `GET /api/admin/events/[eventId]/analytics` - Deep Event Analytics (684 lines)

| ID | Test | Expected |
|----|------|----------|
| I-ADM-ANA-01 | Returns 60+ metrics | All metric fields present |
| I-ADM-ANA-02 | Gender distribution correct | Sum matches total participants |
| I-ADM-ANA-03 | Activity timeline data shaped correctly | Array of `{ date, count }` |
| I-ADM-ANA-04 | Match rate calculation correct | `matches / totalLikes` ratio |
| I-ADM-ANA-05 | Invalid event ID → 400 | Error |
| I-ADM-ANA-06 | Not authenticated → 401 | Error |

### 3.29 `GET /api/admin/global-analytics` - Global Analytics (541 lines)

| ID | Test | Expected |
|----|------|----------|
| I-ADM-GA-01 | Returns global stats across all events | All fields present |
| I-ADM-GA-02 | Summed metrics consistent | Sums match individual event totals |
| I-ADM-GA-03 | Not authenticated → 401 | Error |
| I-ADM-GA-04 | Cron auth (Authorization header) → 200 | Works without cookie |

### 3.30 `DELETE /api/admin/events/[eventId]/delete` - Delete Event

| ID | Test | Expected |
|----|------|----------|
| I-ADM-DEL-01 | Cascade deletes all event data | All related rows removed |
| I-ADM-DEL-02 | Deletes storage (photos + backgrounds) | Storage `remove()` called |
| I-ADM-DEL-03 | Evicts event status cache | Cache cleared |
| I-ADM-DEL-04 | Non-existent event → 404 | Error |
| I-ADM-DEL-05 | Not authenticated → 401 | Error |

### 3.31 `POST /api/admin/events/[eventId]/archive` - Archive Event

| ID | Test | Expected |
|----|------|----------|
| I-ADM-ARC-01 | Snapshots analytics → purges data → marks archived | Status = `'archived'` |
| I-ADM-ARC-02 | Creates `event_analytics_snapshots` row | Snapshot row with metrics |
| I-ADM-ARC-03 | Purges participants, photos, conversations, messages, likes, blocks, notifications | All rows deleted |
| I-ADM-ARC-04 | Already archived → idempotent | 200 |
| I-ADM-ARC-05 | Not authenticated → 401 | Error |

### 3.32 `POST /api/admin/events/[eventId]/rotate` - Rotate Join Code

| ID | Test | Expected |
|----|------|----------|
| I-ADM-ROT-01 | Generates new join code | Different from previous |
| I-ADM-ROT-02 | New code format valid | 6-char alphanumeric |
| I-ADM-ROT-03 | Old code no longer works for joining | Join with old code → 403 |
| I-ADM-ROT-04 | Not authenticated → 401 | Error |

### 3.33 `POST /api/admin/events/[eventId]/background` - Upload Background

| ID | Test | Expected |
|----|------|----------|
| I-ADM-BG-01 | Valid JPEG upload → stores + updates event | 200 + URL |
| I-ADM-BG-02 | Valid PNG upload | 200 |
| I-ADM-BG-03 | Valid WebP upload | 200 |
| I-ADM-BG-04 | File > 5MB → rejected | 400 |
| I-ADM-BG-05 | Non-image MIME → rejected | 400 |
| I-ADM-BG-06 | Magic bytes mismatch → rejected | 400 |
| I-ADM-BG-07 | Overwrites previous background | Old file deleted |
| I-ADM-BG-08 | Cache-busting URL parameter | `?v=timestamp` appended |
| I-ADM-BG-09 | Not authenticated → 401 | Error |

### 3.34 `DELETE /api/admin/events/[eventId]/background` - Delete Background

| ID | Test | Expected |
|----|------|----------|
| I-ADM-BG-DEL-01 | Removes file from storage + clears DB field | Both done |
| I-ADM-BG-DEL-02 | No existing background → idempotent | 200 |
| I-ADM-BG-DEL-03 | Not authenticated → 401 | Error |

### 3.35 `POST /api/admin/auto-archive` - Auto-Archive Cron

| ID | Test | Expected |
|----|------|----------|
| I-ADM-AA-01 | Events ended > X days → auto-archived | Status changed |
| I-ADM-AA-02 | Active events → untouched | Status unchanged |
| I-ADM-AA-03 | Dry-run mode → reports but doesn't change | No DB mutations |
| I-ADM-AA-04 | Cron auth required | 401 without secret |
| I-ADM-AA-05 | Cookie auth also works | 200 |

### 3.36 `POST /api/cleanup` - Cleanup Cron (250 lines)

| ID | Test | Expected |
|----|------|----------|
| I-CLN-01 | Creates analytics snapshot for ended events | Snapshot rows created |
| I-CLN-02 | Purges storage for ended events older than `RETENTION_DAYS` | Storage files removed |
| I-CLN-03 | Cascade deletes participant data | All related rows removed |
| I-CLN-04 | Archives events after cleanup | Status = `'archived'` |
| I-CLN-05 | Skips active events | No changes |
| I-CLN-06 | Cron auth required | 401 without secret |
| I-CLN-07 | Handles storage batch size correctly | Batches of `STORAGE_BATCH_SIZE` |
| I-CLN-08 | Fire-and-forget failures don't crash | Continues to next event |

### 3.37 Admin `_helpers.ts` - Guard Functions

| ID | Function | Test | Expected |
|----|----------|------|----------|
| I-ADH-01 | `adminGuard()` - valid cookie | Returns parsed request body |
| I-ADH-02 | `adminGuard()` - invalid cookie | 401 error |
| I-ADH-03 | `adminGuard()` - cron secret auth | Returns body (no CSRF required) |
| I-ADH-04 | `adminGuard()` - cookie auth without CSRF | 403 error |
| I-ADH-05 | `adminGuard()` - body > `ADMIN_MAX_BODY_BYTES` | 413 error |
| I-ADH-06 | `adminGuard()` - rate limited | 429 error |
| I-ADH-07 | `validateEventId()` - valid UUID | Returns UUID |
| I-ADH-08 | `validateEventId()` - invalid UUID | Returns error response |
| I-ADH-09 | `hasCronAuth()` - correct secret hash | Returns `true` |
| I-ADH-10 | `hasCronAuth()` - wrong secret | Returns `false` |
| I-ADH-11 | `hasCronAuth()` - timing-safe comparison | Constant-time (verify with mock) |

### 3.38 Security Cross-Cutting Tests

| ID | Test | Expected |
|----|------|----------|
| I-SEC-01 | All `/api/secure/*` routes reject missing session | 401 |
| I-SEC-02 | All `/api/secure/*` routes reject missing CSRF | 403 |
| I-SEC-03 | All `/api/secure/*` routes reject banned users | 403 |
| I-SEC-04 | All `/api/secure/*` routes reject inactive events | 403 |
| I-SEC-05 | All `/api/admin/*` routes reject unauthenticated | 401 |
| I-SEC-06 | Response headers include security headers | `X-Content-Type-Options`, `X-Frame-Options`, etc. |
| I-SEC-07 | CORS - non-allowed origins rejected | No `Access-Control-Allow-Origin` |
| I-SEC-08 | JSON responses never leak stack traces | No `stack` field in error responses |
| I-SEC-09 | All mutation endpoints check CSRF | 403 without |
| I-SEC-10 | 13-digit body size limits enforced | 413 on oversized bodies |

---

## 4. E2E Tests

> Playwright tests running against a local dev server with a seeded test database.

### 4.1 Landing & Static Pages

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-LP-01 | Landing page loads | Navigate to `/` | Hero section visible, CTA button present |
| E-LP-02 | Order form | Navigate to `/` → fill form → submit | Success toast, email sent |
| E-LP-04 | FAQ page | Navigate to `/faq` | Questions visible |
| E-LP-05 | Privacy page | Navigate to `/privacy` | Legal text renders |
| E-LP-06 | Terms page | Navigate to `/terms` | Legal text renders |
| E-LP-07 | Cookies page | Navigate to `/cookies` | Policy renders |
| E-LP-10 | 404 page | Navigate to `/nonexistent` | Custom 404 shown |
| E-LP-11 | Sitemap | Fetch `/sitemap.xml` | Valid XML with all routes |

### 4.2 Join Event Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-JN-01 | Successful join | Navigate to `/dating/[slug]/join` → enter code → submit | Redirected to setup page |
| E-JN-02 | Wrong join code | Enter wrong code → submit | Error message shown |
| E-JN-03 | Non-existent event | Navigate to wrong slug | Error / redirect |
| E-JN-04 | Ended event | Try to join ended event | "Event ended" message |
| E-JN-05 | Already joined (returning user) | Join again with same device | Redirected to grid (reconnected) |

### 4.3 Profile Setup Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-PS-01 | Complete setup | Fill name, gender, age, attracted_to, looking_for + photo → submit | Redirected to grid |
| E-PS-02 | Missing required fields | Submit without name | Validation errors shown |
| E-PS-03 | Photo upload | Select + crop photo | Photo preview shown |
| E-PS-04 | Multiple photos | Upload 3 photos | All 3 in grid |
| E-PS-05 | Bio + city optional | Submit without bio/city | Succeeds |
| E-PS-06 | Max name length | Type 31 chars | Input limited to 30 |
| E-PS-07 | Hebrew text | Enter Hebrew name + bio | Renders correctly RTL |

### 4.4 Grid Page Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-GR-01 | Grid loads | Navigate to grid | Participant cards visible |
| E-GR-02 | Filter by gender | Tap "men" / "women" / "all" | Grid filtered |
| E-GR-03 | Search | Type in search field | Results filtered by name |
| E-GR-04 | Tap card → profile | Tap a participant | Navigated to profile view |
| E-GR-05 | Swipe mode toggle | Toggle to swipe view | Swipe cards appear |
| E-GR-06 | Grid highlight | Receive like → highlight on card | Yellow/green ring visible |
| E-GR-07 | Empty grid | No participants (new event) | "אין משתתפים" message |
| E-GR-08 | Grid excludes blocked | Block user → return to grid | User not visible |
| E-GR-09 | Grid excludes self | Own card not in grid | Not visible |

### 4.5 Swipe Mode Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-SW-01 | Swipe right → like | Swipe card right | Like animation + API call |
| E-SW-02 | Swipe left → dismiss | Swipe card left | Dismiss animation |
| E-SW-03 | Swipe right on mutual like → match | Both users like each other | Match popup appears |
| E-SW-04 | Empty pool | Swipe through all cards | "אין עוד אנשים" + reset button |
| E-SW-05 | Reset pool | Tap reset → dismissed cards return | Cards reappear (liked stay liked) |
| E-SW-06 | Return to grid mode | Toggle back to grid | Grid view restored |

### 4.6 View Profile Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-VP-01 | View profile | Tap card → profile page | Name, age, bio, city, photos visible |
| E-VP-02 | Like from profile | Tap like button | Like sent + button state changes |
| E-VP-03 | Unlike from profile | Tap unlike button | Like removed |
| E-VP-04 | Block from profile | Tap block → confirm dialog → confirm | User blocked + redirected to grid |
| E-VP-05 | Photo gallery | Tap photos to browse | Carousel/gallery navigation works |
| E-VP-06 | Send message button (matched) | View matched user → tap message | Navigated to chat |

### 4.7 Likes Page Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-LK-01 | Received likes tab | Navigate to likes page | Received likes visible |
| E-LK-02 | Sent likes tab | Switch to sent tab | Sent likes visible |
| E-LK-03 | Matches tab | Switch to matches tab | Mutual matches listed |
| E-LK-04 | Tap received like → profile | Tap a like | Navigate to profile |
| E-LK-05 | Mark like as seen | Open likes page | Unseen likes marked as seen |
| E-LK-06 | Like badge clears | View all likes | Tab badge → 0 |
| E-LK-07 | Remove sent like | Tap unlike on sent like | Like removed |

### 4.8 Chat Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-CH-01 | Chat list | Navigate to chats | Conversations listed |
| E-CH-02 | Chat list sorted | Most recent on top | Correct order |
| E-CH-03 | Unread badge | New message from other user | Badge count on tab |
| E-CH-04 | Open chat | Tap conversation | Messages loaded |
| E-CH-05 | Send text message | Type + send | Message appears in thread |
| E-CH-06 | Receive message (realtime) | Other user sends | Message appears without refresh |
| E-CH-07 | Send image | Attach image → send | Image message appears |
| E-CH-08 | Delete own message | Long press → delete | "ההודעה נמחקה" shown |
| E-CH-09 | Scroll to load older | Scroll up | Older messages loaded |
| E-CH-10 | Mark as read | Open conversation | Unread count clears |
| E-CH-11 | Block from chat | Tap block button → confirm | User blocked, conversation removed |
| E-CH-12 | Empty chats | No conversations yet | "אין שיחות" message |

### 4.9 Profile Edit Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-PE-01 | Edit profile page | Navigate to profile tab | Current data shown in form |
| E-PE-02 | Update name | Change name → save | Name updated on grid |
| E-PE-03 | Update bio | Change bio → save | Bio updated |
| E-PE-04 | Update age | Change age → save | Age updated |
| E-PE-05 | Add photo | Upload new photo | Photo added to grid |
| E-PE-06 | Delete photo | Remove photo | Photo gone |
| E-PE-07 | Reorder photos | Drag photo to new position | Order persisted |
| E-PE-08 | Crop photo | Upload → crop → save | Cropped version stored |
| E-PE-09 | Max photos | Try to upload 11th photo | Error message |
| E-PE-10 | Delete account | Tap delete → confirm | Account deleted, redirected to join |

### 4.10 Block Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-BL-01 | Block from profile | Block user → confirm | Grid/likes/chats cleaned up |
| E-BL-02 | Block from chat | Block from chat header | Conversation removed |
| E-BL-03 | Blocked user can't see blocker | Log in as blocked user | Blocker not in grid |
| E-BL-04 | Blocked user can't send message | Try to message blocker | Error / conversation gone |
| E-BL-05 | Blocked user can't like | Try to like blocker | Error |

### 4.11 Match Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-MA-01 | Match popup (self-initiated) | Like → other already liked you | Match popup appears |
| E-MA-02 | Match popup (other-initiated) | Other user likes → you already liked them | Match popup via realtime |
| E-MA-03 | Match popup → send message | Tap "שלח/י הודעה" | Navigate to chat, popup dismissed |
| E-MA-04 | Match popup → dismiss | Tap dismiss | Popup closes, match in list |
| E-MA-05 | Match appears in likes page | After match | Visible in matches tab |

### 4.12 Banned User Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-BN-01 | Banned → banned page | Admin bans user → user refreshes | Redirected to `/dating/[slug]/banned` |
| E-BN-02 | Banned → can't rejoin | Try to join with same device | Rejected |
| E-BN-03 | Banned crosses browsers | Same hardware fingerprint on different browser | Also blocked |

### 4.13 Event Unavailable Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-EU-01 | Event ended | Admin ends event → user navigates | Unavailable page shown |
| E-EU-02 | Event paused | Admin pauses | Appropriate message |
| E-EU-03 | Event archived | Event archived | Unavailable page |

### 4.14 Admin - Login Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-AD-LGN-01 | Login | Navigate to `/admin` → enter password → submit | Dashboard shown |
| E-AD-LGN-02 | Wrong password | Enter wrong password | Error message |
| E-AD-LGN-03 | Brute-force lockout | 5 wrong attempts | Locked out message |
| E-AD-LGN-04 | Logout | Click logout | Redirected to login |
| E-AD-LGN-05 | Session expiry | Wait > 24h (mock) | Redirected to login |

### 4.15 Admin - Event Management Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-AD-EVT-01 | Create event | Fill form → submit | Event in list with join code |
| E-AD-EVT-02 | Edit event | Click event → edit fields → save | Changes reflected |
| E-AD-EVT-03 | Change status | Set status to `ended` | Status badge updated |
| E-AD-EVT-04 | Rotate join code | Click rotate → confirm | New code shown |
| E-AD-EVT-05 | Upload background | Upload image | Preview shown |
| E-AD-EVT-06 | Delete background | Click delete | Default gradient restored |
| E-AD-EVT-07 | Delete event | Click delete → confirm | Event removed from list |
| E-AD-EVT-08 | Archive event | Click archive → confirm | Status = archived, data purged |
| E-AD-EVT-09 | Search events | Type in search | Results filtered |
| E-AD-EVT-10 | Empty state | No events | "אין אירועים" message |

### 4.16 Admin - Participant Management Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-AD-PRT-01 | View participants | Select event → participants tab | List of participants |
| E-AD-PRT-02 | Ban participant | Click ban → confirm | Badge shows banned |
| E-AD-PRT-03 | Unban participant | Click unban → confirm | Badge removed |
| E-AD-PRT-04 | View participant details | Click participant | Full profile visible |

### 4.17 Admin - Analytics Flow

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| E-AD-ANA-01 | Event analytics | Select event → analytics tab | Charts + metrics shown |
| E-AD-ANA-02 | Global analytics | Navigate to global analytics | Cross-event metrics shown |
| E-AD-ANA-03 | Charts render | Analytics page loaded | Recharts SVGs visible |
| E-AD-ANA-04 | QR code | Event page shows QR | QR code scannable |

### 4.18 PWA & Service Worker

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-PWA-01 | Install prompt | Mobile Chrome → "Add to Home Screen" | Prompt appears |
| E-PWA-02 | Manifest | Fetch `/manifest.json` | Valid JSON with icons, name, colors |
| E-PWA-03 | Offline fallback | Go offline → navigate | Cached page or offline message |
| E-PWA-04 | Service worker registered | Load app | SW active in DevTools |

### 4.19 Mobile & Responsive

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-MOB-01 | Mobile viewport | 375×812 (iPhone) | All elements visible, no overflow |
| E-MOB-02 | Android viewport | 360×780 | All elements visible |
| E-MOB-03 | OLED dark theme | Dark background, light text | Sufficient contrast ratios |
| E-MOB-04 | Desktop guard | 1024×768 viewport | "Desktop not supported" message |
| E-MOB-05 | Touch gestures | Swipe cards on touch | Swipe works |
| E-MOB-06 | Tab bar | All 4 tabs | Tappable, correct navigation |

### 4.20 Realtime & Notifications

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-RT-01 | Like notification | User A likes User B | B sees grid highlight + badge |
| E-RT-02 | Message notification | User A messages User B | B sees chats badge increment |
| E-RT-03 | Match realtime | User A likes User B (mutual) | B sees match popup |
| E-RT-04 | Polling fallback | Block WebSocket → wait 15s | Data still refreshes |
| E-RT-05 | Reconnect | Simulate disconnect + reconnect | Channel re-established |

### 4.21 Error Handling

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-ERR-01 | Network error | Simulate fetch failure | Toast with error message |
| E-ERR-02 | Server 500 | Mock 500 response | Error boundary / toast |
| E-ERR-03 | Session expired mid-use | Expire cookie → perform action | Redirected to join |
| E-ERR-04 | Image upload failure | Mock storage failure | Error toast |
| E-ERR-05 | Rate limited | Rapid-fire actions | 429 handled gracefully with message |

### 4.22 Account Deletion & Re-registration

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-ACCT-01 | Delete + rejoin | Delete account → rejoin same event | Fresh participant, no old data |
| E-ACCT-02 | Delete cascade | Delete account → check DB | All photos, likes, messages, convos gone |
| E-ACCT-03 | Delete clears client state | Delete → check stores | All stores reset |

### 4.23 Cross-Cutting E2E

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E-CC-01 | Full user journey | Join → setup → browse → like → match → chat → edit profile → delete | All steps succeed end-to-end |
| E-CC-02 | Two-user interaction | UserA likes UserB → UserB likes UserA → chat opens | Match + conversation work |
| E-CC-03 | Admin + user parallel | Admin creates event → user joins → admin views participant → admin bans | All steps succeed |
| E-CC-04 | Hebrew throughout | All UI text appropriate | RTL layout, Hebrew labels |
| E-CC-05 | Performance - grid with 50 participants | Seed 50 users | Page loads < 3s |
| E-CC-06 | Performance - chat with 100 messages | Seed 100 messages | Loads + scrolls smoothly |

---

## 5. Test Matrix Summary

| Category | Count | Coverage Target |
|----------|-------|-----------------|
| **Unit - lib/ functions** | ~120 tests | Every exported function, all branches |
| **Unit - Zustand stores** | ~55 tests | Every action, state transitions, edge cases |
| **Unit - client API helpers** | ~35 tests | Every function, request shape, error handling |
| **Unit - components** | ~33 tests | Render, interaction, conditional states |
| **Unit - hooks** | ~6 tests | Mount/unmount/update lifecycle |
| **Unit - realtimeHub** | ~8 tests | Subscription management, refcounting |
| **Integration - API routes** | ~135 tests | Every route × method × guard × error path |
| **Integration - security** | ~10 tests | Cross-cutting auth/CSRF/ban/event checks |
| **E2E - user flows** | ~95 tests | Every page, interaction, user journey |
| **E2E - admin flows** | ~25 tests | Event CRUD, participants, analytics |
| **E2E - cross-cutting** | ~15 tests | Multi-user, performance, RTL, PWA |
| | | |
| **TOTAL** | **~537 tests** | **Complete coverage** |

---

### Implementation Priority

| Phase | Scope | Estimated Effort | Rationale |
|-------|-------|-----------------|-----------|
| **Phase 1** | Unit tests: `lib/` pure functions | 2–3 days | Highest value, no infra needed |
| **Phase 2** | Unit tests: Zustand stores | 1 day | Quick wins, no async |
| **Phase 3** | Integration tests: API routes | 3–5 days | Core business logic, needs Supabase mock |
| **Phase 4** | Unit tests: components | 2 days | Needs React Testing Library setup |
| **Phase 5** | E2E tests: critical flows | 3–4 days | Needs Playwright + seeded DB |
| **Phase 6** | E2E tests: admin + edge cases | 2–3 days | Lower priority, admin-only |
| **Phase 7** | E2E tests: performance + PWA | 1 day | Nice-to-have |

**Total estimated:** ~14–19 days of implementation work.
