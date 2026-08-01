# Eventa - Security, Resilience & Production-Hardening Plan

> **Type:** Planning document (no code changes). Roadmap only.
> **Date:** June 2026
> **Scope:** Whole application - app layer, API, database, storage, infra, operations, compliance.
> **Stack:** Next.js 16 (App Router) on Vercel `fra1` (serverless, 15 s max) · React 19 · TypeScript 5.9 (strict) · Supabase (PostgreSQL 17, Realtime, Storage) · Zustand · hand-rolled HMAC-SHA256 JWT · Nodemailer SMTP · Invoice4U payments · SMS provider · OpenAI + Falconsai moderation.
> **Nature of data:** Hebrew-language, mobile-only, event-scoped **dating** PWA. Processes **special-category personal data** (sexual orientation, photos, private messages, phone numbers). This raises the required security/compliance bar substantially.

---

## 0. How to read this document

Every recommendation is tagged so you can sequence the work:

| Tag | Meaning |
|---|---|
| **P0** | Critical - do before any paid marketing push / scale. Direct money, legal, or account-takeover risk. |
| **P1** | High - schedule within the next development cycle. |
| **P2** | Medium - valuable hardening, do when capacity allows. |
| **P3** | Future / at-scale - revisit when traffic, team size, or contractual obligations grow. |

| Effort | Meaning |
|---|---|
| **S** | Small (hours) |
| **M** | Medium (1–3 days) |
| **L** | Large (week+ or ongoing) |

> Nothing here is an implementation instruction - it is a prioritized map of *what* to do and *why*. Sequencing is in [§24 Roadmap](#24-prioritized-roadmap).

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [What is already strong (baseline)](#2-what-is-already-strong-baseline)
3. [Threat model](#3-threat-model)
4. [Sensitive-data inventory (PII map)](#4-sensitive-data-inventory-pii-map)
5. [Identity, authentication & sessions](#5-identity-authentication--sessions)
6. [Authorization & access control](#6-authorization--access-control)
7. [API security & abuse prevention](#7-api-security--abuse-prevention)
8. [Data protection & encryption](#8-data-protection--encryption)
9. [Database security & hardening](#9-database-security--hardening)
10. [Secrets management & key rotation](#10-secrets-management--key-rotation)
11. [Infrastructure, network & edge defense](#11-infrastructure-network--edge-defense)
12. [Application resilience & fail-safe](#12-application-resilience--fail-safe)
13. [Backup, disaster recovery & business continuity](#13-backup-disaster-recovery--business-continuity)
14. [Observability, monitoring & alerting](#14-observability-monitoring--alerting)
15. [Incident response & forensics](#15-incident-response--forensics)
16. [Trust, safety & content moderation](#16-trust-safety--content-moderation)
17. [Supply chain & third-party security](#17-supply-chain--third-party-security)
18. [Payment & financial security](#18-payment--financial-security)
19. [Email & SMS messaging security](#19-email--sms-messaging-security)
20. [Privacy, compliance & legal](#20-privacy-compliance--legal)
21. [Secure SDLC & CI/CD](#21-secure-sdlc--cicd)
22. [Client / PWA / device security](#22-client--pwa--device-security)
23. [Resilience, consistency & connectivity (crowded venues & low signal)](#23-resilience-consistency--connectivity-crowded-venues--low-signal)
24. [Prioritized roadmap](#24-prioritized-roadmap)
25. [Quick wins](#25-quick-wins)
26. [Appendix A - Secrets & env inventory](#appendix-a--secrets--env-inventory)
27. [Appendix B - Production readiness checklist](#appendix-b--production-readiness-checklist)
28. [Appendix C - Incident runbook skeleton](#appendix-c--incident-runbook-skeleton)

---

## 1. Executive summary

Eventa already has an **above-average security foundation for a solo-built product**: a disciplined `secureGuard()` pipeline, dual HMAC JWTs with timing-safe verification, Row-Level Security event-scoping at the database, dual-fingerprint ban enforcement, a tight Content-Security-Policy, server+client input sanitization, and a genuinely sophisticated AI image-moderation pipeline (OpenAI omni + Falconsai second opinion, CSAM handling, shadow-review queue).

The remaining work is mostly the move from *"secure code"* to *"secure, observable, recoverable production service handling sensitive data at scale."* The highest-value gaps fall into six themes:

1. **Money path** - the payment webhook has a legacy branch that trusts the request body without provider-side verification (fraud risk). **(P0)**
2. **Operational blindness** - no external error tracking, alerting, or uptime monitoring. A production outage or attack would currently be discovered by users, not by you. **(P0/P1)**
3. **Abuse & bot resistance** - rate limiting is in-memory only (resets on every serverless cold start) and there is no CAPTCHA/bot challenge on auth, OTP, or order endpoints (SMS toll-fraud and spam exposure). **(P0/P1)**
4. **Sensitive-data encryption** - this is a dating app holding sexual-orientation data, photos and phone numbers. Beyond Supabase's default at-rest encryption, there is no application-level encryption of PII and photos sit in **public** storage buckets. **(P1)**
5. **Identity hardening** - a single shared `ADMIN_PASSWORD`, no admin MFA, and no JWT revocation/denylist. **(P0/P1)**
6. **Recoverability & compliance** - backup/restore has never been drilled (no documented RTO/RPO), and GDPR special-category + Israeli Privacy Law (Amendment 13, in force 2025) obligations need formal coverage. **(P1)**

None of these indicate poor engineering - they are the normal "next layer" for a maturing product. This document lays them out in full.

---

## 2. What is already strong (baseline)

> Listed so the plan **builds on** rather than re-litigates these. Treat as "keep & maintain."

- **Auth:** Dual hand-rolled HMAC-SHA256 JWTs (`ws_session` Lax/30 d, `ws_admin` Strict/24 h, `Partitioned`), `typ` discriminator, iss/aud claims, `crypto.timingSafeEqual` verification, lazy secret loading.
- **API guard:** `secureGuard()` = body-size cap → CSRF (Origin==Host) → JWT → rate limit → ban check → event-status check, all **fail-closed**.
- **Database:** RLS event-scoping via `x-event-id` header + `get_request_event_id()`; anon role is read-only (no INSERT/UPDATE/DELETE policy = deny); all writes via `service_role` in API routes; explicit column lists (no `SELECT *`); UUID validation before filter interpolation; PostgREST search-input character allow-listing.
- **Abuse/ban:** Dual fingerprint (localStorage UUID + canvas/WebGL hardware hash) checked at join and on 60 s heartbeat; admin ban evicts cache instantly.
- **Headers/CSP:** Restrictive CSP (no `unsafe-eval` in prod), HSTS preload (2 y), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, `object-src 'none'`, `frame-ancestors`, `base-uri`, `form-action`.
- **Input safety:** Server regex tag-strip + entity-decode (double pass) / client DOMPurify (zero tags); path-traversal guard (`isSafePath`); Zod schemas shared client/server; email-template HTML escaping.
- **Admin:** Brute-force lockout (10/15 min), timing-safe SHA-256 password compare, structured audit logging, cron `CRON_SECRET` bearer with timing-safe compare.
- **Content safety:** Two-stage AI image moderation with CSAM hard-block, grey-band shadow-review queue, nightly recheck cron, fail-open with deferred-row logging.
- **Lifecycle/privacy:** 7-day auto-deletion of all user data via cron; account self-deletion full cascade; analytics snapshots preserve only aggregates.
- **Reliability instrumentation:** `reliability-thresholds.ts`, telemetry, funnel events, pending-SMS retry backlog, soft-delete participants.
- **Testing:** Vitest unit/integration + Playwright e2e present.

---

## 3. Threat model

### 3.1 Assets to protect

| Asset | Why it matters |
|---|---|
| Participant PII (phone, photos, bio, **sexual orientation**) | Special-category data; breach = severe harm + regulatory penalty |
| Private chat messages | Intimate content; reputational + legal exposure |
| Event/business data (orders, payments, client phone lists) | Revenue + B2B client trust |
| Admin credentials & service-role key | Full-database compromise if leaked |
| Availability of the app during a live event | The product only has value *during* the event window - downtime = total failure for that customer |
| Brand/trust & legal standing | A single publicized incident on a dating app is existential |

### 3.2 Threat actors

- **Opportunistic attackers / script kiddies** - automated scanning, credential stuffing, default-path probing.
- **Malicious participants** - scraping other attendees, harassment, ban evasion, NSFW uploads, impersonation.
- **Competitors / scrapers** - bulk profile/photo harvesting.
- **Fraudsters** - payment manipulation, free-event creation.
- **Spammers / toll-fraud actors** - abusing OTP/SMS send to pump premium numbers.
- **Insiders / supply chain** - compromised dependency, leaked secret, malicious npm package.

### 3.3 STRIDE summary (with current posture)

| Threat | Examples for Eventa | Current mitigation | Residual gap |
|---|---|---|---|
| **S**poofing | Forged session/admin token; payment webhook spoof | HMAC JWT, timing-safe; provider verify on main webhook path | **Legacy webhook trusts body**; no admin MFA |
| **T**ampering | Mutating another user's profile/likes; query injection | service-role-only writes, Zod, UUID checks, RLS | Field integrity / immutable audit trail |
| **R**epudiation | "I didn't ban / delete that" | Admin audit log (stdout) | **Not persisted to DB**; limited retention |
| **I**nformation disclosure | Cross-event data read; public photo URLs; PII in logs | RLS scoping, explicit columns | **Public photo buckets**; no PII log redaction; no field encryption |
| **D**enial of service | OTP/SMS flooding; request floods; DB exhaustion | In-mem rate limit, body caps, 15 s timeout | **Not distributed**; no WAF rules; no CAPTCHA; SMS toll-fraud |
| **E**levation of privilege | Participant → admin; anon → write | typ discriminator, separate cookies, RLS | Stateless JWT cannot be revoked early |

---

## 4. Sensitive-data inventory (PII map)

> A precise data map is the prerequisite for both encryption decisions (§8) and privacy compliance (§20).

| Data element | Location | Sensitivity | Currently protected by | Recommended additional control |
|---|---|---|---|---|
| Phone number | `participants`, `guest_phones`, `event_requests`, `message_log` | High (identifier) | TLS + at-rest (Supabase) | Field encryption + blind-index for lookup (§8.3) |
| OTP code | `phone_otps` | High (short-lived) | SHA-256 hashed ✅ | Keep; ensure pepper (§8.3) |
| Profile photos / chat images | Supabase Storage `photos` (**public**) | High | Moderation ✅ | **Private bucket + signed read URLs** (§8.4) |
| Sexual orientation (`attracted_to`, `looking_for`), gender | `participants` | **Special category (GDPR Art. 9)** | RLS scoping | Explicit consent record + encryption consideration (§8, §20) |
| Bio / free text | `participants` | Medium | Sanitization, moderation | - |
| Private messages | `messages` | High | RLS, soft-delete | Encryption consideration; retention already 7 d |
| Email | `event_requests`, order flow | Medium | TLS | Field encryption (§8.3) |
| Device + hardware fingerprint | `participants`, `banned_devices` | Medium (tracking) | - | Document in privacy policy (§20) |
| IP address | Logs, rate-limit keys | Medium | Ephemeral | Redact/hash in persisted logs (§8.5) |
| Admin credential | `ADMIN_PASSWORD` env | Critical | SHA-256 compare | Move to hash-at-rest + MFA (§5, §10) |

**Action (P1, M):** Produce and maintain this map as a living "Record of Processing Activities" (ROPA) - required under both GDPR Art. 30 and Israeli law.

---

## 5. Identity, authentication & sessions

### 5.1 Admin account hardening - **P0**

| Gap | Recommendation | Effort |
|---|---|---|
| Single shared `ADMIN_PASSWORD`, no per-admin identity | Move to per-admin accounts with individually hashed passwords (**Argon2id** or bcrypt, not SHA-256) stored in DB; attribute audit logs to a real admin id | M |
| No MFA on admin | Add **TOTP-based 2FA** (e.g., `otplib`) as a second factor on `/admin` login, with recovery codes | M |
| Password is compared via SHA-256 | SHA-256 is fast and unsuitable for password storage - use a memory-hard KDF | S |

> Even if there is only one operator today, MFA + a proper KDF is the single biggest reduction in "full compromise" risk because the admin panel can ban/delete/export everything.

### 5.2 Session revocation / denylist - **P1, M**

Stateless JWTs cannot be invalidated before `exp`. Today a stolen 30-day session token is valid for 30 days. Add:
- A lightweight **revocation list** (token `jti` claim → denylist in Supabase/KV) checked in `secureGuard()`, OR
- A per-participant **`session_epoch`** integer; bump it to invalidate all existing tokens (logout-everywhere, post-ban, post-account-recovery).

### 5.3 OTP / phone-auth hardening - **P0/P1**

- **Per-phone + per-IP rate limits** on `send-otp` beyond the current cooldown, to stop **SMS toll-fraud / pumping** (a real cost-and-abuse vector). **(P0, S)** - see §19.
- Add a **CAPTCHA / bot challenge** (Cloudflare Turnstile or hCaptcha - `supabase/config.toml` already references these) before OTP issuance and order submission. **(P1, M)**
- **Account-takeover via SIM-swap:** document the risk; consider step-up verification for sensitive actions and short OTP validity (already 5 min ✅). **(P3)**
- Ensure OTP hashing uses a server-side **pepper** in addition to SHA-256. **(P2, S)**

### 5.4 Session cookie review - **P2, S**
- Confirm `__Host-` cookie prefix feasibility for `ws_admin` (requires `Secure`, `Path=/`, no `Domain`) to harden against subdomain cookie injection.
- Consider shortening session lifetime or adding idle-timeout for long-lived 30-day sessions (balance against the UX of returning event guests).

---

## 6. Authorization & access control

| Area | Current | Recommendation | Priority/Effort |
|---|---|---|---|
| Cross-event isolation | RLS via `x-event-id` header (PostgREST) | **Keep**, but add automated tests that attempt cross-event reads to prevent regressions | P1, S |
| Write authorization | All writes via `service_role` in TS | Keep; ensure every write path re-verifies *ownership* (e.g., editing your own photo/message only). Audit each `secure/*` route for an explicit ownership check | P1, M |
| Service-role blast radius | One key, full DB access | Consider a **scoped/limited Postgres role** for routine API writes (least privilege) instead of full `service_role`, reserving `service_role` for admin/cron | P2, L |
| IDOR resistance | UUID validation present | Add a focused test suite probing object references (likes, messages, conversations, photos) for horizontal privilege escalation | P1, M |
| Realtime authz | Realtime bypasses header RLS; relies on subscription filters | Verify subscription filters are server-enforceable and cannot be widened by a crafted client; document the trust boundary | P2, M |

---

## 7. API security & abuse prevention

### 7.1 Distributed rate limiting - **P0/P1, M**
The in-memory limiter (`rate-limit.ts`) does not persist across serverless instances or cold starts, so the effective limit under real Vercel conditions is much weaker than configured. **Move to a shared store** - Upstash Redis (`@upstash/ratelimit`) or Vercel KV - keyed by IP and by identity (participant/phone). This is already flagged in code comments; it should be scheduled, not deferred indefinitely, because it underpins every other abuse control.

### 7.2 Bot / automation defense - **P1, M**
- Add **Cloudflare Turnstile / hCaptcha** to: join, send-OTP, verify-OTP, order form. Invisible challenges keep UX intact.
- Add **honeypot fields** + minimum-time-to-submit checks on public forms (order). **(P2, S)**
- Consider Vercel's **Bot Management / Attack Challenge Mode** at the edge. **(P3)**

### 7.3 Edge WAF / request filtering - **P1, M**
- Enable **Vercel Firewall** rules (or front with Cloudflare): block common scanner paths, bad user agents, geo-fence to expected regions if appropriate (Israel-focused audience), and set custom rate rules at the edge (before functions execute = cheaper + faster mitigation).

### 7.4 Input & schema robustness - **P2, S**
- Centralize **max payload sizes** per route (already partially done) and ensure every route parses with Zod `safeParse`.
- Add explicit limits on **array fields** (e.g., batch photo reorder, guest import row count) to prevent algorithmic-complexity DoS.
- Validate `Content-Type` on all mutating routes.

### 7.5 Response hygiene - **P2, S**
- Add `Cache-Control: no-store` to all authenticated/JSON API responses to prevent any intermediary/SW caching of personal data.
- Confirm no stack traces or internal identifiers leak in error bodies (largely handled via `jsonError`).

---

## 8. Data protection & encryption

### 8.1 Encryption in transit - **Maintain (P2, S to verify)**
TLS is terminated by Vercel and Supabase; HSTS preload is set. **Verify** Supabase connections enforce TLS and that no plaintext fallback exists. Add automated header tests (HSTS, CSP) to CI.

### 8.2 Encryption at rest (platform) - **Document (P2, S)**
Supabase (on AWS) provides **AES-256 at-rest encryption** for the database and storage by default. This covers "disk theft" scenarios but **not** application-layer compromise (a leaked service-role key still reads everything in plaintext). Document this clearly so the limitation is understood - it is necessary but not sufficient for special-category data.

### 8.3 Application-level field encryption for PII - **P1, L**
For the most sensitive identifiers, add **application-layer encryption** so that even a DB/key leak (short of the encryption key) does not expose raw PII:

- **Candidates:** phone numbers, email, possibly bio/messages.
- **Approach - envelope encryption:** a master key in a KMS (AWS KMS, or Vercel/Doppler-managed) encrypts per-record data keys; ciphertext stored in DB. Alternatively Postgres **`pgcrypto`** for simpler symmetric encryption (key still must live outside the DB).
- **Searchable encryption problem:** phone numbers are used for lookup ("reconnect by phone"). Use a **blind index** - a keyed HMAC of the normalized phone stored in a separate indexed column - for equality lookups, while the displayable value is encrypted. This preserves "find participant by phone" without storing plaintext.
- **Special-category data:** `attracted_to` / `looking_for` are GDPR Art. 9 data; evaluate encrypting these columns or at minimum tightening access + audit around them.
- **Key management:** keys must be rot:able and never in source. See §10.

> This is the work the request specifically calls out ("encrypting the data in the db"). Recommended as **P1** (not P0) only because platform at-rest encryption + RLS already cover the most common scenarios; field encryption defends the "leaked key / insider" tier and is expected for a dating app holding orientation data.

### 8.4 Storage / photo privacy - **P1, M**
Photos and event backgrounds currently live in **public-read** Supabase buckets - anyone with (or guessing) the URL can fetch them, and they are not event-scoped at the storage layer. Recommended:
- Move participant/chat photos to **private buckets** and serve via **short-lived signed read URLs** generated by the API (you already do signed *upload* URLs - mirror that for reads).
- Add object-path entropy (already partly via UUIDs) and lifecycle rules to purge orphaned objects.
- Keep moderation in the upload path (already strong).

> Trade-off: signed read URLs add latency/complexity and interact with `next/image` caching and the service worker. Pilot on chat images first (most sensitive), then profile photos.

### 8.5 Data minimization & log redaction - **P1, S**
- **Never log raw phone numbers, OTPs, tokens, or message content.** Audit `logger` call sites; mask to last 2–4 digits or hash. (Some redaction exists - make it a lint rule / helper.)
- Hash or truncate IPs in any persisted logs.
- Strip EXIF/GPS metadata from uploaded images server-side (privacy + de-anonymization risk). **(P2, S)**

### 8.6 Client-side storage - **P2, S**
- Audit `localStorage`/Zustand-persisted data: ensure no sensitive PII (only event context + own non-sensitive profile bits) is persisted; the cascade-reset on session clear already mitigates cross-event leakage.

---

## 9. Database security & hardening

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **RLS coverage audit** | Verify every table (incl. newer ones: `phone_otps`, `guest_phones`, `message_log`, `event_requests`, `discount_claims`, moderation tables) has RLS enabled and correct policies; default-deny on writes. Add a CI check that fails if any `public` table has RLS disabled. | P1, M |
| **Least-privilege DB roles** | Introduce a restricted role for routine writes; reserve `service_role` for admin/cron (see §6). | P2, L |
| **Connection pooling** | Confirm API routes use Supabase's **transaction pooler** (PgBouncer) endpoint - serverless functions can exhaust direct connections under load. | P1, S |
| **Statement limits** | Set conservative `statement_timeout` for the API role to prevent runaway queries from holding connections (analytics routes can be heavy - 684-line analytics). | P2, S |
| **Constraints & integrity** | Continue CHECK constraints; add FK `ON DELETE` review so cascades match the documented block/delete flows. | P2, M |
| **Backups / PITR** | See §13 - confirm Point-In-Time Recovery is enabled on the Supabase plan. | P0/P1 |
| **Audit trail table** | Persist admin + security-relevant events to an append-only `audit_log` table (immutable, never auto-purged) instead of stdout only. | P1, M |
| **Migration hygiene** | Note duplicate migration numbers (`008_*` appears twice, `012_*` twice). Reconcile numbering to avoid ordering ambiguity in fresh environments. | P2, S |
| **SQL injection** | PostgREST + explicit columns + UUID validation already strong; keep the search-input allow-list and avoid string-built `.or()` filters. | Maintain |

---

## 10. Secrets management & key rotation

| Gap | Recommendation | Priority/Effort |
|---|---|---|
| Secrets as flat Vercel env vars | Adopt a **secrets manager** (Doppler, Vercel's encrypted env w/ access controls, or AWS Secrets Manager) with audit on access and environment separation (dev/preview/prod). | P1, M |
| No rotation policy | Define rotation cadence + runbook for: `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ADMIN_PASSWORD`, SMTP, Invoice4U token, SMS, OpenAI. | P1, M |
| `JWT_SECRET` rotation breaks all sessions | Support **two active signing keys** (current + previous) during verification so secrets can rotate without mass-logout. | P2, M |
| Service-role key exposure risk | Confirm it is **never** referenced in any `NEXT_PUBLIC_*` var or client bundle; add a CI guard that greps the client build for the key pattern. | P0, S |
| Preview deployments | Ensure Vercel **preview** deployments don't carry production secrets / can't write to the prod DB. | P1, S |
| Secret scanning | Enable GitHub **secret scanning + push protection** (see §21). | P0, S |

---

## 11. Infrastructure, network & edge defense

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **DDoS / volumetric** | Rely on Vercel/Cloudflare edge; explicitly enable Vercel Firewall rate rules + Attack Challenge Mode for incident use. Document how to "turn up" defenses during an attack. | P1, M |
| **WAF** | Edge WAF rules (§7.3). | P1, M |
| **Region & data residency** | `fra1` (EU) is good for GDPR. If EU/Israel data-residency becomes a contractual requirement, document where Supabase + Vercel actually store data. | P2, S |
| **DNS security** | Enable DNSSEC; lock registrar; add CAA records restricting which CAs may issue certs for the domain. | P2, S |
| **Email domain auth** | SPF + DKIM + DMARC (§19). | P1, S |
| **`security.txt`** | Publish `/.well-known/security.txt` with a disclosure contact. | P2, S |
| **Subdomain takeover** | Inventory DNS records; remove dangling CNAMEs. | P2, S |

---

## 12. Application resilience & fail-safe

> The request mentions "auto start in case of a fail and crash of the server." Important architectural reality: **on Vercel there is no long-lived server to crash/restart.** Functions are ephemeral and auto-recover per request; Vercel auto-scales and reschedules. The real single points of failure are **Supabase** and **external providers (SMS, email, payment, OpenAI)**. Resilience effort should target those, plus graceful degradation.

| Concern | Recommendation | Priority/Effort |
|---|---|---|
| **Supabase is a SPOF** | Choose a Supabase plan tier with HA/automatic failover; document behavior during a Supabase incident; add read-replica usage for heavy analytics if needed. | P1, M |
| **External-dependency failure** (SMS/email/payment/OpenAI) | Wrap each in **timeout + retry-with-backoff + circuit breaker**, so one slow provider can't exhaust the 15 s function budget or cascade failures. You already have a pending-SMS retry backlog - generalize the pattern. | P1, M |
| **Idempotency** | Make webhook + cron + "send message" handlers idempotent (idempotency keys / dedupe) so retries don't double-charge, double-send, or double-insert. Payment webhook partially does this (checks `paid`); formalize everywhere. | P0/P1, M |
| **Graceful degradation** | Define UX for "DB unavailable" / "realtime down" (already have polling fallback + NetworkStatus). Ensure the app shows a friendly Hebrew "temporary issue" state rather than crashing, especially mid-event. | P1, S |
| **Cron reliability** | Vercel Cron has at-least-once semantics and can miss runs. Add: a "last successful run" heartbeat per cron, alerting if a cron hasn't completed in its window, and manual re-trigger endpoints (guarded by `CRON_SECRET`). | P1, M |
| **Self-healing data** | Nightly reconciliation jobs: detect orphaned storage objects, stuck "sending" messages, events past `ends_at` not transitioned, etc. (partly covered by cleanup cron). | P2, M |
| **Deploy safety** | Use Vercel's instant **rollback**; document the one-click rollback procedure; consider preview-then-promote for risky changes. | P1, S |
| **Load/stress testing** | Before a large event, run a load test simulating N concurrent attendees (realtime + likes + messages) to find the breaking point and tune limits. | P2, M |
| **Function timeout budget** | Audit the heavy analytics endpoints (684/541 lines) against the 15 s limit; precompute/cache or stream if they approach the ceiling. | P2, M |

---

## 13. Backup, disaster recovery & business continuity

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Confirm backups exist** | Verify Supabase automated daily backups + **Point-In-Time Recovery (PITR)** are enabled on your plan (free/lower tiers may not include PITR). | P0, S |
| **Define RTO / RPO** | Document target Recovery Time Objective and Recovery Point Objective (e.g., RPO ≤ 24 h, RTO ≤ 4 h). A dating event is time-boxed - clarify what recovery even means mid-event vs. post-event. | P1, S |
| **Restore drill** | **Actually perform a test restore** to a scratch project at least once. Untested backups are not backups. | P1, M |
| **Off-platform backup copy** | Periodically export critical business data (orders, payments, analytics snapshots, guest lists) to an independent location (e.g., encrypted object storage) so a Supabase-account-level incident isn't catastrophic. | P2, M |
| **Storage backup** | Confirm whether Storage objects (photos) are included in backups; if not, decide retention/backup strategy (note: photos are auto-purged at 7 days anyway, lowering urgency). | P2, S |
| **Config/IaC backup** | Keep RLS policies, DB functions, and Vercel/Supabase config in version control (most SQL is already in `supabase/`); add the missing config to enable full rebuild from scratch. | P1, M |
| **Runbook** | Write a DR runbook: how to restore DB, rotate leaked keys, re-point env, and communicate. | P1, M |

---

## 14. Observability, monitoring & alerting

> This is the area with the **highest leverage relative to effort.** Today, failures are invisible until a user complains.

| Capability | Recommendation | Priority/Effort |
|---|---|---|
| **Error tracking** | Add **Sentry** (or equivalent) for server + client. Capture unhandled exceptions, API 5xx, and client render errors (you already have an ErrorBoundary to wire in). Free tier covers early scale. | P0/P1, M |
| **Uptime monitoring** | External uptime checks (e.g., BetterStack/UptimeRobot/Checkly) hitting `/api/health` from multiple regions, with alerting to phone/email. | P0, S |
| **Alerting** | Define alert thresholds (you already have `reliability-thresholds.ts`!) and **route them somewhere** - email/Slack/Telegram/PagerDuty. Wire the existing reliability metrics into real notifications. | P0/P1, M |
| **Structured log drain** | Ship Vercel logs to a queryable store (Datadog/Logtail/Axiom) so logs outlive Vercel's short retention - important for incident forensics and the audit trail. | P1, M |
| **Synthetic monitoring** | A Playwright/Checkly script that performs the critical path (join → set profile → like → message) on a schedule against production. | P2, M |
| **Security alerting** | Alert on: spikes in 401/403/429, admin `LOGIN_FAILED`/`LOCKED_OUT`, moderation BLOCK/CSAM events, payment webhook anomalies, OTP send spikes. | P1, M |
| **Dashboards** | A single ops dashboard (errors, latency, realtime health %, SMS failure %, cron status). You already compute many of these. | P2, M |
| **Health endpoint depth** | Extend `/api/health` to check DB, storage, and (lightweight) provider reachability, returning per-dependency status. | P2, S |

---

## 15. Incident response & forensics

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **IR plan** | Write a short incident-response plan: severity levels, who does what, comms templates (Hebrew + English), and a decision tree for "is this a personal-data breach?" | P1, M |
| **Breach notification readiness** | GDPR requires notification within **72 hours**; Israeli law has its own obligations. Pre-draft notification templates and know your supervisory contacts. | P1, S |
| **Forensic readiness** | Persist immutable audit logs (§9), keep log drain (§14), and ensure you can answer "what did this account/admin do and when." | P1, M |
| **Key-compromise runbook** | Step-by-step for "service-role key / JWT secret leaked": rotate, invalidate sessions (needs §5.2), audit access, notify. | P0/P1, S |
| **Kill switches** | Provide admin-level switches: pause an event, disable OTP sends, enable Attack Challenge Mode, put app in read-only/maintenance mode. (Event pause exists ✅ - extend the concept.) | P2, M |
| **Tabletop exercise** | Once written, run a 1-hour tabletop simulating a breach to validate the plan. | P3, S |

---

## 16. Trust, safety & content moderation

> Already strong (AI image moderation, CSAM handling, shadow-review). Enhancements:

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **User reporting** | In-app "report user / report message" flow feeding the moderation queue (complements proactive AI scanning). Confirm/extend existing reports infra (`026_event_reports`, `027_moderation`). | P1, M |
| **Text moderation** | Extend AI moderation to **bios and chat text** (harassment, hate, sexual solicitation, scams), not just images. | P2, M |
| **Anti-harassment** | Rate-limit unsolicited first messages; cool-down on rapid blocks; auto-flag accounts with high block ratios. | P2, M |
| **Human review tooling** | Admin UI to action the shadow-review queue (approve/reject/ban) with audit. | P2, M |
| **Age assurance** | Dating app → ensure ToS minimum age and consider lightweight age-gating; document the policy. | P2, S |
| **Minor-safety escalation** | Documented CSAM escalation/reporting procedure to the relevant authorities (legal obligation in many jurisdictions). | P1, S |

---

## 17. Supply chain & third-party security

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Dependency scanning** | Enable **Dependabot** (or Renovate) + `npm audit` in CI; alert on known CVEs. | P0/P1, S |
| **SBOM** | Generate a Software Bill of Materials on each release for visibility. | P3, S |
| **Lockfile integrity** | Commit and enforce the lockfile; use `npm ci` in CI; consider provenance/`--ignore-scripts` review for risky installs. | P1, S |
| **Pin & review** | Watch high-risk deps (`xlsx`, `html2canvas`, `jspdf`, `dompurify`) for advisories; `xlsx` in particular has had prototype-pollution/ReDoS history - validate uploads strictly and consider a maintained fork or server-side parsing limits. | P1, M |
| **Provider trust** | Document data-processing agreements with all sub-processors (Supabase, Vercel, Invoice4U, SMS, OpenAI, SMTP) - also a GDPR requirement (§20). | P1, M |
| **Third-party scripts** | CSP already restricts script sources; keep external scripts minimal and use SRI where any are added. | Maintain |

---

## 18. Payment & financial security

| Gap | Recommendation | Priority/Effort |
|---|---|---|
| **Legacy webhook trusts request body** | The `{ token, status }` branch in `payment/webhook` marks an order **paid** based on unverified POST data - a payment-fraud vector. **Remove/disable it** or require provider-side verification (re-fetch clearing log) on *every* path. Add HMAC signature verification and/or **IP allow-listing** for Invoice4U callbacks. | **P0, S** |
| **Idempotency** | Ensure duplicate webhook deliveries can't double-process (partial today via `payment_status` check) - use a unique constraint on provider transaction id. | P1, S |
| **Amount/price integrity** | Verify the charged amount server-side against the expected price; never trust client-sent amounts. | P1, S |
| **PCI scope** | Confirm card data never touches your servers (hosted payment page / iframe). Keep CSP `frame-src` allow-list tight (already done). | P1, S |
| **Replay protection** | Reject stale callbacks (timestamp/nonce) where the provider supports it. | P2, S |
| **Reconciliation** | Periodic job comparing `event_requests` payment status against the provider's records to catch missed/spoofed updates. | P2, M |

---

## 19. Email & SMS messaging security

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **SMS toll-fraud / pumping** | Add strict per-phone + per-IP + global daily caps on OTP/SMS sends, anomaly alerting, and optionally geo-restrict destination prefixes (Israeli mobile only - you already validate format). This protects directly against billing abuse. | **P0, M** |
| **SPF / DKIM / DMARC** | Configure all three for the sending domain so order/lifecycle emails aren't spoofable and land in inboxes. Start DMARC at `p=none` (monitor) → `quarantine` → `reject`. | P1, S |
| **Email injection** | Order route escapes HTML ✅; also guard header injection (newlines in name/subject) in Nodemailer inputs. | P1, S |
| **Link safety** | Signed/expiring tokens for portal & payment links (portal token exists ✅); ensure they're single-purpose and rotatable. | P2, S |
| **Unsubscribe / consent** | Pre-event/feedback WhatsApp & email must respect consent + provide opt-out (consent fields exist - `015_feedback_consent`). Verify enforcement. | P1, S |
| **Message audit** | `message_log` exists ✅ - ensure it records delivery status + failures for dispute/abuse investigation, without storing message bodies containing PII unnecessarily. | P2, S |

---

## 20. Privacy, compliance & legal

> **This deserves emphasis:** Eventa processes **special-category data** (sexual orientation, intimate photos/messages). Under **GDPR Article 9** this is the most strongly protected class of data, and the EU `fra1` hosting means GDPR applies. **Israel's Privacy Protection Law (Amendment 13, in force August 2025)** also imposes stricter security, breach-notification, and database-registration duties.

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Lawful basis & explicit consent** | For special-category data you generally need **explicit consent**. Ensure setup flow records consent (what, when, version of policy) for processing orientation/photos. | P1, M |
| **ROPA (Art. 30)** | Maintain the data map in §4 as a formal processing record. | P1, S |
| **DPA with sub-processors** | Signed Data Processing Agreements with Supabase, Vercel, SMS, Invoice4U, OpenAI, SMTP; list them in the privacy policy. | P1, M |
| **Data-subject rights (DSAR)** | Provide access/export/erasure. Erasure largely covered by account self-delete + 7-day purge ✅; add **data export** (right to portability) and a documented DSAR process. | P1, M |
| **Breach notification** | 72-hour GDPR process + Israeli obligations - pre-drafted (§15). | P1, S |
| **Privacy policy accuracy** | Ensure the policy discloses: fingerprinting, retention (7 d), AI moderation (incl. sending images to OpenAI/Falconsai), payment processor, SMS. AI moderation of intimate photos via third parties **must** be disclosed. | P0/P1, S |
| **Data residency** | Confirm OpenAI/Falconsai image-moderation data flows are acceptable under your privacy commitments (images leave the EU?). | P1, S |
| **DPIA** | A **Data Protection Impact Assessment** is effectively mandatory for large-scale special-category processing - produce one. | P1, M |
| **Children's data** | Enforce/measure minimum age (§16). | P2, S |
| **Cookie/consent** | Cookie policy page exists; ensure only strictly-necessary storage is used without consent (you use functional localStorage, not ad trackers - likely fine, but document it). | P2, S |

---

## 21. Secure SDLC & CI/CD

| Capability | Recommendation | Priority/Effort |
|---|---|---|
| **Secret scanning** | GitHub secret scanning + **push protection** (blocks commits containing keys). | P0, S |
| **SAST** | Enable **CodeQL** (free for the repo) for static analysis on PRs. | P1, S |
| **Dependency CI** | `npm audit` / Dependabot gating (also §17). | P1, S |
| **Build secret check** | CI step that greps the client bundle for service-role key / secret patterns (§10). | P0/P1, S |
| **Security tests in CI** | Add tests for: cross-event isolation, IDOR, header/CSP presence, auth bypass attempts. You have Vitest+Playwright - extend them. | P1, M |
| **Branch protection** | Require PR review + green CI before merge to `main`; protect `main`. | P1, S |
| **Pre-commit hooks** | Lint, typecheck, secret-scan locally (the build already runs perf budget + typegen). | P2, S |
| **Pen test** | Commission an external penetration test before a major launch / B2B contracts; consider a private bug-bounty later. | P2/P3, L |
| **Dependency provenance** | Pin Node version (done ✅) and CI runner images. | Maintain |

---

## 22. Client / PWA / device security

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **CSP tightening** | Move from `script-src 'unsafe-inline'` toward **nonce/hash-based** script CSP in production to close the residual XSS gap. (Next.js supports nonces via middleware.) | P2, M |
| **Service worker scope** | API routes are `NetworkOnly` ✅; bound the image cache (max entries/expiry) to avoid unbounded device storage; ensure no authenticated response is ever cached. | P2, S |
| **Clickjacking** | `X-Frame-Options`/`frame-ancestors` set ✅ - maintain. |  Maintain |
| **Sensitive data in client state** | Audit Zustand persistence (§8.6). | P2, S |
| **Tamper expectations** | Treat all client-side checks (MobileGuard, fingerprint) as **advisory**; never rely on them for authorization (server already does). Document this. | Maintain |
| **Dependency on `localStorage` UUID** | Fine for UX; ban enforcement correctly also uses the hardware fingerprint server-side. | Maintain |

---

## 23. Resilience, consistency & connectivity (crowded venues & low signal)

> This is the dimension that decides whether Eventa *feels reliable at a real event*. The defining environment is hostile: **hundreds of phones sharing one congested cell tower / saturated venue Wi-Fi**, walls and bodies attenuating signal, phones constantly backgrounded and resumed, and a hard time-box (the event window) during which everything must "just work." The bar is: **a guest who loses signal for 10 seconds - or 10 minutes - loses nothing, sees no crash, and catches up automatically.**

### 23.0 What is already strong here (build on, don't rebuild)

The codebase is already unusually well-prepared for this. Treat these as "keep & maintain":

- **Resilient fetch** - `fetchWithRetry` wraps API calls with a 12 s per-attempt `AbortController` timeout, exponential backoff + jitter, retries on 5xx/`408`/`429`/network failure, and **never** retries 4xx. Read calls retry freely; mutations only retry when explicitly safe.
- **Idempotency, server-enforced** - `sendMessage` / `sendLike` / `getOrCreateConversation` send an `Idempotency-Key`; the messages route **deduplicates by `idempotency_key` in the DB**, and likes/conversations are unique-constraint / race-safe. So a retry after a flaky send **cannot create duplicates** - the core requirement for "send during a connection blip."
- **Optimistic messaging** - chat send renders a `temp-` message immediately and reconciles with the server row on success (rolls back + toasts on failure).
- **Realtime that survives mobile reality** - `RealtimeHub` does ref-counted channels, **exponential backoff reconnect with jitter**, a **20 s watchdog** that rebuilds channels which went silent for 60 s (catches *silent* TCP drops where the socket looks "joined" but is dead), and reconnect triggers on `visibilitychange`, `pageshow` (iOS app-switcher), and `online`.
- **Polling safety net** - `RealtimeNotificationListener` polls every 8 s (visible) / 15 s (hidden) / 5 s burst after reconnect trouble, with `seenIds` de-duplication, so a dropped WebSocket event is still caught.
- **Service worker tuned for venues** - `CacheFirst` for Supabase photos (7 days) explicitly to avoid re-downloading 30 grid images per cold start "the dominant data cost at a crowded venue"; `StaleWhileRevalidate` for grid/conversations (30 s) and messages (10 s) for instant paint; `NetworkOnly` for all mutations/auth.
- **Bandwidth reduction** - client-side WebP compression before upload; `react-virtual` available for long lists; `prefers-reduced-motion` honored in CSS; graceful `try/catch` fallbacks in fingerprinting (canvas/WebGL/SubtleCrypto).
- **Heartbeat** - 60 s, paused when hidden, retries once on failure, drives ban/event-status enforcement.

The gaps below are the *next* layer - mostly about **durability across longer outages**, **consistency correctness**, **graceful behavior under sustained low bandwidth**, and **verified capacity at venue scale**.

### 23.1 Offline tolerance & action durability - *"I lost signal for a moment and nothing happened"*

| Gap | Why it matters at a venue | Recommendation | Priority/Effort |
|---|---|---|---|
| **No persistent outbox** | Today, if a message ultimately fails after retries (e.g., 20 s dead zone), the optimistic bubble is **removed** and the text is gone - the user must remember and retype. | Add a **durable outbox**: persist unsent messages/likes (with their idempotency key) to `localStorage`/IndexedDB; show them as "pending"; **auto-flush on reconnect** (`online` event / realtime resubscribe). Because the server already dedupes by idempotency key, replay is safe. | **P1, M** |
| **Failed send is destructive** | A removed message feels like data loss. | Keep failed messages visible in a **"failed - tap to retry"** state (reuse the same idempotency key) instead of deleting them. | **P1, S** |
| **Composer text not preserved across reload** | A mid-event reload (or iOS killing the tab) loses a half-typed message. | Persist draft input per conversation to `localStorage`; restore on mount. | P2, S |
| **No queued-action feedback** | User can't tell "sending" from "sent" under lag. | Per-message status ticks (sending / sent / failed), already partially modeled via `temp-` ids. | P2, S |

> This cluster is the single most important "nothing happens when I lose connection" improvement. It converts transient network loss from *visible failure* into *invisible, self-healing delay*.

### 23.2 Consistency & state reconciliation after reconnect

| Gap | Recommendation | Priority/Effort |
|---|---|---|
| **Polling cursor uses the client clock** | The poll fallback queries `created_at > lastPollTs` where `lastPollTs` is built from the **device's** `new Date()`. A phone with a skewed clock (common) can **miss** events (clock ahead) or **re-fetch/duplicate** (clock behind). Switch the cursor to a **server-provided timestamp** (return "server now" from the poll endpoint, or page by last-seen row id) so correctness never depends on device time. | **P1, S** |
| **`seenIds` prunes at 5 min** | If a user is offline > 5 min, dedup memory can expire and a re-delivered event could double-toast. Tie pruning to a reconnect "resync" rather than a fixed window, or dedupe against persisted message ids. | P2, S |
| **No full resync after long background** | Polling catches *new* rows but can miss **deletes/blocks/edits** that happened while away. On resume-after-threshold (e.g., hidden > 2–3 min), trigger a **full refetch** of grid + conversations + blocks rather than relying on incremental catch-up. | P1, M |
| **Optimistic rollback coverage** | Verify every optimistic action (like, unlike, block, profile edit) has an explicit rollback path on failure, not just messages. | P2, M |
| **Idempotency coverage audit** | Confirm *all* non-idempotent mutations that `fetchWithRetry` may replay carry an idempotency key or a unique constraint (audit `photos`, `blocks`, `read` receipts). | P1, S |

### 23.3 Connection-aware behavior (sustained low signal / Save-Data)

| Gap | Recommendation | Priority/Effort |
|---|---|---|
| **No adaptation to link quality** | The app behaves identically on 5G and on a congested 3G cell. Use the **Network Information API** (`navigator.connection.effectiveType` / `saveData`) to degrade gracefully: lower `next/image` quality, defer non-critical prefetch, lengthen poll intervals on `slow-2g`/`2g`, and skip decorative autoplay/heavy animation. | P2, M |
| **Fixed image quality** | `next.config.js` allows qualities `[75, 90, 100]`. On poor links, force the low end and smaller `sizes`. | P2, S |
| **Realtime vs poll trade-off under congestion** | When WebSocket can't hold, the app already falls back to polling - but consider lengthening intervals when `saveData` is on to conserve the user's data/battery. | P2, S |
| **Timeouts tuned for fast networks** | The 12 s fetch timeout may be too short on a saturated venue link for the first byte. Consider a longer timeout for idempotent GETs (safe to retry) and surfacing a "still working…" state rather than failing. | P2, S |

### 23.4 Realtime & polling at venue scale (the "crowded place" capacity problem)

> This is a **capacity** concern, not just a code concern, and it is the most likely thing to break at a genuinely large event.

| Risk | Detail | Recommendation | Priority/Effort |
|---|---|---|---|
| **Supabase Realtime concurrency limits** | Realtime has per-project caps on **concurrent connections** and **messages/second**. A 400-guest wedding = 400+ simultaneous WebSocket clients, each subscribed to several channels. Hitting the cap silently degrades delivery for everyone. | **Confirm the plan's Realtime limits**; model worst-case (guests × channels); load-test against it; choose a tier with headroom. | **P1, M** |
| **Polling thundering herd** | When signal dips venue-wide, *all* clients drop to polling at the **same fixed** 8 s cadence and reconnect together → synchronized query spikes on Postgres. Reconnect already has jitter; **polling intervals do not.** | Add **jitter** to poll intervals and a small random start offset so load spreads across the window. | **P1, S** |
| **Per-client query cost** | Each poll runs several queries (likes, messages, membership). × hundreds of clients × every 8 s is significant DB load. | Add a single lightweight "since" endpoint that returns all deltas in one query; ensure covering indexes; consider short server-side caching. | P1, M |
| **DB connection exhaustion** | Serverless + a crowd can exhaust Postgres connections. | Use the Supabase **transaction pooler** (PgBouncer) for API routes (also in §9); cap statement time. | P1, S |
| **Reconnect storms** | When the tower recovers, every client reconnects in the same second. | The 500 ms–1 s reconnect delays + backoff help; add a larger random spread on the venue-wide `online` event. | P2, S |

### 23.5 Bandwidth & data minimization

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Initial payload on cold join** | Audit the bytes a guest downloads on first load at the venue (JS bundle + first grid + photos). Tighten code-splitting; ensure the dating pages stay lean. You already have a perf-budget script - wire a **hard CI budget** specific to the join→grid path. | P1, M |
| **Photo delivery** | Already `CacheFirst` 7 d ✅. Add responsive `sizes`/`srcset` so phones fetch grid-thumb resolution, not full images; prefer AVIF/WebP (already enabled). | P2, S |
| **Prefetch discipline** | Avoid aggressive route/image prefetch on metered/slow links (ties into §23.3 Save-Data). | P2, S |
| **Realtime payload size** | `REPLICA IDENTITY FULL` sends full old+new rows. Ensure published columns are minimal (no large text blobs broadcast unnecessarily). | P2, S |

### 23.6 Image upload resilience (large files, flaky uplink)

| Gap | Recommendation | Priority/Effort |
|---|---|---|
| **Uploads are not resumable** | A profile/chat photo upload that drops at 80 % on a weak uplink **fails entirely** and restarts. | Adopt **resumable uploads (TUS)** - Supabase Storage supports the TUS protocol - so an interrupted upload continues instead of restarting. Pilot on profile photos. | P2, M |
| **No upload progress/cancel** | Long uploads on slow links feel frozen. | Show progress + allow cancel; already compress client-side ✅ to shrink the payload first. | P2, S |
| **Upload timeout** | Signed-URL PUT may exceed default timeouts on slow links. | Use generous, upload-specific timeouts and retry the *upload* step (not just the DB record). | P2, S |

### 23.7 Browser & device compatibility

> `MobileGuard` already scopes the app to mobile. The risk is the **older/locked-down mobile browsers** common in a random crowd (old Android WebViews, iOS Lockdown Mode, in-app browsers from WhatsApp/Instagram where the QR link is often opened).

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Define a support matrix** | Document min versions (e.g., iOS Safari ≥ 15, Chrome/Android ≥ last 2 yrs) and **test on real low-end Android + in-app browsers**. Decide the message shown to unsupported browsers. | P1, S |
| **In-app browser quirks** | QR links opened inside WhatsApp/Instagram/Facebook in-app browsers can block `localStorage`, camera, service workers, and "Add to Home Screen." Detect and **prompt "open in Safari/Chrome."** | P1, M |
| **Feature detection + fallbacks** | Confirm graceful degradation when missing: `localStorage` (Safari Private mode historically threw on write), Web Workers (image compression), `WebSocket` (→ polling already), `crypto.subtle` (fingerprint fallback exists ✅), `backdrop-filter` (glass UI), `100dvh` + `env(safe-area-inset)`, `navigator.sendBeacon` (telemetry fallback exists ✅), `IntersectionObserver`. | P1, M |
| **PWA storage eviction** | iOS may evict PWA/site data after ~7 days of non-use - usually fine given the 7-day event scope, but document it so a returning guest mid-event isn't surprised by a lost session. | P3, S |
| **Camera/photo capture** | Validate the photo picker/capture path across iOS/Android, including permission-denied UX. | P2, S |

### 23.8 Low-end device performance

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Animation cost** | Framer Motion + glassmorphism (`backdrop-filter`) can jank on budget Androids that are common at large events. Honor `prefers-reduced-motion` (CSS already does ✅) and consider a "lite mode" that drops blur/heavy transitions on low-end devices. | P2, M |
| **List virtualization** | Ensure the grid and chat lists actually use `@tanstack/react-virtual` so a 300-person event doesn't render 300 cards/messages at once. | P1, S |
| **Main-thread work** | Image compression already yields to the event loop before blocking ✅; audit other heavy synchronous work (canvas, parsing) and offload/defer. | P2, S |
| **Memory pressure** | Long-lived event sessions accumulate messages/photos in memory; cap in-memory history and rely on `getMessagesBefore` paging (already present ✅). | P2, S |

### 23.9 Venue-scale capacity planning & load testing

| Area | Recommendation | Priority/Effort |
|---|---|---|
| **Realistic load test** | Before any large booking, simulate **N concurrent guests** doing the real mix: join, profile setup, grid scroll + photo loads, likes, matches, realtime + polling, chat. Find the breaking point for Realtime, Postgres connections, and Vercel function concurrency. | P1, M |
| **Capacity runbook per event size** | Document expected resource use at 50 / 150 / 400 / 1000 guests and which plan tier each requires. | P2, S |
| **Graceful saturation** | Define what happens at the cap: degrade to polling-only, queue, or shed load with a friendly Hebrew "מתחברים…" state - never a hard crash. | P1, M |
| **Pre-event readiness check** | A lightweight admin "event readiness" check (DB reachable, Realtime healthy, storage writable, providers up) run shortly before doors open. | P2, S |

### 23.10 Resilience & consistency summary

The foundation (retry, idempotency, optimistic UI, realtime+polling, venue-tuned caching) is genuinely strong. The high-value additions, in order:

1. **Durable outbox + "failed → tap to retry"** so a connection blip never loses a message. *(§23.1, P1)*
2. **Server-timestamp poll cursor + poll jitter** for correctness and to prevent venue-wide thundering herds. *(§23.2/§23.4, P1, mostly S)*
3. **Verify Supabase Realtime limits + a realistic venue-scale load test.** *(§23.4/§23.9, P1)*
4. **Full resync on resume-after-long-background.** *(§23.2, P1)*
5. **Compatibility matrix + in-app-browser handling + feature fallbacks.** *(§23.7, P1)*
6. **Connection-aware degradation, resumable uploads, lite mode for low-end devices.** *(§23.3/§23.6/§23.8, P2)*

---

## 24. Prioritized roadmap

> Suggested sequencing. Each phase is independently shippable.

### Phase 0 - Critical (before scaling / marketing) - *money, takeover, blindness*
1. **Harden payment webhook** - remove/secure the legacy body-trust path; provider verification + idempotency on all paths. *(§18, P0, S)*
2. **SMS/OTP abuse caps** - per-phone/IP/global send limits + alerting (toll-fraud). *(§19, P0, M)*
3. **Distributed rate limiting** (Upstash/KV) - so limits actually hold. *(§7.1, P0/P1, M)*
4. **Uptime monitoring + alerting wired to a human** - `/api/health` external checks + route existing reliability thresholds to notifications. *(§14, P0, S–M)*
5. **Error tracking (Sentry)** - server + client. *(§14, P0/P1, M)*
6. **Admin MFA + proper password KDF** (Argon2id) + per-admin identity. *(§5.1, P0/P1, M)*
7. **Secret scanning / push protection + build secret-leak check + confirm PITR backups.** *(§10/§21/§13, P0, S)*

### Phase 1 - High
8. Session revocation/denylist (`session_epoch`). *(§5.2)*
9. Bot challenge (Turnstile) on auth + order; edge WAF rules. *(§7.2/§7.3)*
10. Private photo buckets + signed read URLs (pilot on chat images). *(§8.4)*
11. PII log redaction + EXIF stripping. *(§8.5)*
12. Persist audit log to immutable DB table + log drain. *(§9/§14)*
13. RLS coverage audit + cross-event/IDOR security tests in CI. *(§6/§9/§21)*
14. Circuit breakers/idempotency for external providers; cron heartbeats. *(§12)*
15. Backup **restore drill** + RTO/RPO + DR/IR runbooks + breach templates. *(§13/§15)*
16. SPF/DKIM/DMARC; Dependabot/CodeQL; branch protection. *(§19/§21)*
17. Privacy program: explicit consent, ROPA, DPAs, DPIA, DSAR export, policy disclosure of AI moderation. *(§20)*
- **R1.** Durable **offline outbox** + "failed → tap to retry" so a connection blip never loses a message. *(§23.1)*
- **R2.** **Server-timestamp poll cursor** + **poll jitter** (correctness + prevent venue-wide thundering herd) + full resync on resume-after-long-background. *(§23.2/§23.4)*
- **R3.** **Verify Supabase Realtime concurrency limits** + realistic **venue-scale load test** + graceful-saturation UX. *(§23.4/§23.9)*
- **R4.** **Compatibility matrix** + in-app-browser (WhatsApp/Instagram) detection + feature-fallback audit; confirm list **virtualization**. *(§23.7/§23.8)*

### Phase 2 - Medium
18. Application-level field encryption + blind index for phone/email. *(§8.3)* *(can elevate to P1 if a B2B client or auditor requires it)*
19. Least-privilege DB role; connection-pooler + statement timeouts. *(§6/§9)*
20. Text moderation + in-app reporting + human-review tooling. *(§16)*
21. Nonce-based CSP; SW image-cache bounds. *(§22)*
22. Payment reconciliation job; load/stress test before big events. *(§18/§12)*
23. `security.txt`, DNSSEC/CAA, secrets manager + rotation tooling. *(§11/§10)*
- **R5.** **Connection-aware degradation** (Network Info API / Save-Data) + **resumable (TUS) uploads** + **"lite mode"** for low-end devices. *(§23.3/§23.6/§23.8)*
- **R6.** Single lightweight **"since" delta endpoint** + **transaction pooler** to cut per-client poll cost at scale. *(§23.4)*

### Phase 3 - Future / at-scale
24. Pen test / bug bounty; SBOM; off-platform backup copies; tabletop exercises; scoped Supabase keys; Vercel Bot Management; SIM-swap step-up. *(various)*
- **R7.** Per-event **capacity runbook** (50/150/400/1000 guests) + pre-event **readiness check**. *(§23.9)*

---

## 25. Quick wins

> High value, low effort (mostly **S**) - can be done almost immediately:

- [ ] Disable/secure the legacy payment-webhook body-trust branch. *(§18)*
- [ ] External uptime check on `/api/health` with SMS/email alert. *(§14)*
- [ ] Enable GitHub secret scanning + push protection + Dependabot. *(§21/§17)*
- [ ] Confirm Supabase **PITR** is enabled (or upgrade plan). *(§13)*
- [ ] Add per-phone + global daily OTP/SMS send caps. *(§19)*
- [ ] Add `Cache-Control: no-store` to authenticated API responses. *(§7.5)*
- [ ] Audit `logger` calls; redact phone/OTP/token/message content. *(§8.5)*
- [ ] CI grep to ensure service-role key never appears in the client bundle. *(§10)*
- [ ] Publish `/.well-known/security.txt`. *(§11)*
- [ ] Reconcile duplicate migration numbers. *(§9)*
- [ ] SPF/DKIM/DMARC DNS records (start DMARC `p=none`). *(§19)*
- [ ] Disclose AI image moderation (OpenAI/Falconsai) + fingerprinting in the privacy policy. *(§20)*
- [ ] Add **jitter** to the polling intervals (spread venue-wide reconnect load). *(§23.4)*
- [ ] Keep failed messages as **"tap to retry"** instead of deleting them. *(§23.1)*
- [ ] Switch the polling cursor to a **server timestamp** (kill client-clock skew). *(§23.2)*
- [ ] Persist chat **draft text** per conversation across reloads. *(§23.1)*
- [ ] Detect **in-app browsers** and prompt "open in Safari/Chrome." *(§23.7)*

---

## Appendix A - Secrets & env inventory

> Confirm each is: present in prod, **absent from client bundle**, rotatable, and access-audited.

| Secret | Used by | Rotation impact | Notes |
|---|---|---|---|
| `JWT_SECRET` | session + admin JWT signing | Rotating logs everyone out unless dual-key (§5.2) | Lazy-loaded ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | all server writes/admin | Full-DB key - highest value | Must never be `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client reads (RLS) | Low (read-only via RLS) | Public by design |
| `ADMIN_PASSWORD` | admin login | Move to hashed per-admin records (§5.1) | SHA-256 compare today |
| `CRON_SECRET` | Vercel Cron auth | Update Vercel cron config on rotate | Timing-safe ✅ |
| `INVOICE4U_API_TOKEN` | payments | Coordinate with provider | + webhook verification (§18) |
| SMTP creds | order/lifecycle email | - | + SPF/DKIM/DMARC (§19) |
| SMS provider creds | OTP / WA messaging | - | + toll-fraud caps (§19) |
| OpenAI / Falconsai keys | image moderation | - | Disclose data flow (§20) |

---

## Appendix B - Production readiness checklist

**Security**
- [ ] Admin MFA + KDF + per-admin identity
- [ ] Distributed rate limiting
- [ ] Bot challenge on public/auth endpoints
- [ ] Edge WAF + DDoS escalation procedure
- [ ] Session revocation mechanism
- [ ] PII field encryption + blind index (sensitive data)
- [ ] Private photo storage + signed reads
- [ ] Log redaction of PII/secrets

**Resilience**
- [ ] Provider timeouts + retries + circuit breakers
- [ ] Idempotent webhooks/cron/sends
- [ ] Cron heartbeat + alerting
- [ ] Graceful-degradation UX for DB/realtime outage
- [ ] Documented rollback procedure

**Connectivity & venue-scale (crowded / low signal)**
- [ ] Durable offline outbox + "failed → tap to retry"
- [ ] Server-timestamp poll cursor + poll jitter
- [ ] Full resync on resume-after-long-background
- [ ] Supabase Realtime limits verified + venue-scale load test
- [ ] Graceful saturation UX (no hard crash at the cap)
- [ ] Connection-aware degradation (Network Info / Save-Data)
- [ ] Resumable (TUS) uploads
- [ ] Browser/device support matrix + in-app-browser handling
- [ ] List virtualization confirmed on grid + chat

**Recovery**
- [ ] PITR confirmed
- [ ] RTO/RPO defined
- [ ] Restore drill performed
- [ ] Off-platform critical-data export
- [ ] DR + key-compromise runbooks

**Observability**
- [ ] Error tracking (server + client)
- [ ] Uptime + synthetic monitoring
- [ ] Alerts routed to a human
- [ ] Log drain with retention
- [ ] Immutable audit-log table

**Compliance**
- [ ] Explicit consent for special-category data
- [ ] ROPA + DPIA
- [ ] DPAs with all sub-processors
- [ ] DSAR (export) process
- [ ] Breach-notification templates
- [ ] Privacy policy discloses AI moderation, fingerprinting, retention

**SDLC**
- [ ] Secret scanning + push protection
- [ ] CodeQL + Dependabot
- [ ] Security tests (cross-event, IDOR, headers) in CI
- [ ] Branch protection on `main`

---

## Appendix C - Incident runbook skeleton

1. **Detect** - alert fires (error spike / uptime / security signal / report).
2. **Triage** - assign severity (S1 data breach / S2 outage / S3 degraded / S4 minor).
3. **Contain** - e.g., rotate leaked key, enable Attack Challenge Mode, pause event, disable OTP sends, put app read-only.
4. **Eradicate** - fix root cause; deploy or roll back.
5. **Recover** - restore data if needed (DR runbook); verify integrity.
6. **Assess breach** - is personal data affected? If yes → GDPR 72-hour clock + Israeli obligations; use templates.
7. **Notify** - users / authorities / B2B clients as required.
8. **Post-mortem** - blameless write-up; track follow-up actions to closure.

---

### Closing note

This plan is intentionally broad per the request. The app's existing foundation is strong; the work ahead is primarily **operational maturity** (observability, recovery, abuse resistance) and **handling sensitive data to a dating-app standard** (encryption, privacy compliance, payment integrity). Start with **Phase 0** - those items address direct financial, account-takeover, and "flying blind" risks with modest effort.
