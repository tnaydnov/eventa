# Eventa - Major Upgrade Plan

> **Status**: Planning document (no code changes yet).
> **Author**: AI architecture review.
> **Scope**: Five interlocking workstreams that together require a non-trivial restructuring of the app.

---

## 0. Executive summary

The current codebase is in a healthier state than the prompt suggests - it is a fairly well-factored Next.js 16 / Supabase monolith with a clean API pipeline (`secureGuard`), a working realtime stack, OTP auth, a serverless SMS provider (TextMe), and a non-trivial admin analytics surface. The biggest *architectural* smell is not the layering, it's the **routing/product identity**: the homepage advertises a multi-service platform that doesn't exist, and the only real product hides behind `/dating/...`. This creates dead URLs in QR codes, dead nav links, and dead marketing copy.

The four upgrade requests fall into three buckets:

| Bucket | Items | Risk |
|---|---|---|
| **Pure refactor** (no new product surface) | (2) De-`/dating` the URL space, (1) i18n | Medium. Touches almost every file but is mechanical. |
| **Backend feature** | (3) Extended analytics, (4) Push/SMS notifications, parts of (5) | Medium-high. Adds new tables, new cron jobs, new external dependencies, new privacy considerations. |
| **New product surface** | (5) Post-event client report | High. New auth model (the *client*, not the participant or the admin), new PDF/image rendering, new AI cost line. |

We recommend executing in this order, because each phase de-risks the next:

1. **Phase 0** - Tighten the analytics data we already collect (small, no user-facing risk).
2. **Phase 1** - Route migration (`/dating → /`) and i18n shell (one combined deploy so we only touch every link once).
3. **Phase 2** - Drop-off detection + abandoned-funnel SMS reminders (uses existing TextMe).
4. **Phase 3** - Out-of-app SMS notifications for likes/messages (requires presence + throttling infra).
5. **Phase 4** - Client portal + post-event report + AI summary.

The remainder of this document specifies each of these in depth.

---

## 1. Current state - what we actually have

### 1.1 Stack snapshot
- Next.js 16 App Router, React 19, TypeScript strict, Node 20.
- Supabase Postgres 17 + Realtime + Storage; RLS via `x-event-id` header on the anon client; service-role for all writes.
- Hand-rolled HMAC-SHA256 JWT auth, two cookies: `ws_session` (participant) and `ws_admin` (admin).
- TextMe SMS provider (live/stub via `SMS_PROVIDER_LIVE`), `message_log` audit table already exists.
- Vercel + 3 existing cron jobs: `auto-archive`, `cleanup`, `pre-event-messages`, `feedback-messages`, `upload-reminders`.
- Service worker via Serwist (`src/app/sw.ts`).
- All UI text is hard-coded Hebrew. `<html lang="he" dir="rtl">` is fixed in [src/app/layout.tsx](src/app/layout.tsx#L72).

### 1.2 Route inventory (today)

```
/                                       Marketing homepage (multi-service "platform")
/dating                                 Dating product landing + order wizard host
/dating/order                           Order wizard
/dating/event-over                      Static end screen
/dating/[eventSlug]/join                Join (QR target, with ?k=)
/dating/[eventSlug]/setup               Profile setup
/dating/[eventSlug]/                    Grid (main app)
/dating/[eventSlug]/user/[id]
/dating/[eventSlug]/chat/[conversationId]
/dating/[eventSlug]/chats
/dating/[eventSlug]/likes
/dating/[eventSlug]/profile
/dating/[eventSlug]/banned
/dating/[eventSlug]/unavailable
/dating/[eventSlug]/feedback
/guest-upload/[token]                   Client guest-list portal (token auth)
/admin/*                                Admin SPA
/how-it-works, /pricing, /faq, /privacy, /terms, /cookies, /accessibility
```

### 1.3 What works well (preserve as-is)
- The `secureGuard` API pipeline.
- The `RealtimeHub` singleton + polling fallback (it survives mobile Safari background killing - do **not** rewrite this).
- `compute-event-analytics.ts` shared between live and snapshot paths.
- `message_log` + `messaging-service.ts` abstraction - the right shape to extend.
- The admin event lifecycle (`draft → active → paused → ended → archived`) and the 7-day retention cron.

### 1.4 What's weak (the real architectural debt)
| Area | Smell | Severity |
|---|---|---|
| **Routing/product identity** | Homepage markets "platform with many services" but only dating works | High - directly addressed in §3 |
| **Text/strings** | All UI strings are inlined Hebrew literals across ~80 files | High - addressed in §4 |
| **In-memory rate limiter** | Doesn't survive cold starts on Vercel (already noted in ARCHITECTURE.md §5.3) | Medium - out of scope here but worth flagging |
| **No central event-bus** | Notification-worthy events (like, match, message) are scattered across API routes. To add SMS-on-like we either repeat logic or add an indirection. | High - addressed in §5 & §6 |
| **No "presence" concept** | We track `last_seen_at` (debounced 2 min) but have no concept of "currently in the app" vs "browser closed". Required for out-of-app SMS. | High - addressed in §6 |
| **No client identity** | Only admin and participant exist. The paying client has no login of their own (only the token-scoped `/guest-upload/[token]`). Required for §7. | High - addressed in §7 |
| **No image content moderation** | Profile + chat uploads go straight to storage with no NSFW / CSAM check. Single legal-risk gap in the product. | High - addressed in §14 |
| **No optimistic UI on likes / no idempotent client retry** | The most-tapped action in the app round-trips to the API before painting feedback. On bad WiFi this looks like the app is broken. | High - addressed in §15.3 / §15.7 |
| **Service worker too conservative for reads** | `NetworkOnly` is applied to every secure API including safe GETs; photo bytes get no tuned cache rule. On cold WiFi this dominates time-to-grid. | Medium - addressed in §15.9 |
| **No connection-quality awareness** | We only have `online/offline`. A 60 s stale WebSocket on solid WiFi looks identical to a healthy connection to the user. | Medium - addressed in §15.4 |

---

## 2. Goals and non-goals

**Goals**
- One product, one URL space, one identity (Eventa = the dating app).
- Hebrew + English for participants and marketing; Hebrew only for admin.
- Significantly richer event-level analytics, retained across the archive boundary.
- Out-of-app SMS for drop-off recovery and for likes/messages while the user is not in the PWA.
- A polished, AI-augmented post-event report sent to the paying client.

**Non-goals (explicitly)**
- Native iOS/Android app - PWA stays.
- Server-rendering the dating app pages - they stay client-only.
- Replacing Supabase, Vercel, or the JWT auth scheme.
- More than two languages. RTL switching only happens between `he` and `en`.
- Real-time web push notifications (out of scope - see §6.4 for why SMS is the right answer for this product).

---

## 3. Workstream A - Route migration: kill `/dating`

### 3.1 Target URL space

```
/                                       Dating product landing + nav (was /dating)
/order                                  Order wizard (was /dating/order)
/event-over                             (was /dating/event-over)
/[eventSlug]/join                       Join (was /dating/[eventSlug]/join)
/[eventSlug]/setup
/[eventSlug]/                           Grid
/[eventSlug]/user/[participantId]
/[eventSlug]/chat/[conversationId]
/[eventSlug]/chats
/[eventSlug]/likes
/[eventSlug]/profile
/[eventSlug]/banned
/[eventSlug]/unavailable
/[eventSlug]/feedback
```

The old multi-service homepage at `/` ([src/app/page.tsx](src/app/page.tsx)) is deleted; its replacement is what is currently at `/dating` ([src/app/dating/page.tsx](src/app/dating/page.tsx)).

### 3.2 The slug-collision problem (must be solved before anything else)

Once `/[eventSlug]` lives at the root, it competes with every other top-level static route: `/order`, `/admin`, `/how-it-works`, `/pricing`, `/faq`, `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/guest-upload`, `/api`, `/event-over`, `/sitemap.xml`, `/robots.txt`, `/manifest.json`, `/sw.js`, and any future marketing page. Next.js gives static segments priority over dynamic ones, so routing-wise this is safe - but **slug generation must blacklist all of them** or admins will be able to mint an event whose URL silently shadows a real page.

Action items:
- Add `RESERVED_SLUGS` constant to [src/lib/slug.ts](src/lib/slug.ts) listing every reserved top-level segment.
- Reject reserved slugs in `POST /api/admin/events` and `PATCH /api/admin/events/[eventId]` with a Zod refine.
- Add a Supabase CHECK constraint or trigger to enforce this at the DB layer as well (defense in depth).
- One-off migration: scan existing events; if any current slug collides (unlikely but possible), rename it and write a permanent redirect.

### 3.3 Backwards compatibility (redirects)

Existing posters, QR codes, WhatsApp messages, SMS we already sent, and Google/Bing index entries all point at `/dating/...`. We must not break them.

Implement permanent (308) redirects in [next.config.js](next.config.js) using `async redirects()`:

```
/dating                          → /
/dating/order                    → /order
/dating/event-over               → /event-over
/dating/:eventSlug               → /:eventSlug
/dating/:eventSlug/:path*        → /:eventSlug/:path*
```

308 (not 301) so the method is preserved (the join page accepts only GET, but participants opening a stale link from an email client should still arrive at the new URL with their `?k=...` intact).

### 3.4 Files that need to change

The grep in research turned up ~58 occurrences. They fall into these categories:

1. **Folder move**: `src/app/dating/[eventSlug]/*` → `src/app/[eventSlug]/*`, and `src/app/dating/page.tsx` + `src/app/dating/order/page.tsx` + `src/app/dating/event-over/page.tsx` move up one level. The current root `page.tsx` (multi-service homepage), `HomeReveal.tsx`, `ComingSoonSection.tsx`, `ComingSoonCard.tsx` are deleted along with any styles only they reference.
2. **Internal navigation**: every `router.push('/dating/...')`, `router.replace('/dating/...')`, `window.location.href = '/dating/...'`, and `<Link href="/dating/...">` is rewritten. Centralise this by introducing a `routes.ts` helper (`routes.event(slug)`, `routes.join(slug, code)`, `routes.chat(slug, convId)` …) and migrate call sites to it. This pays for itself the second time we ever rename a route.
3. **Message templates**: [src/lib/messaging/templates.ts](src/lib/messaging/templates.ts#L9) `buildJoinUrl` and `buildFeedbackUrl`.
4. **API-side URL building**: [src/app/api/admin/events/route.ts](src/app/api/admin/events/route.ts#L206), [src/app/api/admin/requests/route.ts](src/app/api/admin/requests/route.ts#L301), [src/app/api/payment/callback/route.ts](src/app/api/payment/callback/route.ts#L311), [src/app/api/payment/create-session/route.ts](src/app/api/payment/create-session/route.ts#L110).
5. **Admin UI**: [src/app/admin/page.tsx](src/app/admin/page.tsx#L67), [src/app/admin/_components/QRDialog.tsx](src/app/admin/_components/QRDialog.tsx#L33), [src/app/admin/_components/events/CreateEventDialog.tsx](src/app/admin/_components/events/CreateEventDialog.tsx#L247), [src/app/admin/_components/feedback/FeedbackTab.tsx](src/app/admin/_components/feedback/FeedbackTab.tsx#L184).
6. **SEO**: [src/app/sitemap.ts](src/app/sitemap.ts), [public/manifest.json](public/manifest.json), all `<Metadata>` `alternates.canonical` values, the `start_url` in `manifest.json`.
7. **Tests**: the e2e tests under `__tests__/e2e/flows/` reference paths - sweep them too.

### 3.5 Cutover sequence (one PR, one deploy)

The whole route move must ship in a single deploy. Half-migrated state will brick the QR posters.

1. Create `routes.ts` and refactor all call sites to use it (no behaviour change yet).
2. Move folders. `src/app/dating/[eventSlug]` → `src/app/[eventSlug]`. Update `routes.ts` to emit the new paths.
3. Delete old marketing homepage; promote dating landing to root.
4. Add `RESERVED_SLUGS` enforcement.
5. Add `redirects()` in `next.config.js`.
6. Update `sitemap.ts`, `manifest.json` (`start_url`, `scope`), all canonical URLs.
7. Run full test sweep including e2e.
8. Deploy. Verify a stale `/dating/some-event/join?k=...` link still works (308 chain).

### 3.6 What does *not* change
- Database column names (`event_slug` is still just a slug).
- API endpoints - `/api/secure/likes` etc. stay where they are.
- Admin routes stay at `/admin/*`.
- Guest upload portal stays at `/guest-upload/[token]`.
- Service worker scope - but `start_url` in `manifest.json` must be updated.

---

## 4. Workstream B - i18n (Hebrew + English)

### 4.1 Scope
- **In scope**: marketing pages (`/`, `/order`, `/pricing`, `/how-it-works`, `/faq`, `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/event-over`), the entire dating app (`/[eventSlug]/*`), error pages, the service worker offline page, OTP/SMS templates (English variants for English-speaking participants).
- **Out of scope**: `/admin/*` (Hebrew-only by user instruction), `/guest-upload/[token]` (Hebrew-only - used by Israeli event organisers).

### 4.2 Library choice

**Recommendation: `next-intl` v3+**, not `react-i18next` and not `next-i18next` (which is unmaintained for App Router).

Why `next-intl`:
- First-class App Router support, including server components.
- Built-in middleware for locale detection from URL + `Accept-Language` + cookie.
- ICU MessageFormat for plurals, gender, date/number formatting (we have age and counts everywhere).
- Tree-shakeable per route segment, no runtime overhead in client bundles beyond the strings actually used.
- Good Hebrew/RTL tooling: `useLocale()` plus a `dir` helper.

Trade-off: requires the route group `app/[locale]/...` pattern, which means a *second* big folder move on top of §3. We do them together (see §11 - combined Phase 1).

### 4.3 URL strategy

**Pattern**: locale as the first segment, with the default (Hebrew) **shown explicitly** for clarity in SMS templates and OG previews.

```
/he/                       (Hebrew landing - current default)
/en/                       (English landing)
/he/order                  /en/order
/he/[eventSlug]/join       /en/[eventSlug]/join
/he/admin                  → 308 → /admin   (admin stays at unprefixed /admin, Hebrew only)
/                          → 308 → /he/      (root redirects based on Accept-Language cookie)
```

Why explicit prefix on the default locale:
- SMS templates currently embed full URLs. The recipient may switch language after clicking. Explicit prefix makes the link's language unambiguous and Hreflang-friendly for SEO.
- Eliminates the "is this URL prefixed or not?" branching that hidden default locales create in `next-intl` middleware.

### 4.4 Language switcher UX

- Marketing pages: language toggle in the global nav (he/en pill, top-right in LTR / top-left in RTL).
- Dating app: a toggle inside `/profile` and inside `/setup` step 1 (before they've committed to anything). Once changed, the locale is persisted in:
  - a cookie (`NEXT_LOCALE`, 1 year, `Lax`, `Secure`), and
  - the user's `participants.preferred_locale` column (new - see §4.5).
- Server-side: locale is resolved per request as `cookie → URL prefix → Accept-Language → 'he'`.

### 4.5 Schema changes

```sql
ALTER TABLE participants  ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'he'
  CHECK (preferred_locale IN ('he', 'en'));
ALTER TABLE guest_phones  ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'he'
  CHECK (preferred_locale IN ('he', 'en'));
ALTER TABLE event_requests ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'he'
  CHECK (preferred_locale IN ('he', 'en'));
```

`events.preferred_locale` is intentionally *not* added - events are bilingual at the participant level, not the event level (an English-speaking attendee at a Hebrew wedding should see English UI without changing what other attendees see).

### 4.6 SMS / email templates

`templates.ts` becomes locale-aware. Each template gains an `en` variant. The OTP template is the only message sent before we know the user's preferred locale, so it falls back to Hebrew unless the join link carried `?lang=en` (we forward this through OTP issuance).

### 4.7 RTL / LTR handling

- `<html lang>` and `<html dir>` become dynamic - set in the locale-segment root layout based on `useLocale()`.
- All CSS files in `src/app/styles/` already use logical properties in many places, but several use `left`/`right`. A grep-and-replace pass is required to migrate to `inline-start`/`inline-end`. This is mechanical but tedious.
- The decorative `Great Vibes` script font is Latin-only and looks wrong for Hebrew event names (already noted as `font-family: 'Great Vibes', cursive` in many headers). Confirm with the user: when the **event name** is Hebrew but the **UI locale** is English, do we still want Great Vibes for the name? Recommendation: yes, because the script font is applied to the event name itself, not the UI chrome, and Hebrew users have been seeing this work fine for English event names already (the font swap is gated on the *content's* script, not the locale). Implementation: detect Hebrew characters in the event name and conditionally apply the Rubik font instead.

### 4.8 String extraction strategy

We have ~80 files with Hebrew literals. Brute-force extraction is the only path. Recommended approach:

1. Define namespaces matching folder structure: `marketing`, `wizard`, `join`, `setup`, `grid`, `swipe`, `chat`, `likes`, `profile`, `match`, `errors`, `sms`, `email`.
2. Per file: extract all `>text<`, `placeholder=`, `aria-label=`, `title=`, `alt=` literals into the namespace's `he.json` and replace with `{t('key')}`.
3. Mechanical translation pass for `en.json` (we'll do this manually - auto-translation creates marketing copy embarrassments).
4. ESLint rule: add `eslint-plugin-i18next` or similar to fail the build on raw Hebrew/English string literals in JSX outside of approved files (admin pages, server-only constants).

Estimated message-key count: 600–900 keys total across the user-facing surface.

### 4.9 What we are *not* changing
- Admin UI stays untouched (Hebrew-only).
- Server-side log messages stay English (they were already a mix; standardise to English in this pass).
- The Great Vibes / Rubik font variables in [src/app/layout.tsx](src/app/layout.tsx#L6) stay; only `lang`/`dir` becomes dynamic.

---

## 5. Workstream C - Extended event analytics

### 5.1 What we already compute

[src/lib/compute-event-analytics.ts](src/lib/compute-event-analytics.ts) currently produces:
- Participant demographics (men/women, attracted-to splits, age buckets).
- Photo upload coverage.
- Likes sent by gender, seen/unseen, first-like-by-gender.
- Matches (mutual likes).
- Conversations & messages (via aggregates not shown above but present in the rest of the file).
- Blocks with context flags (`had_like`, `had_match`, `had_conversation`).
- Activity timeline (from `activity_log`).

Persisted in `event_analytics_snapshots` so it survives archiving.

### 5.2 Gaps & high-value additions

These are the analytics that would actually help us understand event quality, sell the product, and feed the post-event report (§7):

#### A. Funnel & drop-off
*The single most valuable thing we're missing.*
1. **QR scans** vs **`/join` page views** vs **OTP requested** vs **OTP verified** vs **profile completed** vs **first like sent**. Today we only see counts at the "completed profile" boundary. Recording the upstream steps lets us see *where* people give up.
2. **Time-to-complete**: median time from join-page-view to profile-complete.
3. **Setup abandonment**: how many got an OTP, verified, but never finished setup. (Required for §6.1 abandoned-funnel SMS.)

Schema:
```sql
CREATE TABLE funnel_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  step         text NOT NULL,             -- 'qr_scan' | 'join_view' | 'otp_requested' | 'otp_verified' | 'setup_started' | 'profile_complete' | 'first_like' | 'first_match' | 'first_message'
  participant_id uuid,                    -- nullable; only known from otp_verified onward
  session_id   text,                      -- anonymous client-generated UUID, set on first /join view
  phone_hash   text,                      -- SHA-256, lets us join pre-auth and post-auth events for the same person
  user_agent   text,
  ip_hash      text,                      -- SHA-256(ip + daily-rotated salt) for cohorting without storing PII
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_funnel_event_step ON funnel_events(event_id, step, created_at);
CREATE INDEX idx_funnel_session ON funnel_events(session_id);
```
The `?utm_qr=1` query param on the QR-code URL distinguishes a QR scan from a typed link. The `session_id` is set as an httpOnly cookie on first `/join` view (separate from `ws_session` which only exists post-auth).

#### B. Engagement quality (not just volume)
1. **Like → reply rate**: of likes sent, what fraction led to a mutual match within 30 min / 2 h / by event end?
2. **Match → message rate**: of matches, what fraction sent the first message? How fast?
3. **Conversation depth distribution**: median messages-per-conversation, % conversations > 5 messages, % > 20 messages.
4. **Two-sided conversations**: % conversations where both parties sent at least one message.
5. **Response latency**: median time between message and reply, by hour of day.
6. **Photo-completeness vs match rate**: cohort analysis (1 photo / 2-3 / 4-6 / 7+).

#### C. Time dynamics
1. **Peak-hour activity heatmap** (we already log `activity_log` with timestamps - just bucket by 15-min slot and action type).
2. **First-like / first-match / first-message** time-since-event-start histograms.
3. **Drop-off curve**: how long after joining does each cohort stay active?
4. **Session count per participant**: how many times did they reopen the app during the event?

#### D. Network structure
1. **Most-liked participants** (top decile).
2. **Reciprocity rate**: for participants who received N likes, what fraction did they like back?
3. **Conversation graph density**: edges (conversations) ÷ possible edges. A proxy for whether the event "clicked" socially.
4. **Concentration / Gini coefficient on likes received**: high Gini = a few people getting all the attention (bad for event NPS).

#### E. Demographic cross-tabs
1. Match rate by `looking_for` × `looking_for` (do "serious" + "serious" actually convert better?).
2. Match rate by age-gap bucket.
3. Match rate by city (when ≥ N participants from same city).

#### F. Safety
1. **Reports per 100 participants** (we have `blocks` with context flags - already half-done).
2. **Bans issued during event** (admin actions on this event).
3. **OTP failure rate** (wrong codes / max attempts hit) - anomalous spikes suggest spam.

#### G. Quality of experience
1. **Error rate**: client errors per session (requires lightweight client error logging - see §5.4).
2. **Median FCP / LCP** if we expose Web Vitals reporting (Next.js supports this OOTB).
3. **Realtime delivery health**: % of notifications that arrived via WebSocket vs polling fallback (the hub already knows this - just count and report).

#### H. Post-event feedback (we already have this partially)
We already collect `/feedback` survey responses. Integrate the scores (NPS, "did you meet someone?", "would you use again?") into the same analytics object so the post-event report has them.

### 5.3 Implementation pattern

To avoid bloating the live analytics endpoint (which is already 646 lines) and to keep the snapshot path simple:

1. Keep the existing `EventAnalytics` shape; add sub-objects: `funnel`, `engagementQuality`, `timeDynamics`, `network`, `crosstabs`, `safety`, `experience`, `feedback`.
2. Move computation out of one monster function into one file per sub-object under `src/lib/analytics/`. The orchestrator (`computeEventAnalytics`) becomes a 30-line aggregator.
3. **Eager materialisation for expensive ones**: the Gini coefficient and conversation-graph density are O(participants²). For an event with 800 participants this is fine in-memory, but we should cap and short-circuit at 5000.
4. **Snapshot extension**: the existing `event_analytics_snapshots` row stores a JSONB. New fields go straight into that JSONB - no schema migration there, just a versioned `schema_version` field so old snapshots remain readable.

### 5.4 Client-side error / vitals reporting (small new endpoint)

```
POST /api/telemetry/vitals      { sessionId, metric, value, eventId? }
POST /api/telemetry/error       { sessionId, eventId?, message, stack, url }
```
Rate-limited at `strict` (3/min). Drops payloads bigger than 2 KB. Vitals piped into `event_vitals` (new table), errors into `event_errors`. Both auto-purged with event cleanup.

### 5.5 Performance budget
The current analytics query already pulls up to 7 × 100k rows in parallel. With funnel events added we'll be querying an 8th table. For typical events (≤ 800 participants, ≤ 5k likes, ≤ 20k activity rows) this stays under 500 ms. For the few large events (corporate meetups), add an index hint and consider a materialised view refreshed on archive.

---

## 6. Workstream D - Out-of-app SMS notifications & reminders

### 6.1 Use cases the user actually asked for

| # | Trigger | Message | Throttle |
|---|---|---|---|
| 1 | User scanned QR, opened /join, never reached profile-complete | "ראינו שהתחלת להירשם ל-{event}. סיים בקליק:" + join link | Once per phone per event, only after 15 min idle, only between 09:00–22:00 local |
| 2 | Profile complete but no likes/messages 30 min in | "המסיבה בעיצומה! ב-{event} כבר {n} רווקים. בוא תראה" | Once per participant per event |
| 3 | Received a like and is not in the app | "🔥 קיבלת לייק חדש ב-{event}" | Max 1 per hour per participant; only if `last_seen_at` > 10 min ago |
| 4 | Received a message and is not in the app | "💬 הודעה חדשה ב-{event} מ-{display_name}" | Max 1 every 15 min per participant; only if `last_seen_at` > 5 min ago and conversation hasn't been opened |
| 5 | Mutual match and is not in the app | "✨ יש לכם מאצ׳ ב-{event}!" | Always sent (this is the moment) - only if `last_seen_at` > 10 min |

All messages localised per `participants.preferred_locale`.

### 6.2 Presence detection - "not in the app"

The product question: *when do we count someone as "not in the app"?*

The right answer for SMS economics and user trust:

```
in_app = (heartbeat seen in last 60s) OR (PWA tab visible per visibilitychange in last 60s)
```

Implementation:
- `HeartbeatPinger` already fires every 60 s. We add a `tab_visible` boolean to its payload (from `document.visibilityState`).
- Server-side, we **don't** debounce visible-tab heartbeats (drop the 2-min `last_seen_at` debounce for these - the storage cost is trivial).
- Add a derived column `participants.is_present` that we compute on read (or a function `is_participant_present(id, threshold)`).
- The "send SMS" decision for items 3/4/5 happens *inside* the API route that creates the like/message/match, after the fire-and-forget DB insert, gated on `is_present === false`.

Race: someone gets a like, server checks presence → false, queues SMS → user opens app 2 seconds later. The SMS is already in TextMe's queue. Mitigation: **2-minute deferred dispatch** for items 3 & 4 (insert a row in `pending_sms`, cron sweeps it every minute; if user came back online in the interim, drop the row). For item 5 (match) we send immediately because the moment matters.

### 6.3 New tables & cron

```sql
CREATE TABLE pending_sms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id  uuid NOT NULL,
  phone           text NOT NULL,
  message_type    text NOT NULL,           -- 'like' | 'message' | 'match' | 'abandoned_funnel' | 'inactivity_nudge'
  payload         jsonb NOT NULL,          -- everything templates.ts needs
  dispatch_after  timestamptz NOT NULL,
  cancel_if_seen_after timestamptz,        -- if last_seen_at > this when cron runs, drop the SMS
  attempts        int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending',   -- pending | sent | cancelled | failed
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX idx_pending_sms_dispatch ON pending_sms(status, dispatch_after) WHERE status = 'pending';
```

```sql
CREATE TABLE sms_quotas (
  participant_id  uuid NOT NULL,
  message_type    text NOT NULL,
  last_sent_at    timestamptz NOT NULL,
  PRIMARY KEY (participant_id, message_type)
);
```

Cron: `GET /api/cron/dispatch-sms` runs every 60 s (Vercel cron supports per-minute). Idempotent, takes `pending_sms` rows where `status='pending' AND dispatch_after <= now()` in batches of 50, re-checks presence + quota, then sends via existing `messaging-service.ts`.

### 6.4 Why SMS and not Web Push?

Web Push *is* available on iOS Safari 16.4+ (March 2023+) and on every Android browser, **but only for installed PWAs**. Our product hypothesis is that 60–80 % of attendees never install the PWA - they scan the QR and use the in-browser page. For those users Web Push silently fails. SMS reaches everyone who got past phone-verification (which is everyone in the app), so it's the only universally-deliverable channel for "you're not in the app right now" notifications.

We can *add* Web Push later as an optimisation that **replaces** SMS for users who installed the PWA and granted permission (saves cost), but it must never be the only channel. Defer for now.

### 6.5 Cost & abuse model

TextMe pricing is per-SMS. Worst case for a 200-person event over 6 hours, with the throttles above:
- Abandoned-funnel: ~30 messages.
- Inactivity nudge: ~20 messages.
- Likes/messages/matches OOA: typical participant gets 2–4 such SMS over the event → ~600 messages.

Total ~650 SMS/event vs current ~200. We should:
- Add a per-event hard cap (e.g. 3 OOA SMS per participant per event total across all types) and surface it in admin so client can lower it.
- Per-event opt-out: a single column `events.sms_notifications_enabled` (default true) lets the admin turn the whole thing off.
- Per-participant opt-out: a "SMS notifications" toggle inside `/profile`, persisted as `participants.sms_notifications_enabled` (default true).
- A "stop" keyword pathway via TextMe inbound webhooks (TextMe supports inbound) - append phone to a global `sms_optout` table.

### 6.6 Rules around quiet hours
- Default: do not dispatch any `pending_sms` between 22:30 and 08:30 Israel time. Defer to next morning.
- During-event override: for items 3/4/5, ignore quiet hours if `event.starts_at <= now() <= event.ends_at` (the party is happening, so SMS is expected).
- Abandoned-funnel and inactivity-nudge (items 1/2): always respect quiet hours.

### 6.7 Integration points in existing code

| Where | Change |
|---|---|
| `POST /api/secure/likes` | After insert, fire-and-forget `enqueueLikeNotification(toParticipantId, fromName)`. |
| `POST /api/secure/messages` | After insert, `enqueueMessageNotification(...)`. |
| Match detection (already in `likes` route) | `enqueueMatchNotification(...)` for both sides. |
| `POST /api/auth/verify-otp` | After OTP verify, insert `funnel_events` step + schedule abandoned-funnel SMS at +15 min. |
| `PATCH /api/secure/profile` when first save completes profile | Cancel any pending abandoned-funnel SMS; insert `funnel_events` `profile_complete`. |
| `POST /api/secure/heartbeat` | If `tab_visible=true`, sweep `pending_sms` rows for this participant where `cancel_if_seen_after >= now()` and set status='cancelled'. |
| `POST /api/secure/conversations/read` | If the read-receipt was for a conversation we sent a message-SMS for, cancel pending message-SMS for that conversation. |

### 6.8 Privacy & legal
- Privacy policy must be updated to explicitly cover SMS notifications, who sends them, opt-out instructions.
- The OTP onboarding screen should explicitly request consent for non-OTP SMS at the time of phone verification, with a checkbox (`participants.sms_notifications_enabled`).
- TextMe sender-ID + STOP keyword compliance is already handled by TextMe.

---

## 7. Workstream E - Post-event client report

### 7.1 What the user actually wants

A "report-grade" deliverable sent to the paying client the day after the event, that:
- Shows the client a **subset** of the analytics (we choose what's appropriate - not safety internals).
- Is visually polished (charts + cards, not a JSON dump).
- Includes an **AI-generated narrative** that summarises what happened and gives commentary ("this event ran hot - 38 % of attendees joined, twice the platform average; matches were heavily concentrated in the 25–32 age band; consider …").
- Is delivered as: an emailed PDF + a unique link to a hosted version (with optional expiry).

### 7.2 New identity: the *client* (event owner)

We currently have no concept of an event owner - admins manage everything. We need to introduce a third actor:

```
admins         → /admin                    (Eventa staff)
clients        → /portal/[token]           (paying customer, post-event report + guest list)
participants   → /[eventSlug]/*            (attendees of one event)
```

The existing `/guest-upload/[token]` portal is already token-authenticated. We extend it:

- Rename `/guest-upload/[token]` → `/portal/[token]` (with a 308 redirect). The portal becomes a multi-tab thing: "Guest list" (existing), "Report" (new, only visible after `event.status='ended'`).
- The token is the same one already issued by `POST /api/admin/events/[eventId]/portal-token`.
- Token lifetime: extend to event-end + 30 days (currently shorter - verify in code) so clients can still access the report a month later.

### 7.3 Curated "client view" of analytics

What goes in the client report (curated subset of §5.2):

| Section | Includes | Excludes |
|---|---|---|
| **Headline** | Total participants, total matches, total messages, average rating from feedback | - |
| **Demographics** | Gender split, age distribution, top cities | Looking-for distribution (privacy-sensitive) |
| **Engagement** | Likes sent, match rate, conversations started, two-sided conversations, median messages-per-conversation | Per-person stats |
| **Time dynamics** | Activity heatmap (15-min buckets), peak hour, time-to-first-match histogram | - |
| **Quality moments** | "First match happened at HH:MM (T+ 23 min from event start)", N matches in the first hour | - |
| **Feedback** | Aggregate ratings, sample quotes (with consent) | Individual quotes attributed to a person |
| **AI commentary** | 200–400 words generated narrative (see §7.5) | - |
| **NOT included** | Block reasons, banned participants, individual photos, individual conversation content, phone numbers, IPs | - |

### 7.4 Rendering: PDF + hosted view

Two artefacts from one source of truth:

**Hosted view** (`/portal/[token]/report`): a normal React page that fetches the curated payload from `GET /api/portal/[token]/report` and renders it with Recharts (already in deps). Shareable via the token URL.

**PDF**: rendered server-side from the same React tree using one of:
- `@react-pdf/renderer` (writes a separate component tree - duplicates work, but no headless browser cost).
- `puppeteer-core` + Chromium on a Vercel function (high cold-start cost, ~250 MB layer).
- **Recommendation**: a third-party HTML→PDF service like `Browserless.io`, `Pdfshift`, or `Vercel's @vercel/og` for image renderings. Since the user explicitly mentioned "a saved screenshot of an analytics page", an **image (PNG) snapshot via `@vercel/og` + a separate PDF assembly** is the lowest-friction path.

**Recommendation**: ship v1 as a **shareable hosted page + a single PNG hero image** (generated with `@vercel/og`) embedded in the email. Add a true multi-page PDF in v1.1 once the visual design is finalised. This avoids over-investing in PDF chrome before we know what the client values.

### 7.5 AI commentary

Inputs to the model: the curated analytics JSON only (no PII, no message content).

Pipeline:
- Provider: OpenAI `gpt-4o-mini` (cheap, fast, multilingual - needed for Hebrew/English). Anthropic Claude `haiku` is a fine alternative; both have stable APIs and no surprise cost spikes.
- System prompt fixes voice ("you are an event-analytics writer for Eventa, write in {locale}, be concrete, cite numbers, never invent, never name individuals").
- User prompt is the curated JSON + the event metadata + the locale.
- Output is a 200–400 word narrative + 3 bullet "highlights" + 1 "suggestion for next event".
- Stored in `event_reports.ai_summary` (versioned with model name + prompt hash so we can regenerate cleanly).
- Cost guard: max 4 K input tokens, max 600 output tokens → ~$0.002 per event. Negligible.
- Failure mode: if the API errors, the report still ships **without** AI narrative (graceful degradation). The hosted page shows a "regenerate summary" button for the admin (not the client).

### 7.6 New tables

```sql
CREATE TABLE event_reports (
  event_id          uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  schema_version    int NOT NULL,
  curated_payload   jsonb NOT NULL,             -- the §7.3 subset
  ai_summary        text,                       -- nullable: degraded mode
  ai_summary_locale text,
  ai_model          text,
  ai_prompt_hash    text,
  hero_image_url    text,                       -- in 'reports' bucket
  email_sent_at     timestamptz,                -- nullable until cron sends it
  email_sent_to     text                        -- which address actually received it
);
```

A new storage bucket `reports` (public read) holds the OG hero images.

### 7.7 Delivery cron

`GET /api/cron/send-reports` runs hourly. For each event where:
- `status='ended'` (the auto-archive cron already handles the transition)
- `ends_at + 12 hours < now() < ends_at + 36 hours` (delivery window)
- `event_reports.email_sent_at IS NULL`

…it: generates the report (call `computeEventAnalytics` → curate → AI summary → render hero image), inserts into `event_reports`, emails the client (using existing Nodemailer mailer), records `email_sent_at`. Idempotent.

The 12-hour delay is intentional: avoids generating before stragglers stop opening the app, and lands in the client's morning inbox.

### 7.8 Email template
- Subject: `הדוח שלכם מ-{event_name} מוכן 🎉` / `Your {event_name} report is ready 🎉` (per client locale stored in `event_requests.preferred_locale`).
- Embeds the hero PNG.
- "צפו בדוח המלא" CTA → hosted portal URL with token.
- "Reply to this email if you have questions."
- All links UTM-tagged so we can attribute repeat business to the report.

### 7.9 Admin controls

In the admin event detail page, add a "Report" tab:
- Preview the curated payload before delivery.
- "Send now" / "Regenerate AI summary" / "Re-send to a different email" buttons.
- Toggle: `send_report_email` (default on).

---

## 8. Cross-cutting: a small event-bus for in-app events

Items §5 (funnel logging), §6 (notification triggers), §7 (report inputs) all want to react to "a like happened", "a message happened", "an OTP was verified". Today these reactions are inlined into the relevant API route. If we keep inlining we will end up duplicating logic and missing call sites.

Introduce one minimal in-process bus:

```ts
// src/lib/event-bus.ts
type EventaEvent =
  | { type: 'qr_scan'; eventId: string; sessionId: string; ts: string }
  | { type: 'join_view'; eventId: string; sessionId: string; ts: string }
  | { type: 'otp_requested'; eventId: string; phoneHash: string; ts: string }
  | { type: 'otp_verified'; eventId: string; participantId: string; ts: string }
  | { type: 'profile_complete'; eventId: string; participantId: string; ts: string }
  | { type: 'like_sent'; eventId: string; fromId: string; toId: string; ts: string }
  | { type: 'match_created'; eventId: string; aId: string; bId: string; ts: string }
  | { type: 'message_sent'; eventId: string; conversationId: string; fromId: string; toId: string; ts: string }
  | { type: 'conversation_opened'; eventId: string; conversationId: string; participantId: string; ts: string };

export function emit(e: EventaEvent): void { /* fire-and-forget, sync subscribers */ }
export function subscribe(handler: (e: EventaEvent) => void): void { /* in-memory */ }
```

Subscribers (all in-process, all fire-and-forget):
- `funnelLogger` → writes to `funnel_events`.
- `notificationDispatcher` → enqueues `pending_sms` rows.
- `realtimeBroadcaster` → already implicit via Supabase Realtime, no change.

The bus is in-process and stateless across cold starts, which is exactly what we want - we're not building Kafka, we're collapsing two side-effects (analytics row + SMS enqueue) into one call site. If we ever need cross-instance fan-out (e.g. webhook subscribers), we promote the bus to a Postgres `LISTEN/NOTIFY` channel without changing call sites.

---

## 9. Database migrations summary

In rough order:

```
2026-05-A_route_migration.sql      -- RESERVED_SLUGS CHECK constraint on events.slug
2026-05-B_i18n.sql                 -- preferred_locale columns
2026-05-C_funnel.sql               -- funnel_events table + indexes
2026-05-D_telemetry.sql            -- event_vitals, event_errors
2026-05-E_sms_notifications.sql    -- pending_sms, sms_quotas, sms_optout
2026-05-F_consent.sql              -- participants.sms_notifications_enabled (default true)
2026-05-G_report.sql               -- event_reports + 'reports' storage bucket
```

All migrations are additive; rollback is `DROP` + `ALTER ... DROP COLUMN`. No data backfill required (existing events get NULL/defaults).

---

## 10. Testing strategy

We already have Vitest + Playwright + MSW set up.

| Phase | Tests added |
|---|---|
| 1 - route migration | Playwright e2e: stale `/dating/...` URL → 308 → correct page; QR code regression test. Unit: `RESERVED_SLUGS` rejects every reserved word. |
| 1 - i18n | Snapshot test per page in he & en. Unit: locale resolution from cookie/URL/Accept-Language priority. Unit: every i18n key in `he.json` has a counterpart in `en.json` (and vice versa). |
| 2 - analytics | Unit: each analytics sub-module with a fixture event. Golden-file: snapshot of `EventAnalytics` JSON for a curated test event. |
| 3 - funnel SMS | Integration: simulate funnel transitions, assert `pending_sms` rows created/cancelled correctly. Cron dispatch with `cancel_if_seen_after` semantics. |
| 4 - OOA SMS | Integration: like fires when both online (no SMS), like fires when target offline (SMS), like fires then target opens app within 2 min (cancelled). |
| 5 - report | E2E: archive a fixture event, run report cron, assert email sent, assert hosted page loads, assert AI summary is non-empty when API key present, gracefully empty when not. |

---

## 11. Phased rollout

| Phase | Deploys | Headline | Reversible? |
|---|---|---|---|
| **0** | 1 | New funnel + telemetry tables created, client emits events but nothing reads them yet. Risk-free instrumentation. | Yes |
| **1** | 1 | Combined route migration (`/dating` → root) **+** i18n shell. All old URLs 308-redirect. UI gains he/en toggle. | Mostly - requires DB rollback for `RESERVED_SLUGS` constraint and locale columns. Redirects can stay. |
| **2** | 1 | Extended analytics computation goes live; admin sees new charts. Snapshot schema bumps to v2. | Yes - just stop calling the new sub-modules. |
| **3** | 1 | Abandoned-funnel + inactivity-nudge SMS. Feature flag `SMS_FUNNEL_ENABLED` so we can dark-launch. | Yes via flag. |
| **4** | 1 | OOA SMS for likes/messages/matches. Feature flag `SMS_OOA_ENABLED`. Per-participant opt-out shipped at the same time. | Yes via flag. |
| **5** | 1 | Client portal + post-event report. Admin can opt-in per event before universal rollout. | Yes per event. |
| **6** | 1 | Image moderation (§14). Dark-launched via `MODERATION_ENABLED=false` first (logs scores only, no enforcement) for one event to calibrate thresholds, then flipped on. | Yes via flag. |
| **P (cross-cutting)** | continuous | Stability hardening (§15). Items 1–4 from §15.13 ship as a single "performance pass" PR after Phase 1; items 5–10 land opportunistically alongside any phase. | Yes, per item. |

---

## 12. Open questions to confirm before implementation

| # | Question | Default if no answer |
|---|---|---|
| 1 | English copy: do you want Eventa to write it, or do you have a translator? | Eventa writes a first pass; you review. |
| 2 | Should `/admin` stay literally Hebrew-only, or "Hebrew-default but English optional"? | Hebrew-only as you said. |
| 3 | OOA SMS per-participant hard cap per event - 3, 5, or 10? | 5. |
| 4 | Quiet hours - Israel time only, or per-event timezone? | Israel time (we are Israel-only today). |
| 5 | AI model choice: OpenAI `gpt-4o-mini` or Anthropic `claude-3-5-haiku`? | `gpt-4o-mini` (existing TextMe-style Israeli SaaS market familiarity, cheaper at this size). |
| 6 | Report delivery: email + hosted only, or also WhatsApp link push to client? | Email + hosted in v1, add WA in v1.1 if asked. |
| 7 | Web Push: add as opt-in optimisation alongside SMS (saves cost for installed-PWA users)? | Defer to a later phase. |
| 8 | Existing events in the DB - do we backfill funnel events for them? | No (they're already done; new events benefit). |
| 9 | The `Great Vibes` script font on English UI - keep for event names only, or drop entirely? | Keep for event names only. |
| 10 | A "test mode" report admins can generate for any event regardless of status? | Yes - admin-only `?force=true` query param on the report endpoint. |
| 11 | Moderation thresholds (§14.4) - admin-tunable per event, or global only in v1? | Global only in v1; admin-tunable in v1.1 if pilot events show variance. |
| 12 | Should borderline images (scores in the 0.55–0.85 "sexual" band) be held for admin review, or auto-approved with a flag? | **Auto-approved + shadow-review queue** (§14.4 / §14.12) - the user is never blocked by a borderline call. Admin can retroactively remove if confirmed. |
| 13 | HEIC handling on iOS uploads - drop from allowed extensions (forcing iOS to convert to JPEG on share), or keep and add a worker-based decoder? | Drop. Simpler, faster, and iOS converts transparently. |
| 14 | Should the realtime "syncing…" stale-connection indicator (§15.4 #3) appear at 30 s, 60 s, or 90 s of WebSocket silence? | 60 s - quiet enough to avoid false alarms during natural lulls. |

---

## 13. What this plan deliberately does *not* change

- The realtime stack (`RealtimeHub`) - it works and is hard-won. Don't touch it.
- The OTP flow itself (only adds optional `?lang=` carry-through).
- The dual-fingerprint ban system.
- The dual-JWT auth scheme.
- The Tailwind-4 + hand-written CSS approach.
- The mobile-only `MobileGuard` gate.
- Pricing, payments, or the Invoice4U integration.
- The 7-day retention policy (the report is generated *before* retention purge).

---

## 14. Workstream F - Image moderation (OpenAI `omni-moderation-latest`, with self-hosted Falconsai second-opinion)

### 14.1 Goal & policy - two surfaces, two postures

The overriding principle is **no false positives on innocent photos**. A bride blocked from uploading her own beach photo is a far worse outcome than briefly hosting one borderline image. The system must err *strongly* on the side of "allow", and only the most confident matches get blocked outright. Everything in the grey zone falls into a *shadow-review queue* that an admin sees - it doesn't block the user.

The two upload surfaces have **different policies on purpose**:

| Surface | Posture | What gets blocked | What gets allowed |
|---|---|---|---|
| **Profile photos** | Strict | Explicit full nudity (exposed genitalia, female nipples), sexually explicit acts, CSAM, graphic violence | Shirtless, swimwear, cleavage, suggestive poses, lingerie photos that aren't sexually explicit, alcohol, party shots |
| **Chat images (1:1)** | Loose | Only CSAM and graphic violence get blocked. Everything else is allowed. | Full nudity is **allowed** in chat - it's a private 1:1 channel between two consenting adults who already matched. The product shouldn't moderate consensual adult conversation. |

The rationale: profile photos are broadcast to every attendee at an event - they're effectively public within the venue. Anyone can see them, including the wedding's grandmother. They need to be safe-for-event. Chat images are sent inside an already-established mutual match (both sides liked each other), where adult content between consenting users is not the product's business to police - only illegal content is.

Background images uploaded by the admin in the wizard are **not** moderated automatically - the admin already gates them and CSAM/illegal content there is the admin's responsibility. (We could moderate them as a backstop; cheap to add.)

### 14.2 Model selection - the free-tier landscape

The brief is "best free model, low false-positive rate". Here is the actual market for free image NSFW classification as of mid-2026, ranked by suitability:

| Option | Modality | Cost | Latency | Strengths | Weaknesses |
|---|---|---|---|---|---|
| **OpenAI `omni-moderation-latest`** | Hosted multimodal | **Free** (no per-call charge on OpenAI's moderation endpoint) | 300–700 ms | Best calibration of any free option; per-category numeric scores (`sexual`, `sexual/minors`, `violence/graphic`, `self-harm`, etc.); handles photo realism well; we already need an OpenAI key for §7. | Sends image to a third party; rate limits exist (generous - 1k req/min for tier-1 accounts); occasional false positives on suggestive-but-clothed photos. |
| **Falconsai/nsfw_image_detection** (HuggingFace, ViT) | Self-hosted or HF Inference API | **Free** (open weights, MIT-style license) | 80–200 ms self-hosted | Tiny binary classifier (`nsfw` vs `normal`); very fast; well-known and battle-tested; can run as a Vercel Edge function or a tiny Fly.io worker; no external network call needed. | Binary only - no nuance between "swimwear" and "explicit". Trained heavily on porn vs not-porn, so swimwear is borderline. Higher false-positive rate on borderline photos than OpenAI. No CSAM-specific signal. |
| **AdamCodd/vit-base-nsfw-detector** (HuggingFace) | Self-hosted | Free | ~150 ms | More fine-grained labels (`drawings`, `hentai`, `neutral`, `porn`, `sexy`) which maps to our "explicit vs suggestive" cut more naturally than Falconsai. | Same self-hosting cost as Falconsai. Slightly less popular - less community calibration data. |
| **NSFWjs** (TensorFlow.js, on-device) | Client-side | Free | 200–800 ms (depends on phone) | Zero server cost; works offline; image never leaves the device. | Adds ~4 MB to the JS bundle; trivially bypassable (attacker can patch the JS); not viable as the *only* gate. Useful as a client-side pre-filter only. |
| **HuggingFace Inference API (free tier)** | Hosted | Free up to ~1k requests/day, then rate-limited | 500–2000 ms | No infra to maintain | Rate limit will be a hard problem at a 300-person wedding (5–10 photos/person = potential 3000 calls in an hour). |
| **Google Vision SafeSearch** | Hosted | First 1k images/month free, then $1.50/1k | 200–500 ms | Five-level confidence per category (`VERY_UNLIKELY`…`VERY_LIKELY`); mature; CSAM detection certified. | Not free at our volume. New GCP project to manage. |
| **AWS Rekognition `DetectModerationLabels`** | Hosted | 5k/month free for 12 months, then $1/1k | 300–700 ms | Detailed taxonomy that maps to our policy cleanly | Free tier expires; another vendor; another credential pair. |
| **Sightengine, Hive, Microsoft Content Moderator** | Hosted | Tiny free tiers (~500/month) | 200–500 ms | Best-in-class accuracy at the paid tier | Not free at our volume; not worth the extra integration. |

**Decision: OpenAI `omni-moderation-latest` as the primary, with `Falconsai/nsfw_image_detection` as an optional self-hosted second opinion for the *grey-zone band only* (see §14.5 for the two-stage flow).** 

Why:
1. **Free**, and the OpenAI key is already needed for §7 - zero new credential management.
2. **Per-category numeric scores** are essential for tuning around the "shirtless OK, nudity not OK" cut. Binary models cannot make that distinction.
3. **Dedicated `sexual/minors` category** - critical for legal compliance. None of the open-source NSFW models flag CSAM specifically; OpenAI's model has explicit signal on this.
4. **Calibration quality**: OpenAI publishes a paper benchmarking `omni-moderation-latest` against 40 categories on a held-out set; it materially outperforms older `text-moderation-007` on images and matches commercial NSFW classifiers (Hive, Sightengine) within a few percentage points.
5. The **two-stage flow** (§14.5) lets us add Falconsai as a *low-cost sanity check* only when OpenAI's score lands in the ambiguous band - this is the single highest-leverage trick for cutting false positives without slowing down the median upload.

On-device NSFWjs is **rejected** as a primary gate (bypassable) but could be added later as an optional client-side **pre-filter** that warns the user *before* upload ("this photo looks explicit, are you sure?"). Defer.

### 14.3 Where moderation runs in the upload pipeline

The current upload flow (from [`/api/secure/upload-url`](src/app/api/secure/upload-url/route.ts) and [`/api/secure/photos`](src/app/api/secure/photos/route.ts)) is:

```
1. Client picks file → compressProfilePhoto() compresses + strips EXIF
2. Client → POST /api/secure/upload-url   → returns signed Supabase URL
3. Client → PUT directly to Supabase Storage signed URL
4. Client → POST /api/secure/photos       → inserts DB row pointing at storage_path
```

Moderation slots in at step **4**, server-side, **after** the file is in storage but **before** the DB row is created. This is the right place because:
- The file is now at a stable URL we can pass to OpenAI (no need to base64 it).
- If the verdict is "block", we delete the storage object and return 422 to the client - the participant sees a friendly error and the file never becomes visible.
- Moderation latency (~500 ms) is paid once per photo, not on every read.

New endpoint flow:

```
POST /api/secure/photos
  ├─ existing: validate path ownership, photo count limit
  ├─ NEW:      call moderateImage(storage_path) → { allowed, scores, categories }
  │            if !allowed: delete storage object, log to moderation_log, return 422
  │            with a localised "image rejected" message + the violated category
  └─ existing: insert participant_photos row
```

Chat images get the same treatment in `POST /api/secure/messages` when `type='image'`.

### 14.4 Thresholds - per-surface, score-based, with a grey-zone band

The model returns a number 0–1 per category. We define **three bands per category**:
- **Allow band** (score below `allow_max`): immediate pass, no further checks, log the score.
- **Grey band** (between `allow_max` and `block_min`): allowed for the user, but routed to the admin shadow-review queue *and* triggers the second-opinion model (§14.5). Photo goes live; admin can retroactively hide if confirmed.
- **Block band** (score above `block_min`): blocked outright, storage object deleted, 422 returned.

The `block_min` thresholds are intentionally high - we'd rather a few explicit photos slip into shadow-review than reject swimwear photos. The grey band is the safety net for borderline calls.

#### Profile photos (strict)

| Category | `allow_max` | `block_min` | Notes |
|---|---|---|---|
| `sexual/minors` | `0.02` | `0.05` | Hard floor. Anything in the grey band here also auto-flags the participant. |
| `sexual` | `0.55` | `0.85` | Calibrated against published `omni-moderation` distributions: swimwear/cleavage 0.15–0.40, lingerie 0.40–0.60, partial nudity 0.55–0.80, explicit nudity 0.85+. The 0.85 floor means we only block when the model is very confident. |
| `violence/graphic` | `0.40` | `0.70` | Blood, gore. |
| `self-harm` | `0.30` | `0.60` | Cuts, etc. |
| `illicit/violent` | `0.40` | `0.70` | Weapons-with-intent. |

#### Chat images (loose)

| Category | `allow_max` | `block_min` | Notes |
|---|---|---|---|
| `sexual/minors` | `0.02` | `0.05` | Same hard floor. The one thing we never compromise on. |
| `sexual` | `1.01` | `1.01` | **Not enforced.** Adult content in 1:1 chat between matched participants is allowed. |
| `violence/graphic` | `0.50` | `0.85` | Still blocked, but only at very high confidence. |
| `self-harm` | `0.40` | `0.75` | Same logic. |
| `illicit/violent` | `0.50` | `0.85` | Same. |

`hate`, `harassment`, `illicit` (non-violent) are **logged but not blocked** at the image layer in either surface - text moderation is a separate concern handled at message-send time (out of scope here, but worth noting).

Both threshold sets live in `src/lib/moderation/thresholds.ts` as exported constants so they can be tuned without a code-change cascade across the codebase. Threshold history is recorded so we can attribute any change in block rate to a specific commit.

### 14.5 Implementation - two-stage flow, surface-aware

The pipeline always runs the OpenAI call. The second-opinion model (Falconsai) runs **only when the OpenAI score lands in the grey band** for the `sexual` category on profile photos. This adds ~150 ms only to grey-band uploads (an estimated <5% of all uploads) and significantly reduces false positives, because the only blocks that happen are those where *both* models agree.

```
Upload pipeline (profile photo, strict surface):

  storagePath in
      │
      ▼
  signed read URL (5 min)
      │
      ▼
  POST openai.com/v1/moderations  (omni-moderation-latest)
      │
      ▼
  scores = { sexual: 0.62, sexual/minors: 0.01, … }
      │
      ├─ ALLOW band (< allow_max)        → verdict=allowed, store log, return
      ├─ BLOCK band (> block_min)        → verdict=blocked, delete storage, return 422
      └─ GREY band                       → second-opinion check (Falconsai)
                                              │
                                              ├─ second model also flags → verdict=blocked
                                              └─ second model passes    → verdict=shadow_review,
                                                                          photo goes live,
                                                                          admin sees in queue
```

Chat images skip the second-opinion call entirely - only `sexual/minors`, `violence/graphic`, `self-harm`, `illicit/violent` are even checked, and the second model wouldn't help on those categories anyway (Falconsai is a single-axis NSFW detector).

```ts
// src/lib/moderation/index.ts
import { createSignedReadUrl } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { PROFILE_THRESHOLDS, CHAT_THRESHOLDS } from './thresholds';
import { secondOpinion } from './falconsai';

export type Surface = 'profile_photo' | 'chat_image';
export type Verdict =
  | { decision: 'allowed';        scores: Record<string, number> }
  | { decision: 'blocked';        scores: Record<string, number>; reason: string; model: string }
  | { decision: 'shadow_review';  scores: Record<string, number>; reason: string };

export async function moderateImage(
  storagePath: string,
  surface: Surface,
): Promise<Verdict> {
  if (process.env.MODERATION_ENABLED !== 'true') {
    return { decision: 'allowed', scores: {} };          // local-dev stub
  }

  const url = await createSignedReadUrl('photos', storagePath, 300);
  const scores = await callOpenAI(url);
  if (!scores) return { decision: 'allowed', scores: {} }; // fail-open, see §14.7

  const thresholds = surface === 'profile_photo' ? PROFILE_THRESHOLDS : CHAT_THRESHOLDS;

  // 1. Hard blocks (sexual/minors, etc.) - highest priority, no second opinion.
  for (const [cat, { block_min }] of Object.entries(thresholds.hard)) {
    if ((scores[cat] ?? 0) > block_min) {
      return { decision: 'blocked', scores, reason: cat, model: 'openai' };
    }
  }

  // 2. Soft (sexual) on profile - grey-band uses second opinion.
  if (surface === 'profile_photo') {
    const sexual = scores['sexual'] ?? 0;
    const { allow_max, block_min } = thresholds.soft.sexual;
    if (sexual > block_min) {
      return { decision: 'blocked', scores, reason: 'sexual', model: 'openai' };
    }
    if (sexual > allow_max) {
      // Grey band - second opinion before we block.
      const confirmed = await secondOpinion(url);  // returns true if Falconsai also says nsfw
      if (confirmed) {
        return { decision: 'blocked', scores, reason: 'sexual', model: 'openai+falconsai' };
      }
      return { decision: 'shadow_review', scores, reason: 'sexual' };
    }
  }

  return { decision: 'allowed', scores };
}

async function callOpenAI(imageUrl: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: imageUrl } }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      logger.error('[MODERATION] OpenAI error', { status: res.status });
      return null;
    }
    const data = await res.json();
    return data.results[0]?.category_scores ?? null;
  } catch (err) {
    logger.error('[MODERATION] OpenAI fetch failed', { err: String(err) });
    return null;
  }
}
```

The second-opinion module is small and isolated so it can be swapped (or disabled via env var) without touching the orchestration:

```ts
// src/lib/moderation/falconsai.ts
// Calls a self-hosted Falconsai/nsfw_image_detection endpoint.
// In v1 we host this on a tiny Fly.io / Modal / Vercel-Edge worker; the URL is in
// FALCONSAI_ENDPOINT. If unset, secondOpinion() returns null and the grey-band
// verdict falls through to shadow_review (the safe default).

export async function secondOpinion(imageUrl: string): Promise<boolean | null> {
  if (!process.env.FALCONSAI_ENDPOINT) return null;
  try {
    const res = await fetch(process.env.FALCONSAI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();   // { label: 'nsfw'|'normal', score: 0–1 }
    return data.label === 'nsfw' && data.score > 0.85;
  } catch {
    return null;
  }
}
```

Hosting Falconsai is cheap: the model is ~340 MB; a single Fly.io 1x-shared CPU machine or a Modal serverless function handles tens of QPS at zero monthly cost in the free tier. For v1 we can also skip self-hosting and call HuggingFace Inference API directly (free up to the rate limit), accepting that grey-band calls will fall through to `shadow_review` when the rate limit hits - which is exactly the safe behaviour.

### 14.6 New table - `moderation_log`

```sql
CREATE TABLE moderation_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid REFERENCES events(id) ON DELETE CASCADE,
  participant_id     uuid,
  surface            text NOT NULL,        -- 'profile_photo' | 'chat_image' | 'background'
  storage_path       text NOT NULL,
  decision           text NOT NULL,        -- 'allowed' | 'blocked' | 'shadow_review' | 'deferred'
  reason             text,                 -- category that triggered (null when allowed)
  scores             jsonb NOT NULL,       -- raw OpenAI per-category scores
  second_opinion     jsonb,                -- { label, score } when Falconsai ran, else null
  model              text NOT NULL,        -- 'openai' | 'openai+falconsai' | 'none'
  admin_overridden   boolean NOT NULL DEFAULT false,
  admin_action       text,                 -- 'kept' | 'removed' - set when admin reviews
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_modlog_event_decision ON moderation_log(event_id, decision, created_at);
CREATE INDEX idx_modlog_review_queue   ON moderation_log(event_id, created_at)
  WHERE decision = 'shadow_review' AND admin_action IS NULL;
```

All decisions (allowed, blocked, shadow_review, deferred-on-error) are logged - required for:
- Admin spot-checks ("why did this photo get through / blocked?").
- Threshold tuning: query the `sexual`-score histogram over a few events and confirm the 0.55 / 0.85 cuts produce the block rate we expect (<1% blocked, <3% in grey band).
- Repeat-offender detection (a participant whose first 3 uploads are blocked is probably trying to game the policy → auto-flag for admin).
- **False-positive feedback loop**: every time an admin reviews a shadow-queue item and marks `kept` ("this was fine"), we have a labelled negative example we can use to argue for raising `block_min`.

### 14.7 Failure modes

OpenAI being down should **not** brick uploads at a live event. Strategy:

- **Fail-open with logging** (default): if the API errors or times out (>6 s), allow the upload but log a `moderation_log` row with `verdict='allowed'` and `reason='api_error'`. A daily cron re-runs moderation on all such rows and retroactively hides flagged photos.
- **Fail-closed mode** (opt-in per event): for high-profile events the admin can flip `events.moderation_strict=true` and API errors will reject the upload.

Default fail-open is the right choice: an event happens once, and refusing legitimate uploads because of a vendor outage is a worse outcome than briefly hosting a borderline photo that will be re-checked within 24 h.

### 14.8 Repeat-offender ban

When 3+ uploads from the same participant in the same event are blocked within 1 hour:
- Auto-flag the participant in admin (`participants.flagged_for_review=true`).
- Show a generic "your account is under review" toast on next upload attempt.
- Admin reviews and either clears the flag or bans (existing ban flow).

### 14.9 UX on rejection

The client gets a 422 with a localised, non-graphic, non-accusatory message:
- `he`: "לא הצלחנו לעבד את התמונה. נסו תמונה אחרת או פנו אלינו."
- `en`: "We couldn't process this photo. Please try another or contact us."

Deliberately phrased as a *processing failure*, not a moral judgement. Reasons:
1. The number-one outcome we're optimising against is false positives - if the user *was* in fact innocent, the last thing we want is for the app to imply they uploaded something inappropriate.
2. The message gives a path forward ("contact us") so a genuinely-blocked-in-error user can escalate to admin without humiliation.
3. No mention of *which* category triggered the block (avoids gaming).
4. Repeat offenders see escalation behaviour (§14.8) but **the same neutral message**.

### 14.10 Performance impact

- Latency added to `POST /api/secure/photos` (profile, common path): ~400–700 ms (one OpenAI round-trip).
- Latency in the grey-band path: +150–300 ms for the second-opinion call. This fires on an estimated <5% of uploads.
- Latency added to `POST /api/secure/messages` for chat image (loose): ~400–700 ms (only the OpenAI call; no second opinion).
- All moderation is sandwich-async to the user's perception - we show a "מעלה תמונה…" / "Processing photo…" state immediately and the moderation happens during it. Net feel: ~1 second from tap to visible, instead of ~600 ms before. Acceptable.
- No impact on read paths.
- Storage: one `moderation_log` row per upload (~400 bytes including scores JSON). For a 200-person event with ~5 photos average that's 1 000 rows / event. Auto-purged with event cleanup.

### 14.11 Privacy

- The image is sent to OpenAI for evaluation. Mention this explicitly in the privacy policy + on the upload screen ("photos are scanned by an automated safety system before going live"). OpenAI moderation endpoint inputs are not used for training per their terms.
- Score data is stored alongside the moderation log and purged with the event.

### 14.12 Admin tooling

A new "Moderation" tab in the admin event detail with two queues:

**Shadow-review queue** (the primary admin surface):
- Every `decision='shadow_review'` row, newest first.
- Thumbnail + `sexual` score + which surface (profile/chat) + participant name.
- Two-button action: **Keep** (sets `admin_action='kept'`, photo stays live) or **Remove** (sets `admin_action='removed'`, deletes the participant_photos row and the storage object).
- This is the loop that lets us calibrate - if 95% of shadow-review items are getting "Keep", we know `allow_max` is too low and we should raise it.

**Blocked queue** (for false-positive recovery):
- Every `decision='blocked'` row from the last 7 days.
- Storage object was already deleted, so no thumbnail - only score + participant. Useful for: "this participant complained their photo was blocked". Admin can clear their `flagged_for_review` flag and the participant can re-upload.

Threshold tuning UI: admin-global, not per-event in v1. Two number inputs per category (`allow_max`, `block_min`) with a preview chart showing the score distribution from the last 30 days of `moderation_log` and a marker line at the current cuts - makes it visually obvious whether a proposed change would block more legitimate-looking content.

### 14.13 Rollout phase

This becomes **Phase 6** in §11, after Phase 5 (client report). It depends only on the OpenAI key (already added in Phase 5), so it can ship right after.

The rollout is itself two-stage to minimise false-positive damage:
1. **Shadow mode** (week 1, one event): `MODERATION_ENABLED=true` but the orchestrator returns `decision: 'shadow_review'` for *everything* that would have been blocked. Nothing gets blocked, but we collect a full distribution of scores from real Eventa traffic. Admin reviews the would-have-been-blocked items - if any are false positives, we raise `block_min` before going live.
2. **Enforcement** (week 2 onwards): real blocking enabled. Shadow-review queue continues to operate for the grey band.

Falconsai second-opinion can ship in phase 6 or be deferred to 6.1 - the system works (with shadow-review fallback) without it.

---

## 15. Realtime smoothness, latency & low-bandwidth stability audit

This is a from-scratch read of every file involved in keeping the app feeling instant in a crowded venue with bad WiFi. Findings are listed in **descending priority**: the first three are the only ones likely to bite us at a real event, the rest are polish.

### 15.1 The four real risks at a live event

| # | Risk | What goes wrong | Fix |
|---|---|---|---|
| **A** | **Storage CDN latency for the photo grid** | Grid renders 50 + 3:4 cards; each is a fetch to Supabase Storage. On 3G in a hall, first paint can take 5–15 s. We do not currently use Supabase Storage's image-transformation endpoint with sized URLs. | §15.2 |
| **B** | **No optimistic UI for the action that defines the product** - the **like** | `handleLike` round-trips to the API before the heart fills. On bad WiFi this is the difference between "snappy app" and "broken app". The optimistic pattern is already used in chat (see [`handleSend`](src/app/dating/[eventSlug]/chat/[conversationId]/page.tsx#L235)) but not in likes, grid, swipe. | §15.3 |
| **C** | **Realtime fallback is too slow when WebSocket dies silently** | `RealtimeHub` reconnects on `visibilitychange` + `online` events, but a 4G→WiFi handoff inside a venue produces neither. Polling fallback runs every 15 s. So worst case a match notification is delayed 15 s - long enough for the user to give up. | §15.4 |
| **D** | **Image uploads block the chat input** | `handleImageUpload` runs compression on the main thread (web worker is off - `useWebWorker: false` in [image-compression.ts](src/lib/image-compression.ts#L91)). For a 10 MB iPhone HEIC, compression can freeze the UI for 2–4 s. | §15.6 |

Everything else is incremental - the four above are the ones I would prioritise.

### 15.2 Photo grid: variant URLs, dimension-correct loading, skeletons that match

**Findings**:
- Current grid loads the full-resolution profile photo (up to 2048 px, 2 MB) into a 3:4 card that renders at roughly 120 px wide on a phone. That's 17× more pixels than displayed, on the most bandwidth-constrained surface in the app.
- `<Image>` from Next.js *is* used in some places (e.g. landing) but the grid uses `<img>` directly in several spots - bypasses Next's automatic responsive sizing.
- The skeleton placeholder isn't always the same aspect ratio as the loaded photo → layout shift when images arrive.

**Fix**:
1. **Use Supabase Storage image transformations** (Supabase supports `?width=` and `?height=` on storage URLs when image-transform is enabled on the project - check `supabase/config.toml`; if not enabled, enable it). Build a `getPhotoUrl(path, { width, dpr })` helper. Grid card requests `width=300&quality=75` (≈ 25 KB per card instead of 200 KB+).
2. **Convert all grid `<img>` to `<Image fill sizes="(max-width: 480px) 33vw, 33vw" />`** so Next's image optimisation also kicks in with the Sharp pipeline. Even though Supabase serves the file, the Next loader will request the right size for the device.
3. **Preload the first 6 cards** of the grid with `<link rel="preload" as="image" imagesrcset="...">` in the head - they're above the fold.
4. **Aspect-locked skeletons**: every photo skeleton sets `aspect-ratio: 3/4` so there is zero CLS when the real photo loads.
5. **Blurhash or `placeholder="blur"` with a 32-byte LQIP** stored alongside each photo (compute on first upload in `POST /api/secure/photos`, store in `participant_photos.blurhash`).

Estimated impact on grid TTI in a venue: **5 s → 800 ms**.

### 15.3 Optimistic UI everywhere it matters

The chat already does this right. Apply the same pattern to:

**Like (the highest-impact one)**:
```
1. User taps heart on grid card.
2. UI: heart fills instantly, card gets the "you liked" badge, haptic if available.
3. Local state: optimistically insert into useLikesStore.sentLikes.
4. Network call fires in the background.
5. On 4xx/5xx: revert + toast "לא הצלחנו לשלוח את הלייק. נסו שוב".
6. On 409 (race - already liked): no-op (treat as success).
```

**Block**:
- Remove the blocked participant from the grid and chats list **before** the API responds. Stays out on failure (we toast and the participant reappears).

**Swipe (already mostly optimistic)**:
- Verify that the gesture-driven exit animation isn't waiting on any network call. It shouldn't be, but worth confirming with a slow-3G throttle.

**Mark-conversation-read**:
- Already fire-and-forget? Verify. Should be: dismiss unread badge instantly, fire `POST /conversations/read` in the background.

**Implementation cost**: small. Zustand stores already exist for likes, chats, notifications. Add a `pendingLikes` set keyed by `toParticipantId` so we can roll back on failure.

### 15.4 Realtime stability - closing the gaps

**Current state** (from [`realtimeHub.ts`](src/lib/realtimeHub.ts) and [`RealtimeNotificationListener.tsx`](src/components/RealtimeNotificationListener.tsx)):
- ✅ Ref-counted singleton channels (good - survives StrictMode).
- ✅ Reconnect on `visibilitychange` and `online` events.
- ✅ Polling fallback (15 s) with deduplication via `seenIds`.
- ✅ `seenIds` pruned after 5 min.

**Gaps**:

1. **No heartbeat on the WebSocket itself**. Supabase Realtime sends server-side heartbeats every 30 s, but if the *underlying TCP connection* dies (typical on cellular → WiFi handoff inside a venue), the channel state may stay `joined` for a long time before the server notices and closes it. We don't currently ping anything; we trust `channel.state`.
   
   **Fix**: in `RealtimeHub`, add a 20 s watchdog timer per channel. Every 20 s, check `channel.state`. If `state === 'joined'` but no event of any kind has arrived in the last 60 s, force a `removeChannel` + recreate. Conservative threshold; in practice for any active event there's at least one heartbeat / nearby event per minute.

2. **Polling fallback is 15 s** - this is the worst-case delay for any notification. Tighten to **8 s when the tab is visible**, keep 15 s when hidden. For likes/messages specifically, fall back to 5 s polling for the *3 minutes after* the WebSocket reports CLOSED (aggressive reconnect-and-poll burst).

3. **No "stale connection" indicator to the user**. We show "offline" when `navigator.onLine === false`, but we don't show anything when WiFi is fine but the realtime channel has been dead for 60 s. Should add a subtle yellow badge "מסנכרן…" / "Syncing…" in the header when this happens; reassures users that the app knows it's behind.

4. **The `tab visibility` polling pause skips one cycle on resume**. When the tab becomes visible, we resume polling but we don't force a "catch-up" poll immediately. Add: on `visibilitychange → visible`, fire a polling cycle immediately, then resume the regular cadence.

5. **`document.visibilityState` vs `pagehide` on iOS Safari**: iOS sometimes fires `pagehide` without `visibilitychange` when the user pulls the app card down. Currently we don't listen for `pagehide`. Add listeners for both `pagehide` and `pageshow` and treat them as visibility transitions.

6. **No backoff on failed reconnects**. The current reconnect is "immediate retry on visibility/online". If reconnection fails (server down for 30 s), we hammer. Add exponential backoff capped at 30 s with jitter.

### 15.5 Heartbeat & presence - small but worthwhile

The `HeartbeatPinger` currently fires immediately on mount + every 60 s when visible. Findings:
- ✅ Aborts in-flight requests on cleanup.
- ✅ Re-fires on `visibilitychange`.
- ❌ **No retry-on-failure**. If a heartbeat fails (typical at venue entrance with weak signal), the next attempt is 60 s later. For ban enforcement this is fine; for the new presence-based SMS in §6 it means a user could be marked "not in app" because two heartbeats failed.
  - Fix: on network failure, retry once after 5 s with jitter. Still no spam.
- ❌ The 60 s interval is not reset by user interactions. If user is actively scrolling/tapping (clearly in the app) but the tab was hidden 59 s ago, the next heartbeat fires on its old schedule. Minor, but for crowded venues with bad sleep behaviour it matters.
  - Fix: reset the interval on `visibilitychange → visible`.

### 15.6 Image upload smoothness

**Current**:
- Compression runs on the main thread (`useWebWorker: false`). Comment says this is intentional - but the comment doesn't explain why. Investigate: was it because `browser-image-compression` Web Worker mode breaks Safari? If yes, gate `useWebWorker: !isSafari`. If we can't get a worker safely, at least chunk the work and `await` between steps so the spinner can paint.
- HEIC files from iPhones are not always natively decodable. The current code relies on the browser's `<img>` to read dimensions, which fails for HEIC on non-Safari browsers. We have HEIC in `ALLOWED_EXTENSIONS` but no conversion path. Either drop HEIC from the allowed list (force the iOS share sheet to convert to JPEG, which it does when the target says "JPEG only") or pre-process HEIC with a worker-based decoder. Recommendation: **drop HEIC**, simpler.
- No **upload progress bar**. The signed URL upload uses `fetch` (no progress events). Replace with `XMLHttpRequest` for the upload step so we can show a 0–100 % progress bar. This single change makes the upload *feel* 2× faster on slow connections.
- No **retry on upload failure**. If the Supabase Storage PUT fails mid-upload (very likely at venue), the user has to start over. Add automatic retry (3 attempts with exponential backoff) and surface "מנסה שוב…" mid-attempt.

### 15.7 Network resilience layer (one place to put all this)

Right now retry/timeout logic is scattered (some endpoints catch+ignore, some retry, most don't). Introduce a tiny `fetchWithRetry` helper used by every API client function in [src/lib/api/](src/lib/api/):

```ts
fetchWithRetry(url, init, {
  retries: 3,
  backoffMs: [400, 1200, 3000],   // with ±25% jitter
  retryOn: [408, 429, 500, 502, 503, 504, 'NetworkError'],
  timeout: 12_000,
});
```

Migration is mechanical: replace `fetch(` with `fetchWithRetry(` in `src/lib/api/*`. For mutations that aren't idempotent (POSTs without an idempotency key), don't retry on network errors - toast and let the user retry manually. For idempotent ones (PATCH /profile with the same body, DELETE /likes) we retry safely. For new endpoints introduced in §6 (`pending_sms`) we already use idempotency-by-design (DB row with status).

Add an `Idempotency-Key` header (UUID generated client-side) to POST /likes and POST /messages so the server can dedupe replays from retries. Server-side: a small Postgres-backed dedupe (key + result for 60 s) prevents duplicate likes / duplicate messages on retry.

### 15.8 Bundle & boot - the first 1 000 ms

| Surface | Current | Target | How |
|---|---|---|---|
| **First contentful paint on `/[eventSlug]/`** | TTI ~1.8 s on mid-tier Android | <1.0 s | Already mostly there - dynamic imports for `MatchPopup` are good. Add `dynamic()` for `RealtimeNotificationListener` too - it doesn't need to be in the initial bundle. |
| **`/join` first paint** | ~1.5 s | <800 ms | This is server-renderable (we don't yet). Move OTP form to RSC + a small client island for the OTP input itself. |
| **Realtime hub** | ~40 KB gzipped (`@supabase/realtime-js`) | unchanged | Verify it's not loaded on `/` or `/order` (it should only load inside `[eventSlug]/`). Currently the Supabase client import is module-level and may pull realtime into every route's bundle. Audit and lazy-load. |
| **Framer Motion** | 50 KB gzip | 30 KB | Use `framer-motion/m` modular imports + LazyMotion wrapper instead of full Motion. Already partly done. |

### 15.9 Caching strategy - the service worker is too conservative

The current `sw.ts` ([src/app/sw.ts](src/app/sw.ts)) sets `NetworkOnly` for `/api/admin`, `/api/auth`, `/api/secure`, `/api/account`, `/api/cleanup`, `/api/health`. That's correct for *writes* and *auth*, but it makes **reads** also network-only, which is the wrong default at a venue.

**Fix**:
- Split the rules. Specifically allow `StaleWhileRevalidate` (max-age 30 s) for the read-only secure GETs that are safe to serve briefly stale:
  - `GET /api/secure/participants` (the grid roster) - fine to serve last cache for 30 s on cold WiFi; the realtime channel will catch up.
  - `GET /api/secure/conversations`
  - `GET /api/secure/messages` (small window - 10 s SWR - and only by exact URL match, not pattern, to avoid leaks between conversations).
- **Profile/photo image responses** from Supabase Storage: cache them with `CacheFirst`, expiration 7 days, max 200 entries. Currently they fall to `defaultCache` from Serwist which is reasonable but not tuned. Photos rarely change, and re-downloading 30 grid photos every cold start is the dominant data cost.

This single change probably halves the bytes downloaded for a returning user mid-event.

### 15.10 Animation jank checklist

Mostly polish, but cheap to fix:
- `will-change: transform` on the swipe card during drag (today it's likely not set, so Safari composites on the CPU).
- All entrance animations use `opacity + transform` (good), but the match popup's "heart rain" animates 10 absolutely positioned divs with `top` (CPU-bound). Replace `top` with `translateY`.
- The grid card hover scale (0.97) triggers layout if applied to anything but `transform`. Audit the CSS file for any `width`/`height`/`top`/`left` transitions on interactive elements and migrate to `transform`.

### 15.11 Monitoring - without this, the rest is theatre

You can't claim "smooth at a real event" if you can't see the data after the fact.

Use the new telemetry endpoint (§5.4) to ship:
- **Web Vitals** (LCP, FID/INP, CLS, TTFB) - sample at 10 % of pageviews.
- **Realtime channel health**: every channel that goes `CLOSED` unexpectedly emits a `realtime_disconnect` event with `reason` and `state`.
- **Polling vs WS delivery ratio**: for every notification we surface to the user, log which path delivered it. Target ratio: <5 % delivered via polling. If higher → WS health is bad.
- **API error rate per endpoint, p50/p95 latency** (already partly logged server-side; add client-side too).
- **SMS deliverability** from TextMe's webhook → into a Grafana board / Supabase dashboard.

In the admin global-analytics surface (§5), add a small "Reliability" sub-tab showing the last 7 days of these metrics. This becomes the *first* place we look after every event.

### 15.12 What does NOT need to change

- `RealtimeHub`'s ref-counting design (correct).
- The dual-fingerprint ban model (orthogonal).
- The cleanup cron (orthogonal).
- The basic message-bubble rendering pipeline.

### 15.13 Prioritised action list (for the realtime/stability bucket only)

In order of "stops a real bug at a real event" → "polish":

1. (§15.3) Optimistic likes - small change, biggest UX win.
2. (§15.6) HEIC drop + upload progress bar + upload retries.
3. (§15.2) Photo grid: sized URLs + blurhash + aspect-ratio skeletons.
4. (§15.4 #1–#2) Realtime watchdog + tighter polling cadence when visible.
5. (§15.7) `fetchWithRetry` + idempotency keys on POST `/likes` and POST `/messages`.
6. (§15.9) Service worker tuning - SWR for safe GETs, CacheFirst for photo bytes.
7. (§15.5) Heartbeat retry-on-failure.
8. (§15.4 #3–#6) Stale-connection indicator, pagehide listener, backoff.
9. (§15.11) Telemetry shipping + admin reliability dashboard.
10. (§15.8, §15.10) Bundle & animation polish.

Items 1–4 are the ones that should ship before any large event with > 100 attendees on a constrained network.

---

*End of plan. Ready to begin Phase 0 on confirmation. Recommended first action: agree on the answers to §12, then I'll open the Phase 1 PR (combined route migration + i18n shell), since it's the highest-leverage step and touches the most files.*
