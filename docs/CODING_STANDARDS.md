# Eventa - Implementation Rules & Guidelines

> **Purpose**: Paste this document at the start of every implementation step to maintain consistency, avoid regressions, and follow established patterns.

---

## 1. Tech Stack - NEVER Deviate

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| React | React | 19.2.4 |
| Language | TypeScript | 5.9.3 (strict mode, ES2022) |
| Node | Node.js | >=20.0.0 |
| Database | Supabase (PostgreSQL 17) | `@supabase/supabase-js ^2.95.3` |
| State | Zustand | ^5.0.11 |
| Validation | Zod | ^4.3.6 |
| Styling | Tailwind CSS 4 + modular CSS files | NO CSS modules, NO CSS-in-JS |
| Animations | Framer Motion | ^12.34.0 |
| Email | Nodemailer | ^8.0.1 (SMTP) |
| Image (client) | browser-image-compression | client-side WebP |
| Image (server) | Sharp | server-side only |
| QR | qrcode | ^1.5.4 |
| PWA | Serwist | ^9.5.5 |
| Forms | React Hook Form | ^7.71.1 |
| Deployment | Vercel (Frankfurt `fra1`) | 15s max function duration |

**DO NOT** install new dependencies unless explicitly planned in the design document. If a new dependency is needed, state it and get approval.

---

## 2. Architecture - Monolithic Full-Stack Serverless

- **One repo, one Next.js app** - no microservices, no separate backend.
- All writes go through **API routes** (`src/app/api/`) using the Supabase `service_role` client.
- Client reads use the **anon Supabase client** with RLS (except realtime which uses filter scoping).
- **No direct Supabase writes from the client** - ever.

---

## 3. File Structure - Follow Exactly

```
src/
  app/
    api/
      auth/           # join, verify
      secure/         # All authenticated participant endpoints
      admin/          # All admin endpoints (events/, analytics, etc.)
      account/        # Account deletion
      order/          # Booking form
      health/         # Health check
      cleanup/        # Data retention cron
    dating/
      [eventSlug]/    # Event-scoped pages
        _components/  # Page-specific components (private to this route)
        join/
        setup/
        profile/
        user/
        likes/
        chats/
        chat/
        banned/
        unavailable/
    admin/
      _components/    # Admin-specific components
    styles/           # Modular CSS files (imported via globals.css)
  components/         # SHARED components (used across multiple routes)
  hooks/              # Custom React hooks
  lib/
    api/              # Client-side API functions (fetch wrappers)
    stores/           # Zustand stores (one file per store)
    # Top-level lib files: supabase.ts, session.ts, validations.ts, etc.
  shared/             # Shared utilities
supabase/
  schema.sql          # Base schema
  migrations/         # Numbered migrations (###_description.sql)
```

### Rules:
- **Route-specific components** go in `_components/` inside the route folder (Next.js convention - underscore prefix excludes from routing).
- **Shared components** go in `src/components/` - only if used by 2+ routes.
- **API helper functions** for server routes go in `src/lib/route-helpers.ts` or `src/app/api/admin/_helpers.ts`.
- **Client-side API functions** (fetch wrappers) go in `src/lib/api/` as individual files, re-exported via `src/lib/api/index.ts`.
- **Zustand stores** go in `src/lib/stores/`, one file per store.
- **Database types** go in `src/lib/database.types.ts`.
- **Zod schemas** go in `src/lib/validations.ts` (shared client/server).
- **Constants** go in `src/lib/constants.ts` (domain labels, fixed limits).
- **Config** goes in `src/lib/config.ts` (operational tuning knobs, cache TTLs).
- **SQL migrations** are numbered sequentially: `###_description.sql`.

---

## 4. Import Conventions

```typescript
// 1. External packages first
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 2. Internal absolute imports using @/ alias
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// 3. Types (use `import type` when importing only types)
import type { SessionPayload } from '@/lib/session';
import type { PublicParticipant } from '@/lib/database.types';
```

- **Always use `@/` path alias** (maps to `./src/*`). Never use relative `../` for cross-directory imports.
- **Use `import type`** for type-only imports.
- **Never use `require()`** - ESM only.

---

## 5. API Route Patterns - MUST Follow

### 5.1 Authenticated Participant Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // 1. Guard: CSRF → session → rate limit → ban check → event status
  const guard = await secureGuard(req, 'route-name', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    // 2. Parse & validate input
    const body = await req.json();
    const parsed = someSchema.safeParse(body);
    if (!parsed.success) return jsonError('Invalid input', 400);

    // 3. UUID validation on all IDs from user input
    if (!isValidUUID(parsed.data.someId)) return jsonError('Invalid ID', 400);

    // 4. Business logic with service client
    const supabase = getServiceClient();

    // 5. Return JSON response
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error('[ROUTE_NAME] error:', err);
    return jsonError('Server error', 500);
  }
}
```

### 5.2 Admin Routes

```typescript
import { adminGuard } from '@/app/api/admin/_helpers';

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req, 'admin-action-name', RATE_LIMITS.strict);
  if (auth instanceof NextResponse) return auth;
  // ... business logic
}
```

### 5.3 Critical Rules for ALL API Routes

1. **Every route MUST have rate limiting** - pick the right tier:
   - `standard` (30/min): reads, profile, heartbeat, conversations, likes, messages
   - `auth` (5/min): login, join
   - `upload` (10/min): photos, upload-url
   - `strict` (3/min): blocks, account delete, admin writes, cron

2. **Never use `SELECT *`** - always list explicit columns. Use constants like `PARTICIPANT_COLUMNS`.

3. **Validate ALL user-supplied IDs** with `isValidUUID()` before using in queries.

4. **Sanitize ALL user text input** with `sanitizeWithLimit()` before DB insertion.

5. **Validate file paths** with `isSafePath()` before any storage operations.

6. **Fail closed** - if a security check query errors, DENY the action (return 500), never allow.

7. **Fire-and-forget** for non-critical writes (activity_log, notifications):
   ```typescript
   Promise.resolve(supabase.from('activity_log').insert({...}))
     .catch(err => logger.error('[ROUTE] activity log error:', err));
   ```

8. **Error responses** use `jsonError()` - never leak stack traces. Generic messages to clients, detailed to logs.

9. **Use `getServiceClient()`** for all DB writes (bypasses RLS). Use anon client only for client-side reads.

10. **Ownership verification** - every mutation must verify the authenticated user owns the resource.

---

## 6. Database Patterns

### 6.1 Schema Changes

- **Always create a new numbered migration file**: `supabase/migrations/###_description.sql`
- **Always add CHECK constraints** on new text/enum columns (match limits in `constants.ts` and Zod schemas).
- **Always add indexes** for new FK columns and common query filters.
- **Update `database.types.ts`** with new TypeScript types when adding/modifying tables.
- **If table needs Realtime**: add to publication, set `REPLICA IDENTITY FULL`, update column lists in publication.
- **RLS**: All new tables must have RLS enabled. Anon = SELECT only (event-scoped). Writes via service_role only.
- **Keep triple consistency**: DB CHECK constraint ↔ Zod schema ↔ TypeScript type must match.

### 6.2 Query Patterns

```typescript
// Explicit columns, never SELECT *
const { data, error } = await supabase
  .from('participants')
  .select('id, display_name, gender, age, city')
  .eq('event_id', eventId);

// Parallel queries with Promise.all()
const [likes, blocks, conversations] = await Promise.all([
  supabase.from('likes').select('id').eq('event_id', eid),
  supabase.from('blocks').select('id').eq('event_id', eid),
  supabase.from('conversations').select('id').eq('event_id', eid),
]);

// Batched IN queries (max 50 IDs per batch)
const BATCH_SIZE = 50;
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  const batch = ids.slice(i, i + BATCH_SIZE);
  // ...query with .in('id', batch)
}

// Idempotent upserts for unique constraints
if (error?.code === '23505') {
  // Handle duplicate gracefully - return existing or success
}
```

### 6.3 Cascade Delete Order

Always respect FK ordering when deleting: `messages → conversations → likes → blocks → notifications → activity_log → photos → participants → event`

---

## 7. Security Checklist - EVERY Feature Must Address

- [ ] **CSRF**: handled by `secureGuard()` / `adminGuard()` (automatic)
- [ ] **Rate limiting**: applied with correct tier
- [ ] **Input validation**: Zod schema for all user input
- [ ] **Input sanitization**: `sanitizeWithLimit()` for all user text
- [ ] **UUID validation**: `isValidUUID()` for all ID parameters
- [ ] **Path validation**: `isSafePath()` for any storage paths
- [ ] **Ownership check**: user can only modify their own data
- [ ] **Block check**: bidirectional block check before interactions (likes, messages, conversations)
- [ ] **Self-action prevention**: prevent liking/blocking/messaging self
- [ ] **Ban check**: handled by `secureGuard()` (automatic)
- [ ] **Event status check**: handled by `secureGuard()` (automatic)
- [ ] **Timing-safe comparison**: `crypto.timingSafeEqual` for any secret comparisons
- [ ] **No fingerprint leakage**: never return `device_fingerprint` or `hardware_fingerprint` to clients
- [ ] **Magic byte validation**: for any file upload

---

## 8. Zustand Store Patterns

```typescript
import { create } from 'zustand';

interface SomeState {
  data: SomeType[];
  setData: (d: SomeType[]) => void;
  reset: () => void;  // MANDATORY - used by clearSession cascade
}

export const useSomeStore = create<SomeState>((set) => ({
  data: [],
  setData: (data) => set({ data }),
  reset: () => set({ data: [] }),
}));
```

### Rules:
1. **Every store MUST have a `reset()` method**.
2. **Register new stores in `useSessionStore.clearSession()`** for cascade reset.
3. **Only `useSessionStore` uses localStorage persistence** - all other stores are ephemeral.
4. **No React Context or Redux** - Zustand only.
5. **Use selectors** to minimize re-renders: `const data = useSomeStore(s => s.data);`

---

## 9. Component Patterns

### 9.1 Client Components
```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// ... component code
```

### 9.2 Server Components (default in App Router)
```tsx
// No 'use client' directive - server component by default
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Page Title' };
// ... component code
```

### Rules:
1. **Hebrew RTL throughout** - all user-facing text in Hebrew. `dir="rtl"` is set on `<html>`.
2. **Mobile-only design** - viewport max 768px. Don't add desktop layouts.
3. **Use Framer Motion** for animations (`motion.div`, `AnimatePresence`).
4. **Loading states** - use Skeleton components from `src/components/Skeletons.tsx`.
5. **Error handling** - ErrorBoundary wraps the app. Pages use try/catch with Hebrew error messages.
6. **No inline styles** - use Tailwind classes or the modular CSS files.
7. **Dynamic imports** for heavy components: `const Heavy = dynamic(() => import('./Heavy'), { ssr: false })`.

---

## 10. CSS & Styling Rules

1. **Tailwind CSS 4** is the primary styling method.
2. **Modular CSS files** in `src/app/styles/` for complex/reusable styles - imported via `globals.css`.
3. **NO CSS modules** (`.module.css`) - not used anywhere in the project.
4. **NO CSS-in-JS** (styled-components, emotion, etc.).
5. **When adding new CSS** - add to an existing file in `src/app/styles/` or create a new one and import it in `globals.css`.
6. **CSS class naming** - use descriptive kebab-case: `.chat-bubble`, `.grid-card`, `.profile-header`.
7. **Dark theme** - the app uses a dark background (`#0a0a0a`). All new UI must fit the dark theme.
8. **Fonts**: `Rubik` (Hebrew/Latin body, variable `--font-rubik`) + `Great Vibes` (decorative script, variable `--font-script`).

---

## 11. Realtime Patterns

1. **Use `useRealtimeHub` hook** - never create Supabase channels directly in components.
2. **Channel keys** format: `{table}:{eventId}` - event-scoped.
3. **Handlers in `useRef`** - so closures stay current without re-subscribing.
4. **Deduplication** - check `seenIds` Set before processing realtime events.
5. **Polling fallback** - 15s interval alongside realtime for reliability.
6. **New realtime subscriptions** - add in `RealtimeNotificationListener.tsx` or create a new component following the same pattern.

---

## 12. Error Handling Patterns

### Server-side (API routes):
```typescript
try {
  // ... logic
} catch (err) {
  logger.error('[ROUTE_NAME] descriptive error:', err);
  return jsonError('Server error', 500);  // Generic to client
}
```

### Client-side:
```typescript
try {
  const res = await fetch('/api/secure/something', { method: 'POST', ... });
  if (!res.ok) {
    const { error } = await res.json();
    // Handle specific status codes:
    // 403 → banned (redirect to /banned)
    // 410 → event inactive (redirect to /unavailable)
    // 429 → rate limited (show toast)
  }
} catch {
  // Network error - show Hebrew toast
}
```

### Rules:
- **Use `logger`** (from `@/lib/logger`) - never `console.log` in production code (except `validateEnv` bootstrap).
- **Structured logging**: `logger.error('message', { key: value })` - include contextual data.
- **Hebrew user-facing errors**: all error messages shown to users must be in Hebrew.
- **English server-side errors**: API error messages and log messages in English.

---

## 13. Testing Rules

- **Vitest** for unit/integration tests (`__tests__/unit/`, `__tests__/integration/`)
- **Playwright** for E2E tests (`__tests__/e2e/`)
- Test file naming: `feature-name.test.ts` (unit) or `feature-name.spec.ts` (E2E)
- Mock Supabase calls - never hit real DB in unit tests
- Run `npm run typecheck` to verify no TypeScript errors after changes

---

## 14. Environment Variables

- **New server-only vars**: add to `.env.local`, `envSchema` in `validations.ts`, and document.
- **New public vars**: prefix with `NEXT_PUBLIC_`, add to `envSchema`.
- **Stub/provider vars**: use pattern `PROVIDER_LIVE=false` for stub vs real implementation switching.
- **All vars validated at startup** via `validateEnv()`.

---

## 15. Performance Rules

1. **Parallel DB queries** - always use `Promise.all()` for independent queries.
2. **Fire-and-forget** for activity_log and notification inserts.
3. **Cache** ban checks (5min), event status (5min), blocked IDs (30s).
4. **Batch operations** - max 50 IDs per `.in()` query.
5. **Client-side image compression** before upload - max 2048px, max 2MB.
6. **`optimizePackageImports`** - zustand, zod, framer-motion are tree-shaken via next.config.js.
7. **Dynamic imports** for heavy components (ImageCropper, charts, etc.).
8. **Heartbeat debounce** - only update `last_seen_at` if >2min stale.
9. **Keyset pagination** (`created_at < cursor`) - never OFFSET-based.
10. **15s max function timeout** - all API routes must complete within 15s.

---

## 16. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files (components) | PascalCase.tsx | `MatchPopup.tsx` |
| Files (hooks) | camelCase with `use` prefix | `useRealtimeHub.ts` |
| Files (lib) | kebab-case.ts | `route-helpers.ts` |
| Files (API routes) | `route.ts` inside folder | `src/app/api/secure/likes/route.ts` |
| Files (stores) | camelCase.ts | `session.ts`, `grid.ts` |
| Files (CSS) | kebab-case.css | `profile-edit.css` |
| Files (migrations) | `###_description.sql` | `009_text_field_constraints.sql` |
| Components | PascalCase | `<MatchPopup />` |
| Hooks | camelCase with `use` prefix | `useRealtimeHub()` |
| Stores | camelCase with `use` prefix | `useSessionStore` |
| API functions (client) | camelCase | `getGridParticipants()` |
| Types/Interfaces | PascalCase | `PublicParticipant` |
| Constants | UPPER_SNAKE_CASE | `MAX_PHOTOS`, `RETENTION_DAYS` |
| DB columns | snake_case | `display_name`, `event_id` |
| CSS classes | kebab-case | `.chat-bubble` |
| Env vars | UPPER_SNAKE_CASE | `JWT_SECRET` |

---

## 17. Git & Migration Safety

1. **Never modify existing migration files** - always create a new one.
2. **Migration numbering**: continue from the last number (currently at `010`). Next = `011`.
3. **Always update `schema.sql`** to reflect the current state after adding migrations.
4. **Test migrations** - ensure `IF NOT EXISTS` / `IF EXISTS` guards are used.
5. **Backward-compatible schema changes** - add columns as nullable with defaults, never drop columns in-use.

---

## 18. What NOT To Do - Hard Rules

1. **DO NOT** add desktop layouts - this is a mobile-only PWA.
2. **DO NOT** use Context API or Redux - Zustand only.
3. **DO NOT** use CSS modules or CSS-in-JS.
4. **DO NOT** import Supabase service key on the client - server-only.
5. **DO NOT** use `SELECT *` in any DB query.
6. **DO NOT** skip rate limiting on any route.
7. **DO NOT** return raw error objects/stack traces to clients.
8. **DO NOT** hardcode secrets - use env vars.
9. **DO NOT** use `console.log` - use `logger` from `@/lib/logger`.
10. **DO NOT** skip ownership verification on mutations.
11. **DO NOT** allow file uploads without magic byte validation.
12. **DO NOT** skip CSRF checks (already handled by guard functions).
13. **DO NOT** install new npm packages without explicit approval.
14. **DO NOT** break the existing `clearSession()` cascade reset pattern.
15. **DO NOT** expose `device_fingerprint` or `hardware_fingerprint` in any API response.
16. **DO NOT** use `unsafe-eval` in production CSP.
17. **DO NOT** modify existing migration files - create new ones.
18. **DO NOT** add English user-facing text - Hebrew only.
19. **DO NOT** use OFFSET-based pagination - use keyset pagination.
20. **DO NOT** add WebSocket channels without using `useRealtimeHub` / `RealtimeHub`.
21. **DO NOT** use hardcoded values and code. always be dynamic, use helpers where needed, don't do duplicated code.


---

## 19. Existing Infrastructure To Reuse

When implementing new features, USE these existing utilities - don't reinvent them:

| Utility | Location | Purpose |
|---|---|---|
| `secureGuard()` | `src/lib/route-helpers.ts` | Full auth pipeline for participant routes |
| `adminGuard()` | `src/app/api/admin/_helpers.ts` | Full auth pipeline for admin routes |
| `jsonError()` | `src/lib/route-helpers.ts` | Consistent error responses |
| `getServiceClient()` | `src/lib/supabase.ts` | Service-role Supabase client |
| `supabase` (anon) | `src/lib/supabase.ts` | Anon client for client-side reads |
| `isValidUUID()` | `src/lib/session.ts` | UUID format validation |
| `sanitizeWithLimit()` | `src/lib/sanitize.ts` | HTML sanitization + truncation |
| `isSafePath()` | `src/lib/route-helpers.ts` | Path traversal protection |
| `logger` | `src/lib/logger.ts` | Structured logging |
| `RATE_LIMITS` | `src/lib/rate-limit.ts` | Pre-defined rate limit tiers |
| `generateJoinCode()` | `src/lib/supabase.ts` | Crypto-random hex codes |
| `evictBanCache()` | `src/lib/route-helpers.ts` | Force-update ban cache |
| `evictEventStatusCache()` | `src/lib/route-helpers.ts` | Force-update event status cache |
| `getBlockedIds()` | `src/lib/api/helpers.ts` | Cached bidirectional block check |
| `getPhotoUrl()` | `src/lib/api/helpers.ts` | Build photo public URL |
| `validateImageMagicBytes()` | `src/lib/validations.ts` | File upload magic byte check |
| `useRealtimeHub` | `src/hooks/useRealtimeHub.ts` | React hook for Realtime channels |
| `useAppResume` | `src/hooks/useAppResume.ts` | Visibility change callback |
| Zod schemas | `src/lib/validations.ts` | All existing validation schemas |
| Hebrew constants | `src/lib/constants.ts` | Labels, options, limits |
| Config | `src/lib/config.ts` | Cache TTLs, session lifetimes |
| Email templates | `src/lib/email-templates.ts` | `shell()`, `row()`, `priceBlock()` helpers |

---

## 20. Design Document Reference

The full implementation plan is in `PHONE_VERIFICATION_SYSTEM_DESIGN.md` (5172 lines, 28 sections). Key implementation phases from Section 26.2:

| Phase | Focus | Estimated |
|---|---|---|
| 1 | Database migrations + core infrastructure (OTP, SMS/WA stubs, messaging abstraction) | 2 days |
| 2 | API routes (phone verification, message sending, cron jobs) | 2 days |
| 3 | Client changes (order form, guest portal, admin dashboard buttons) | 2-3 days |
| 4 | Email templates (6 lifecycle emails) | 1 day |
| 5 | Testing + polish | 1-2 days |

**Always refer to the design document section for the feature you're implementing.** It contains DB schemas, API contracts, file changes, and edge cases.

---

## 21. Pre-Implementation Checklist

Before writing any code for a new feature:

1. **Read the relevant section** in `PHONE_VERIFICATION_SYSTEM_DESIGN.md`
2. **Identify affected files** - list which existing files need modification vs new files
3. **Check for type changes** - will `database.types.ts` need updates?
4. **Check for schema changes** - will a new migration be needed?
5. **Check for new Zod schemas** - add to `validations.ts`
6. **Check for new constants** - add to `constants.ts` or `config.ts`
7. **Check for new env vars** - add to `envSchema` and document
8. **Check for store changes** - new store or new fields on existing store?
9. **Check for realtime changes** - new channel or new event handlers?
10. **Verify the change won't break existing UI** - trace the data flow

---

## 22. Post-Implementation Checklist

After completing each implementation step:

1. **Run `npm run typecheck`** - zero TypeScript errors
2. **Run `npm run build`** - verify production build succeeds
3. **Verify existing pages still work** - join flow, grid, chat, likes, profile, admin
4. **Check mobile layout** - test at 375px width (iPhone SE)
5. **Verify RTL** - Hebrew text flows right-to-left correctly
6. **Check dark theme** - new UI fits the dark background
7. **Review security** - run through Section 7 checklist above
8. **Update `ARCHITECTURE.md`** if adding new routes, tables, or components
9. **Update `database.types.ts`** if schema changed

---

## 23. Key Architectural Decisions - Do Not Override

1. **Hand-rolled HMAC-SHA256 JWTs** - no external JWT library (jose, jsonwebtoken). Uses `crypto.createHmac` + `crypto.timingSafeEqual`.
2. **Dual JWT system**: `ws_session` cookie (participant, SameSite=Lax, 30 days) + `ws_admin` cookie (admin, SameSite=Strict, 24h, Path=/api/admin).
3. **In-memory rate limiting** - acceptable for Vercel serverless scale. Not Redis-backed.
4. **RLS with `x-event-id` header** - event isolation at the database level.
5. **Service-role for all writes** - authorization logic lives in TypeScript, not SQL policies.
6. **7-day data retention** - events auto-archive, data auto-purges.
7. **RealtimeHub singleton** outside React tree - reference counting, auto-reconnect.
8. **Admin is a single SPA** at `/admin` - not separate pages.
9. **Payment/SMS/WA all start as stubs** - controlled by `*_PROVIDER_LIVE` env vars.
10. **No push notifications** - deliberately removed. Don't re-add.

---

## 24. Quick Reference - Common Operations

### Adding a new API route:
1. Create `src/app/api/secure/new-thing/route.ts` (or `admin/`)
2. Use `secureGuard()` or `adminGuard()`
3. Add Zod schema to `validations.ts`
4. Add rate limiting (pick tier)
5. Add client API function in `src/lib/api/`
6. Re-export from `src/lib/api/index.ts`

### Adding a new DB table:
1. Create migration `supabase/migrations/###_name.sql`
2. Enable RLS, add SELECT policy for anon (event-scoped)
3. Add indexes for FK columns
4. Add CHECK constraints matching Zod schemas
5. Add TypeScript types to `database.types.ts`
6. If Realtime needed: add to publication with column list, set REPLICA IDENTITY

### Adding a new Zustand store:
1. Create `src/lib/stores/name.ts` with `reset()` method
2. Register in `useSessionStore.clearSession()` cascade
3. Export from store file

### Adding a new page:
1. Create route folder under `src/app/[eventSlug]/new-page/`
2. Add `page.tsx` (server component by default; add `'use client'` if needed)
3. Add route-specific components in `_components/` subfolder
4. Hebrew text, dark theme, mobile layout

### Adding new CSS:
1. Add to existing file in `src/app/styles/` if related
2. Or create new file and import in `globals.css`: `@import "./styles/new-file.css";`
