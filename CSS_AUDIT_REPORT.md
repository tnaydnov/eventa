# Eventa - Comprehensive CSS Audit Report

> **Audited files (19):** `globals.css`, `base.css`, `layout.css`, `components.css`, `grid.css`, `swipe.css`, `chat.css`, `profile.css`, `profile-edit.css`, `landing.css`, `event-bg.css`, `event-over.css`, `how-it-works.css`, `home.css`, `wizard.css`, `pricing.css`, `site-page.css`, `guest-portal.css`, `admin.css`

---

## 0 · Ownership & Scoping

| File | Lines | Namespace / Scope | Verdict |
|------|------:|-------------------|---------|
| `globals.css` | 21 | Imports only (`@import`) | ✅ Clean |
| `base.css` | ~128 | `:root` tokens, `body`, `html`, `*`, accessibility helpers | ✅ Intentional globals |
| `layout.css` | ~118 | `.app-container`, `.tab-bar`, `.app-header`, `.main-content`, `.desktop-block` | ⚠️ Generic names |
| `components.css` | 313 | `.card`, `.btn-*`, `.input`, `.toast`, `.badge`, `.filter-*`, `.modal-*`, `.avatar-*`, `.photo-upload-*`, `.select-*` | ⚠️ Several bare generic names |
| `grid.css` | ~111 | `.profile-grid`, `.virtual-grid-*`, `.grid-card*`, `.badge-*`, `.likes-section` | ✅ Namespaced |
| `swipe.css` | ~162 | `.swipe-*` | ✅ Namespaced |
| `chat.css` | 214 | `.chat-*`, `.message-*` | ✅ Namespaced |
| `profile.css` | ~66 | `.profile-*` | ✅ Namespaced |
| `profile-edit.css` | 623 | `.profile-edit-*`, `.photo-*` | ✅ Namespaced |
| `landing.css` | 1 484 | `.landing-*`, `.demo-*`, `.phone-frame` | ✅ Namespaced |
| `event-bg.css` | ~145 | `:root:has([data-event-bg]) .…` (override layer) | ✅ Tightly scoped |
| `event-over.css` | 383 | `.eo-*` | ✅ Short prefix |
| `how-it-works.css` | 390 | `.hiw-*` | ✅ Namespaced |
| `home.css` | 466 | `.hp-*` | ✅ Namespaced |
| `wizard.css` | 1 896 | `.wiz-*` | ✅ Namespaced |
| `pricing.css` | 344 | `.pricing-*` | ✅ Namespaced |
| `site-page.css` | 202 | `.site-page`, `.legal-drawer` | ✅ Namespaced |
| `guest-portal.css` | 935 | `.portal-*`, `.wa-*` | ✅ Namespaced |
| `admin.css` | 4 227 | `.admin-*`, `.et-*`, `.ea-*`, `.pt-*`, `.ga-*`, `.ad-*`, `.ced-*`, `.req-*`, `.msg-*`, `.act-*`, `.pay-*` + own `--admin-*` variables | ✅ Self-contained system |

---

## 1 · Global Collision Risks

### 1.1 `@keyframes` name collisions

| Keyframe name | File A | File B | Risk |
|---------------|--------|--------|------|
| `shimmer` | `base.css` L124 | `admin.css` L3903 | **Duplicate definition** - admin.css redefines `shimmer` with identical semantics. Because both are loaded, last-write-wins ordering determines the active version. **Fix:** rename to `admin-shimmer` in admin.css, or delete the duplicate since it inherits the global one. |
| `pulse` | `event-over.css` L354 | (Tailwind's built-in `pulse` via `animate-pulse`) | **Potential shadow** - Tailwind ships its own `@keyframes pulse`. If both are in the cascade, event-over's definition may leak. **Fix:** rename to `eo-pulse`. |

### 1.2 Generic class names without namespace

| Selector | File | Line | Risk | Fix |
|----------|------|------|------|-----|
| `.card` | `components.css` | 6 | Very common name; can clash with Tailwind plugin or third-party CSS | Rename to `.ev-card` or scope |
| `.badge` | `components.css` | ~145 | Generic | Rename to `.ev-badge` |
| `.input` | `components.css` | ~84 | Generic, mirrors HTML `<input>` | Rename to `.ev-input` |
| `.toast` | `components.css` | ~126 | Conflictable | Rename to `.ev-toast` |
| `.spinner` | `components.css` | ~117 | Generic | Rename to `.ev-spinner` |
| `.name` | `grid.css` (inside `.card-overlay`) | ~45 | Bare `.name` used inside `.card-overlay .name` - fragile descendant selector | Rename to `.grid-card-name` |

### 1.3 Bare element selectors

These are intentional and scoped enough but should be noted:

- `html`, `body`, `*` in `base.css` - expected for a design-system reset.
- `.landing-demo__text h3`, `.landing-demo__text p` in `landing.css` - scoped under parent, acceptable.

---

## 2 · Token / CSS-Variable Consistency

### 2.1 🐛 BUG: Undefined variable `--text-primary`

`var(--text-primary)` is **never defined** in `:root` (base.css). Four references resolve to the browser's initial value (likely transparent/none), making the property silently fail.

| File | Line | Selector | Fix |
|------|------|----------|-----|
| `chat.css` | 46 | `.chat-last-msg--unread` | → `var(--foreground)` |
| `wizard.css` | 1111 | `.wiz-wa-body` | → `var(--foreground)` |
| `wizard.css` | 1196 | `.wiz-wa-preview` child | → `var(--foreground)` |
| `guest-portal.css` | 888 | `.portal-…` element | → `var(--foreground)` |

### 2.2 Raw hex / rgba values that should use tokens

Below, **Token** is the matching variable from `base.css :root`.

#### `swipe.css` - 6 violations

| Line (approx) | Raw value | Token equivalent |
|---------------|-----------|-----------------|
| ~50 | `#4ade80` | `var(--success)` (`#34D399` is close; or add `--success-light`) |
| ~55 | `#f87171` | `var(--danger)` (`#DC2626` family) |
| ~70 | `#fff` | `var(--foreground)` |
| ~80 | `rgba(255,255,255,0.7)` | `var(--foreground)` at 70% or dedicated token |
| ~100 | `rgba(0,0,0,0.3)` | (shadow - tolerable) |
| ~145 | `#4ade80` / `#f87171` for badges | Same as above |

#### `home.css` - 5 violations

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~10 | `#060606` | Close to `var(--background)` (`#0A0A0A`) |
| ~12 | `#f0ede8` | `var(--foreground)` |
| ~18 | `#d4a59a` | `var(--primary)` |
| ~30 | `#6fcf97` | `var(--success)` (`#34D399` close) |
| ~55 | `#c9a580` | `var(--accent-gold)` |

#### `site-page.css` - 4 violations

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~8 | `#141212` | `var(--background)` (or near-match) |
| ~20 | `#f0f0f0` | `var(--foreground)` |
| ~50 | `#fff` | `var(--foreground)` |
| ~70 | `#888` | `var(--text-muted)` |

#### `landing.css` - 3 violations

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~5 | `#141212` | `var(--background)` |
| ~35 | `#f0ede8` | `var(--foreground)` |
| ~200 | `rgba(212,165,154,0.2)` | `var(--primary)` at opacity |

#### `event-over.css` - 2 violations

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~10 | `#060606` | `var(--background)` |
| ~15 | `#f0ede8` | `var(--foreground)` |

#### `how-it-works.css` - 1 violation

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~15 | `#f0ede8` | `var(--foreground)` |

#### `wizard.css` - 1 violation

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~5 | `#080808` | `var(--background)` |

#### `grid.css` - 1 violation

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~72 | `#1a1a1a` | Should be `var(--surface)` or a new `--badge-bg` token |

#### `layout.css` - 2 violations

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~30 | `rgba(10,10,10,0.75)` | Use `color-mix(in srgb, var(--background) 75%, transparent)` or token |
| ~45 | `rgba(255,255,255,0.60)` | `var(--foreground)` at 60% opacity |

#### `components.css` - 1 violation

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~88 | `rgba(255,255,255,0.12)` for `.input` background | `var(--glass-bg)` (identical value) |

#### `profile-edit.css` - 1 violation

| Line (approx) | Raw value | Token |
|---------------|-----------|-------|
| ~400+ | `rgba(239,68,68,*)` for error states | `var(--danger)` at varying opacities |

#### `guest-portal.css` - WhatsApp brand colors

`#1f2c34`, `#0b141a`, `#00a884`, `#25d366`, `#dcf8c6` - these are **intentional** WA brand-identity colors. **No fix needed**, but consider adding a comment block to document the intent.

#### `admin.css` - Self-contained system

Admin uses its own `--admin-*` variables consistently with fallback values like `var(--admin-accent, #7c3aed)`. This is **correct and intentional** - admin is a separate design system. No violations within its own scope. The only note is the `@keyframes shimmer` duplicate mentioned in §1.1.

### 2.3 Summary count

| Severity | Count |
|----------|------:|
| 🐛 Undefined variable usage | **4** |
| 🟡 Raw color → should use token | **~27** |
| ✅ Intentional brand colors (WA) | 5 (no fix) |

---

## 3 · Dead CSS (Unused Selectors)

Searched every class name against all `.tsx` files in the project.

### 3.1 Confirmed dead code

| Selector(s) | File | Lines (approx) | Evidence |
|-------------|------|-----------------|----------|
| `.photo-upload-grid`, `.photo-upload-slot`, `.photo-upload-slot--filled`, `.photo-upload-slot--empty` | `components.css` | 267–307 | 0 TSX matches. Photo upload uses `.profile-edit-photos-grid` from `profile-edit.css` instead. |
| `.select-group`, `.select-option`, `.select-option.selected` | `components.css` | ~96–114 | 0 TSX matches anywhere in the codebase. |
| `.card` (bare) | `components.css` | 6–22 | 0 TSX files use `className="card"`. All cards use prefixed names (`grid-card`, `pricing-card`, `swipe-card-inner`, `wiz-card`, etc.). |
| `.chat-header` override | `event-bg.css` | 170–173 | Targets a class that has **no definition** in any CSS file and **no usage** in any TSX file. Phantom override. |

**Estimated dead CSS: ~70 lines** (components.css ~55 lines + event-bg.css ~4 lines + `.card` ~16 lines).

### 3.2 Low-usage / at-risk selectors (used in 1 place only)

| Selector | File | TSX usage count | Notes |
|----------|------|:-:|-------|
| `.filter-bar`, `.filter-chip` | `components.css` | 1 | Only in `[eventSlug]/page.tsx` |
| `.chat-upload-indicator` | `chat.css` | 1 | Only in conversation `page.tsx` |
| `.avatar-placeholder` | `components.css` | 3 | Used but could be deduplicated |

---

## 4 · Mobile-First Compliance

### 4.1 Files with **zero** responsive breakpoints

| File | Lines | Impact |
|------|------:|--------|
| **`chat.css`** | 214 | **HIGH** - Chat is a core mobile-first feature. Messages, input bar, and list items have no responsive adaptation. On very small screens (< 360px) the message input bar may overflow. |
| **`swipe.css`** | ~162 | **HIGH** - Swipe cards are the primary mobile interaction. Button sizes, card dimensions, and badge sizes are fixed. No adaptation for small phones (< 360px) or landscape orientation. |
| **`profile.css`** | ~66 | MEDIUM - Short file, profile detail view. May rely on parent layout breakpoints, but no explicit adaptation. |

### 4.2 Files with responsive breakpoints - but gaps

| File | Breakpoints present | Missing |
|------|-------------------|---------|
| `wizard.css` | 480px, 360px | No 768px tablet breakpoint. The wizard form fields may be overly wide on tablets. |
| `landing.css` | 768px, 480px | No 360px tiny-phone breakpoint. Demo phone frame may clip on very small screens. |
| `event-over.css` | 380px | Single breakpoint only. No tablet adaptation. |
| `how-it-works.css` | 480px | Single breakpoint only. |
| `home.css` | 480px | Single breakpoint only. |
| `pricing.css` | 640px | Single breakpoint. Cards stack at 640px but no further adaptation for tiny screens. |

### 4.3 Files with good responsive coverage

| File | Breakpoints |
|------|------------|
| `admin.css` | 860px, 768px, 700px, 640px, 480px, 380px - **Excellent coverage** |
| `profile-edit.css` | Relies on flex/grid intrinsic sizing - acceptable for the content type |
| `guest-portal.css` | 480px + flex-based - adequate |
| `grid.css` | Uses `auto-fill` / `minmax` grids - inherently responsive |

### 4.4 Specific recommendations

1. **`chat.css`**: Add at minimum:
   ```css
   @media (max-width: 360px) {
     .message-input-bar { gap: 4px; padding: 6px 8px; }
     .message-input-bar input { font-size: 14px; }
     .chat-name { font-size: 14px; }
   }
   ```

2. **`swipe.css`**: Add:
   ```css
   @media (max-width: 360px) {
     .swipe-card-name { font-size: 20px; }
     .swipe-card-actions { gap: 12px; }
     .swipe-btn { width: 48px; height: 48px; }
   }
   ```

3. **`wizard.css`**: Add a 768px breakpoint for tablet form layout.

---

## Priority Action Items

| # | Severity | Action | Files |
|---|----------|--------|-------|
| 1 | 🔴 Bug | Fix `var(--text-primary)` → `var(--foreground)` in 4 locations | `chat.css`, `wizard.css` ×2, `guest-portal.css` |
| 2 | 🟡 Cleanup | Delete ~70 lines of dead CSS (`.photo-upload-grid/slot`, `.select-group/option`, `.card`, `.chat-header` phantom override) | `components.css`, `event-bg.css` |
| 3 | 🟡 Consistency | Replace ~27 raw hex/rgba values with CSS variable references | `swipe.css`, `home.css`, `site-page.css`, `landing.css`, `event-over.css`, `how-it-works.css`, `wizard.css`, `grid.css`, `layout.css`, `components.css`, `profile-edit.css` |
| 4 | 🟡 Responsive | Add responsive breakpoints to `chat.css` and `swipe.css` | `chat.css`, `swipe.css` |
| 5 | 🟢 Hygiene | Rename `@keyframes shimmer` duplicate in admin.css (or delete) | `admin.css` |
| 6 | 🟢 Hygiene | Rename `@keyframes pulse` in event-over.css to `eo-pulse` | `event-over.css` |
| 7 | 🟢 Hygiene | Consider namespacing generic class names (`.card`, `.badge`, `.input`, `.toast`, `.spinner`) | `components.css` |

---

*Report generated from full file reads of all 19 CSS files + TSX usage searches across the codebase.*
