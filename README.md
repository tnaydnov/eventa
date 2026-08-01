<div align="center">

# Eventa

**Turn any live event into a social experience.**

A production-grade, mobile-first PWA that gives guests at a wedding, party or
meetup a private, event-scoped social layer — scan a QR code, build a profile in
under a minute, browse other guests, match, and chat in real time. No app store,
no account, no data left behind.

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![Security](../../actions/workflows/security.yml/badge.svg)](../../actions/workflows/security.yml)
[![CodeQL](../../actions/workflows/codeql.yml/badge.svg)](../../actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Next.js 16 · React 19 · TypeScript · Supabase · Tailwind CSS 4

</div>

---

## Table of contents

1. [What this is](#what-this-is)
2. [Feature tour](#feature-tour)
3. [Architecture at a glance](#architecture-at-a-glance)
4. [Tech stack](#tech-stack)
5. [Quick start](#quick-start)
6. [**Before you deploy — the checklist**](#before-you-deploy--the-checklist)
7. [Configuration reference](#configuration-reference)
8. [External services](#external-services)
9. [Database & migrations](#database--migrations)
10. [Project structure](#project-structure)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Security model](#security-model)
14. [Privacy & data retention](#privacy--data-retention)
15. [Localization & RTL](#localization--rtl)
16. [Contributing](#contributing)
17. [License & disclaimer](#license--disclaimer)

---

## What this is

Eventa is a complete, self-hostable SaaS product — not a demo. It contains the
guest app, the organizer purchase funnel, the payment/invoicing integration, an
admin back-office with live analytics and AI content moderation, a messaging
pipeline (SMS + e-mail), scheduled cron jobs, and an automated privacy-driven
data-deletion lifecycle.

Every guest session is **scoped to a single event**. Participants can only ever
see other participants of the same event, and roughly a week after the event
ends every piece of personal data is deleted automatically, leaving only
anonymous aggregate analytics behind.

> **Note on this repository**
> This project was built and operated as a real commercial service in Hebrew
> (RTL) for the Israeli market. It is published here as a portfolio /
> reference implementation. All operator-specific values — domain, contact
> details, legal entity, analytics IDs and every credential — have been removed
> and replaced with environment-driven placeholders. See
> [Before you deploy](#before-you-deploy--the-checklist).

---

## Feature tour

### For guests (mobile web, no install)

| | |
|---|---|
| **QR join** | Scan a printed poster or open a link. Device fingerprinting + a join code gate entry to the event. |
| **Phone verification** | 6-digit OTP over SMS, with per-phone, per-IP and global anti-SMS-pumping limits. Can be switched off for local dev. |
| **Sub-minute onboarding** | Photo upload with client-side WebP compression and touch cropping, plus name, age, gender, preference, city and bio. |
| **Discovery grid** | Virtualized, paginated grid of other attendees filtered by mutual preference. |
| **Likes & matches** | Mutual likes open a conversation and trigger a full-screen match celebration. |
| **Real-time chat** | Supabase Realtime with an offline outbox, optimistic sends and a polling fallback for flaky venue Wi-Fi. |
| **Safety** | Block, report, AI photo moderation, admin bans enforced on a 60-second heartbeat, hardware fingerprint blocklists. |
| **Install as PWA** | Serwist service worker, offline shell, add-to-home-screen. |
| **Post-event feedback** | Short survey, plus an optional success-story submission. |

### For organizers

- Public marketing site (landing, pricing, how-it-works, FAQ) with full SEO metadata, JSON-LD and a generated sitemap.
- Multi-step order wizard: event type → details → background artwork → poster template → guest messaging → summary.
- Checkout through an invoicing/payment provider, with webhook reconciliation and a nightly payment-reconciliation cron.
- Automatically generated printable A4 QR poster, e-mailed on approval.
- Client portal for uploading a guest phone list (XLSX/CSV) behind an explicit, versioned consent gate.
- Automated lifecycle e-mails: upload reminders, payment confirmation, post-event summary report (optionally with an AI-written narrative).

### For the operator (admin console)

- Event CRUD and lifecycle control: draft → active → paused → ended → archived.
- Live per-event analytics: funnel conversion, engagement over time, demographics, network graph metrics, safety metrics, and reliability/drop-off detection.
- Global cross-event analytics and revenue view.
- Moderation queue with dual-model AI screening and a nightly re-check sweep.
- Messaging console for pre-event and feedback campaigns.
- Invoice and order-request management.
- Password + optional TOTP 2FA, with a persisted admin audit log.

---

## Architecture at a glance

```mermaid
flowchart TB
    subgraph Client["Browser / PWA"]
        UI["Next.js App Router<br/>React 19 · Zustand · Tailwind 4"]
        SW["Serwist service worker"]
    end

    subgraph Edge["Next.js server (Vercel / Node)"]
        API["/api/* route handlers"]
        GUARD["secureGuard pipeline<br/>session · CSRF · rate limit · ban · event status"]
        CRON["/api/cron/* scheduled jobs"]
    end

    subgraph Data["Supabase"]
        PG[("PostgreSQL + RLS")]
        RT["Realtime (WebSocket)"]
        ST["Storage (photos, artwork)"]
    end

    subgraph External["Pluggable external services"]
        SMS["SMS provider"]
        MAIL["SMTP"]
        PAY["Payments / invoicing"]
        AI["AI moderation"]
        REDIS["Upstash Redis"]
    end

    UI --> API --> GUARD --> PG
    UI <--> RT
    UI --> ST
    SW -.precache.-> UI
    GUARD --> REDIS
    CRON --> PG
    CRON --> SMS
    CRON --> MAIL
    API --> PAY
    API --> AI
```

**Key design decisions**

- **One guard, one place.** Every authenticated API route runs through
  `secureGuard` in [src/lib/route-helpers.ts](src/lib/route-helpers.ts), which
  verifies the session JWT, checks CSRF/Origin, applies the rate limit tier,
  and short-circuits banned users and inactive events. Route handlers only
  contain business logic.
- **Anon key is read-only.** Row-Level Security scopes every table to a single
  event; all writes go through server routes holding the service-role key.
- **Realtime with a safety net.** A singleton realtime hub deduplicates
  subscriptions, auto-reconnects on resume, and silently degrades to polling.
- **Fail open on non-critical services.** Missing AI, SMS or Redis credentials
  degrade gracefully (stub / auto-approve / in-memory) instead of taking the app
  down. Missing *auth* secrets fail loudly.
- **Secrets are lazy.** `JWT_SECRET` is read through a getter so a build never
  crashes when runtime-only secrets are absent.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | SSR marketing pages for SEO, route handlers as the API, one deployable unit |
| UI | **React 19**, **Tailwind CSS 4**, **Framer Motion** | Concurrent rendering, utility CSS, gesture-driven swipe/match animations |
| State | **Zustand** (10 stores) | Tiny, persistable, no provider tree |
| Forms & validation | **React Hook Form** + **Zod** | Uncontrolled inputs for mobile perf; one schema shared by client and server |
| Backend | **Supabase** (PostgreSQL 17, Realtime, Storage) | Managed Postgres with RLS, WebSocket subscriptions and object storage in one service |
| Auth | Hand-rolled **HMAC-SHA256 JWT** sessions | Guests are anonymous, event-scoped identities — not Supabase Auth users |
| PWA | **Serwist** | Precaching, offline shell, installability |
| Charts / export | **Recharts**, **xlsx**, **jsPDF** | Admin analytics and report generation |
| E-mail | **Nodemailer** | Any SMTP provider |
| Tests | **Vitest** + Testing Library, **Playwright** | 106 unit/integration files, 28 E2E specs |
| Quality gates | ESLint, `tsc --noEmit`, CodeQL, `npm audit`, bundle-size budget, RLS coverage check | All wired into GitHub Actions |

Node **>= 20** is required (see [.nvmrc](.nvmrc)).

---

## Quick start

```bash
# 1. Clone and install
git clone <your-fork-url> eventa
cd eventa
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Generate the secrets the app needs
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log('FIELD_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('BLIND_INDEX_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
# paste the output into .env.local

# 4. Start a local Supabase stack (requires the Supabase CLI + Docker)
supabase start
supabase status            # copy API URL + anon key + service_role key into .env.local

# 5. Apply the schema, then every migration in order
psql "$DATABASE_URL" -f supabase/schema.sql
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done

# 6. Run it
npm run dev                # http://localhost:3000
```

**Minimum viable `.env.local` for local development** — everything else can stay
blank, and the corresponding feature will stub itself out:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
JWT_SECRET=<48+ random bytes>
ADMIN_PASSWORD=<at least 12 characters>
CRON_SECRET=<32+ random bytes>

# Skip SMS verification so you can join events without a live SMS provider
NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED=false
SMS_PROVIDER_LIVE=false
PAYMENT_PROVIDER_LIVE=false
```

Then visit:

| URL | What it is |
|---|---|
| `http://localhost:3000` | Marketing landing page |
| `http://localhost:3000/order` | Organizer order wizard |
| `http://localhost:3000/admin` | Admin console (log in with `ADMIN_PASSWORD`) |
| `http://localhost:3000/<event-slug>` | Guest app for a given event |

### Seed some demo data

```bash
node scripts/seed-demo-event.cjs    # demo event + 18 participants + likes/matches
node scripts/seed-fake-users.cjs    # adds 40 more participants (destructive)
```

Both read `.env.local` and require `SUPABASE_SERVICE_ROLE_KEY`. Never point them
at a production database.

### npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build + bundle budget check + service-worker path fix |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + integration, single run |
| `npm run test:watch` / `test:ui` | Vitest watch / UI |
| `npm run test:coverage` | V8 coverage report |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run perf:budget` | Fail the build if bundles exceed the size budget |
| `npm run perf:regression` | Fail if bundles regressed against the committed baseline |
| `npm run check:rls` | Fail if any table is created without Row-Level Security |

---

## Before you deploy — the checklist

This repository ships with **no credentials and no operator identity**. Work
through this list before you put it in front of real users.

### 1. Point it at your own infrastructure

- [ ] Create a **Supabase** project; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Apply `supabase/schema.sql`, then every file in `supabase/migrations/` **in numeric order**, then `supabase/production-setup.sql` and `supabase/migration-security.sql`.
- [ ] Create the `photos` and `backgrounds` storage buckets.
- [ ] Generate fresh `JWT_SECRET`, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, `BLIND_INDEX_KEY`. **Never reuse the sample commands' output from a screenshot or a shared machine.**
- [ ] Set `ADMIN_PASSWORD_HASH` (preferred) or a strong `ADMIN_PASSWORD`, and ideally `ADMIN_TOTP_SECRET`.

### 2. Rebrand — everything lives in one file

All brand, domain, contact and legal values are resolved in
**[src/config/site.ts](src/config/site.ts)** from `NEXT_PUBLIC_*` variables.
Nothing else in `src/` hardcodes a domain, e-mail, phone number or company name.

- [ ] `NEXT_PUBLIC_SITE_URL` — your canonical origin. This drives canonical tags, the sitemap, `robots.txt`, Open Graph, QR/join links, e-mail links **and the JWT `iss` claim**.
- [ ] `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_BRAND_DESCRIPTION`.
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_FACEBOOK_URL` — **anything left blank is hidden from the UI entirely**, including footer icons, the FAQ contact section, legal-page contact blocks and `security.txt`.
- [ ] `NEXT_PUBLIC_LEGAL_ENTITY_NAME` / `NEXT_PUBLIC_LEGAL_ENTITY_FORM` — the entity printed on the terms, privacy, cookies and B2B pages.
- [ ] Replace the brand artwork in `public/icons/`, `public/og-image.png` and `public/favicon.ico`.
- [ ] Update `public/manifest.json` (`name`, `short_name`, theme colours).
- [ ] Replace or remove the marketing imagery in `public/demo/`, `public/templates/` and `public/entrance_scanning.png` if you do not have rights to it.

### 3. Review the legal pages — seriously

> ⚠️ **The bundled Hebrew terms, privacy policy, cookie policy, accessibility
> statement and B2B agreement are templates written for an Israeli sole trader.
> They are not legal advice and they are not valid for your business as-is.**

- [ ] Have a lawyer review `/terms`, `/privacy`, `/cookies`, `/accessibility`, `/business-terms` for your jurisdiction (GDPR, CCPA, local consumer law…).
- [ ] Bump the version constants in [src/lib/legal-versions.ts](src/lib/legal-versions.ts) whenever substantive text changes — consent records store the version that was accepted.
- [ ] Check the pricing, VAT rate and refund policy referenced in the code and copy.

### 4. Wire up the services you actually want

Each is optional and stubs itself out when unconfigured — see
[External services](#external-services).

- [ ] SMS provider (needed for real OTP delivery), then set `SMS_PROVIDER_LIVE=true`.
- [ ] SMTP credentials for transactional e-mail.
- [ ] Payment/invoicing provider, then set `PAYMENT_PROVIDER_LIVE=true`.
- [ ] `OPENAI_API_KEY` (and optionally Falconsai) for photo moderation. **Without it every uploaded photo is auto-approved.**
- [ ] Upstash Redis for durable rate limiting across serverless instances.
- [ ] `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GA_MEASUREMENT_ID` only if you want analytics — no tag is injected when both are blank.

### 5. Harden

- [ ] Confirm `.env.local` is **not** committed (it is git-ignored; verify with `git status`).
- [ ] Rotate every credential if this repo was ever public with real values.
- [ ] Review the CSP allowlist in [next.config.js](next.config.js) and remove any third-party domain you do not use.
- [ ] Read [docs/SECURITY.md](docs/SECURITY.md) and triage the open items for your risk profile.
- [ ] Enable GitHub Code Scanning so the bundled CodeQL workflow reports results.

---

## Configuration reference

Every variable is documented inline in **[.env.example](.env.example)**. Summary:

| Group | Variables | Required? |
|---|---|---|
| **Branding & identity** | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_BRAND_DESCRIPTION`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_CONTACT_PHONE_DISPLAY`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_LEGAL_ENTITY_NAME`, `NEXT_PUBLIC_LEGAL_ENTITY_FORM`, `NEXT_PUBLIC_ACCESSIBILITY_CONTACT_NAME` | `SITE_URL` required in production; rest optional |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Required** |
| **Auth & secrets** | `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH`, `ADMIN_TOTP_SECRET`, `ADMIN_AUDIT_PERSIST`, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, `FIELD_ENCRYPTION_KEY_OLD`, `BLIND_INDEX_KEY`, `OTP_PEPPER`, `SECURITY_ALERT_WEBHOOK_URL` | `JWT_SECRET` required; `CRON_SECRET` required for cron |
| **Rate limiting** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional (falls back to in-memory) |
| **E-mail** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_NOTIFICATION_EMAIL` | Optional |
| **SMS** | `SMS_PROVIDER_LIVE`, `TEXTME_API_TOKEN`, `TEXTME_USERNAME`, `TEXTME_SENDER_NAME` | Optional (stubbed) |
| **Payments** | `PAYMENT_PROVIDER_LIVE`, `INVOICE4U_API_TOKEN`, `INVOICE4U_API_URL` | Optional (stubbed) |
| **AI moderation** | `OPENAI_API_KEY`, `FALCONSAI_ENDPOINT`, `FALCONSAI_TOKEN` | Optional (fails open) |
| **Feature flags & tuning** | `NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED`, `OTP_LENGTH`, `OTP_EXPIRY_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_PER_PHONE_PER_HOUR`, `OTP_GLOBAL_MAX_PER_DAY`, `LOG_LEVEL` | Optional |
| **Analytics** | `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional |

Non-public tunables (cache TTLs, price, session lifetimes, messaging timings)
live in [src/lib/config.ts](src/lib/config.ts).

> **`NEXT_PUBLIC_*` variables are inlined into the browser bundle at build time.
> Never put a secret in one.** A CI job fails the build if any file marked
> `'use client'` references a server-only secret.

---

## External services

Every integration is isolated behind a single adapter module, so swapping a
provider means editing one file — not hunting through route handlers.

| Service | Purpose | Adapter | Behaviour when unconfigured |
|---|---|---|---|
| **Supabase** | Database, RLS, Realtime, Storage | [src/lib/supabase.ts](src/lib/supabase.ts) | **Hard requirement** |
| **SMS** (TextMe adapter) | OTP codes, guest notifications | [src/lib/messaging/sms-provider.ts](src/lib/messaging/sms-provider.ts) | Logs the message and returns success — nothing is sent |
| **SMTP** (Nodemailer) | Order, invoice, reminder and report e-mail | [src/lib/mailer.ts](src/lib/mailer.ts) | Sends are skipped and logged |
| **Invoice4U** | Checkout, invoices, receipts, refunds | [src/lib/invoice4u.ts](src/lib/invoice4u.ts) | Checkout is stubbed |
| **OpenAI** | Photo/text moderation, AI report summaries | [src/lib/moderation/moderator.ts](src/lib/moderation/moderator.ts), [src/lib/report/ai-summary.ts](src/lib/report/ai-summary.ts) | Photos auto-approve; AI summary omitted |
| **Falconsai** | Second-opinion NSFW classifier | [src/lib/moderation/falconsai.ts](src/lib/moderation/falconsai.ts) | Borderline photos go to manual review |
| **Upstash Redis** | Distributed rate limiting | [src/lib/rate-limit.ts](src/lib/rate-limit.ts) | In-memory limiter (resets on cold start) |
| **Security webhook** | Slack/Discord security alerts | [src/lib/security-alert.ts](src/lib/security-alert.ts) | Alerts go to the logger only |

**Swapping the SMS or payment provider** — implement the same interface in a new
module, point the import at it, and keep the `*_PROVIDER_LIVE` flag so a
misconfiguration degrades to a stub instead of throwing at runtime.

---

## Database & migrations

- `supabase/schema.sql` — base schema: `events`, `participants`, `participant_photos`, `conversations`, `messages`, `likes`, `blocks`, `notifications`, `banned_devices`, `activity_log`, `event_analytics_snapshots`, `event_feedback`.
- `supabase/migrations/001…047` — 49 incremental migrations adding orders and invoicing (`event_requests`, `invoices`, `discount_claims`), messaging (`message_log`, `pending_sms`, `sms_optout`, `sms_quotas`, `event_guest_phones`), moderation (`moderation_log`, `moderation_review_queue`), observability (`event_errors`, `event_vitals`, `funnel_events`, `cron_heartbeats`, `event_reliability_metrics`), consent records (`participant_consents`), the client portal (`client_portal_tokens`), OTP storage (`otp_verifications`), and application-level PII encryption (046/047).
- `supabase/production-setup.sql`, `supabase/migration-security.sql` — production hardening (RLS policies, grants, indexes).

**Apply order:** `schema.sql` → `migrations/*.sql` in numeric order → `production-setup.sql` → `migration-security.sql`.

### Row-Level Security

The anon role is effectively **read-only and event-scoped**. Clients send an
`x-event-id` header; a SQL helper reads it and RLS policies restrict every row
to that event. All writes are performed by server routes using the service-role
key, after `secureGuard` has authenticated the caller.

`npm run check:rls` fails CI if any migration creates a table without enabling
RLS.

### PII encryption

Phone numbers and e-mail addresses are encrypted at the application layer with
AES-256-GCM (`FIELD_ENCRYPTION_KEY`) and made searchable via HMAC blind indexes
(`BLIND_INDEX_KEY`). After applying migration `046`, run:

```bash
npx dotenv -e .env.local -- node scripts/backfill-pii.cjs
```

The script is idempotent. `FIELD_ENCRYPTION_KEY_OLD` lets you rotate keys
without downtime.

---

## Project structure

```
├── src/
│   ├── config/
│   │   └── site.ts              ← ★ the ONLY file to edit when rebranding
│   ├── app/
│   │   ├── page.tsx             marketing landing page
│   │   ├── layout.tsx           root layout, metadata, analytics tag
│   │   ├── sitemap.ts, robots.ts, .well-known/security.txt
│   │   ├── pricing/ how-it-works/ faq/          marketing pages
│   │   ├── terms/ privacy/ cookies/ accessibility/ business-terms/   legal pages
│   │   ├── order/               organizer purchase wizard
│   │   ├── [eventSlug]/         guest app: join · setup · grid · likes · chats · profile · feedback
│   │   ├── guest-upload/        client guest-list portal
│   │   ├── admin/               admin SPA: events · analytics · moderation · invoices · messaging
│   │   └── api/                 route handlers (auth, secure, admin, cron, order, payment, …)
│   ├── components/              shared UI (header, tab bar, toasts, cropper, OTP input, …)
│   ├── hooks/                   useAppResume · useFocusTrap · useRealtimeHub
│   └── lib/
│       ├── route-helpers.ts     secureGuard request pipeline
│       ├── session.ts           guest JWT sessions
│       ├── admin-auth.ts        admin JWT + TOTP
│       ├── rate-limit.ts        sliding-window limiter (Redis or memory)
│       ├── field-crypto.ts      AES-GCM field encryption + blind index
│       ├── realtimeHub.ts       singleton realtime manager
│       ├── logger.ts            structured logging with PII redaction
│       ├── analytics/           funnel · engagement · network · safety · time dynamics
│       ├── api/                 typed client-side API wrappers
│       ├── messaging/           SMS provider, templates, phone utils
│       ├── moderation/          OpenAI + Falconsai orchestration and policy
│       ├── report/              post-event PDF/HTML reports + AI summary
│       └── stores/              10 Zustand stores
├── supabase/                    schema, 49 migrations, production hardening
├── scripts/                     seeding, PII backfill, perf budgets, RLS coverage
├── __tests__/                   unit · integration · e2e
├── docs/                        ARCHITECTURE · CODING_STANDARDS · SECURITY · TEST_PLAN
└── .github/workflows/           ci · security · codeql
```

---

## Testing

| Suite | Runner | Files | Scope |
|---|---|---|---|
| Unit | Vitest + Testing Library (jsdom) | 77 | lib functions, components, hooks, stores |
| Integration | Vitest (node env) | 29 | API route handlers against a mocked Supabase |
| End-to-end | Playwright | 28 | Full journeys on mobile Chrome, mobile Safari and desktop Chrome |

```bash
npm test              # unit + integration
npm run test:coverage # with V8 coverage
npm run test:e2e      # Playwright (start the dev server first)
```

CI runs typecheck → unit/integration tests → production build → bundle
regression check on every push and pull request. The test strategy and case
matrix live in [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

---

## Deployment

### Vercel (what the repo is tuned for)

1. Import the repository into Vercel.
2. Add every variable from your `.env.local` under **Settings → Environment Variables**.
3. Deploy. [vercel.json](vercel.json) already configures the region, per-route
   function timeouts, service-worker cache headers, and **ten cron jobs**:

   | Schedule | Job |
   |---|---|
   | `0 3 * * *` | Auto-archive finished events |
   | `0 4 * * *` | Retention cleanup — snapshot analytics, then delete personal data |
   | `0 7 * * *` | Guest-list upload reminders |
   | `0 * * * *` | Pre-event messages · feedback messages · report delivery |
   | `* * * * *` | Dispatch queued SMS |
   | `*/15 * * * *` | Re-check moderated photos |
   | `0 5 * * *` | Reconcile payments |
   | `0 */6 * * *` | Clean orphaned storage objects |

   Vercel injects `CRON_SECRET` automatically; every cron route rejects requests
   without it.

### Self-hosting

`npm run build && npm start` behind any Node 20+ runtime works. You then need to
drive the cron endpoints yourself — e.g. from `cron` or a scheduler — sending
`Authorization: Bearer $CRON_SECRET`:

```cron
0 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cleanup
```

---

## Security model

| Control | Implementation |
|---|---|
| **Session auth** | HMAC-SHA256 JWT in an `HttpOnly`, `Secure`, `SameSite` cookie, with an epoch claim enabling instant server-side revocation |
| **Admin auth** | Separate short-lived JWT, timing-safe password comparison, scrypt hash support, optional TOTP 2FA, persisted audit log |
| **CSRF** | Origin/Host validation on every state-changing request |
| **Rate limiting** | Tiered sliding windows per IP and per identity; Redis-backed when configured |
| **SMS toll-fraud** | Per-phone hourly cap, resend cooldown, optional global 24h cap |
| **Authorization** | Postgres RLS event-scoping + `secureGuard` participant/event checks on every route |
| **PII at rest** | AES-256-GCM field encryption with searchable HMAC blind indexes |
| **Log hygiene** | The logger redacts phone numbers, e-mails and tokens before writing |
| **Input handling** | Zod schemas at every boundary; DOMPurify on the client, tag-stripping on the server |
| **Header injection** | All e-mail header fields sanitized at one choke point in the mailer |
| **Content** | Dual-model AI photo moderation with a nightly re-check sweep and a manual review queue |
| **Abuse** | Device + hardware fingerprint ban lists enforced on a 60-second heartbeat |
| **Transport** | Strict CSP with violation reporting, HSTS preload, `X-Frame-Options`, `Permissions-Policy`, COOP |
| **Supply chain** | `npm audit` gate on critical production advisories, weekly CodeQL `security-extended` scan |
| **Secret leakage** | CI fails if a `'use client'` file references a server-only secret |

Threat model, residual risks and the hardening backlog:
[docs/SECURITY.md](docs/SECURITY.md).

**Found a vulnerability?** Please report it privately via GitHub Security
Advisories rather than opening a public issue.

---

## Privacy & data retention

Privacy is a product feature here, not an afterthought.

1. Guests are **anonymous, event-scoped identities** — there is no cross-event profile and no account to delete later.
2. Consent is **recorded with a version number** ([src/lib/legal-versions.ts](src/lib/legal-versions.ts)), so you can prove which text a user accepted.
3. Organizers must pass an **explicit consent gate** before uploading a guest phone list.4. **7 days after an event ends** (`RETENTION_DAYS` in [src/lib/constants.ts](src/lib/constants.ts)), a nightly cron **snapshots aggregate analytics and then hard-deletes** every participant, photo, message, like, block and phone number. Storage objects are removed too.
5. A guest can **delete their account instantly** at any time — same cascade, no waiting period.
6. Orphaned storage objects are swept every six hours.

Tune the retention window in [src/lib/constants.ts](src/lib/constants.ts) and make
sure your published privacy policy matches whatever you set.

---

## Localization & RTL

The UI ships in **Hebrew**, rendered right-to-left (`<html lang="he" dir="rtl">`),
with `Rubik` for text and `Great Vibes` for display type. Strings are currently
inline in components rather than extracted into message catalogues.

To translate the app you would: pick an i18n library (`next-intl` is the natural
fit for the App Router), extract the strings into per-locale catalogues, add a
locale segment to the routes, and flip `dir` per locale. The layout already uses
logical CSS properties in most places, which makes an LTR locale far less
painful than it sounds.

---

## Contributing

Contributions are welcome.

1. Read [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) first — it defines the file layout, import order, error-handling and API conventions this codebase follows.
2. Fork, branch, and keep changes focused.
3. Before opening a PR:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
4. Add tests for new behaviour. New tables need RLS or `npm run check:rls` will fail.
5. Never commit credentials, personal data, or anything from `.env.local`.

---

## License & disclaimer

Released under the [MIT License](LICENSE).

**Disclaimer.** This software is provided as-is, for reference and reuse. The
bundled legal documents are templates, not legal advice. Operating a service
that collects phone numbers, photographs and messages carries real regulatory
obligations (GDPR, local privacy and consumer law, accessibility standards,
telecoms marketing rules). Consult a lawyer before going live, and make sure you
hold the rights to any imagery you ship in `public/`.
