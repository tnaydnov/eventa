# Eventa - Accessibility Audit Report (WCAG 2.1 AA / Israeli Standard 5568)

**Date:** June 2025  
**Scope:** Full read-only audit of all `.tsx` files under `src/app/`, `src/components/`, and `src/app/dating/_components/`  
**Standard:** WCAG 2.1 Level AA / Israeli Standard 5568  
**Project:** Next.js Hebrew RTL PWA (dating layer for events)

---

## Executive Summary

The project has strong accessibility foundations: `lang="he" dir="rtl"` on the root `<html>`, a skip-to-content link, global `:focus-visible` ring, `prefers-reduced-motion` handling, and consistent use of `aria-hidden="true" focusable="false"` on decorative SVGs. Most pages have `<h1>` elements, all dialogs use `role="dialog" aria-modal="true"` with focus traps, and form validation uses `aria-invalid` + `role="alert"`.

However, **16 genuine issues** remain across the categories below. The most impactful are missing labels in the chat input bar, keyboard-inaccessible interactive elements, and undersized touch targets.

---

## Issues Found

### 1 · CRITICAL - Missing Labels in Chat Input Bar

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/chat/[conversationId]/_components/ChatInputBar.tsx` |
| **Lines** | 27, 49, 57 |
| **WCAG** | 1.3.1 Info and Relationships, 4.1.2 Name Role Value |

**Description:**  
Three interactive controls have no accessible name:

- **Line 27** - Camera/photo upload `<button>` contains only a `<CameraIcon>` (decorative, `aria-hidden="true"`). The button itself has no `aria-label`, so screen readers announce it as an empty button.
- **Line 49** - Message text `<input>` has `placeholder="הקלידו הודעה..."` but no `<label>`, `aria-label`, or `aria-labelledby`. Placeholder alone is not a reliable accessible name.
- **Line 57** - Send `<button>` contains only an SVG icon (no `aria-hidden` on the SVG, but no text content either). Screen readers cannot determine its purpose.

**Suggested Fix:**
```tsx
// Camera button - add aria-label
<button aria-label="שליחת תמונה" onClick={...}>

// Text input - add aria-label
<input aria-label="הקלידו הודעה" placeholder="הקלידו הודעה..." ... />

// Send button - add aria-label
<button aria-label="שליחת הודעה" onClick={onSend} disabled={...}>
```

---

### 2 · CRITICAL - Clickable User Info Not Keyboard-Accessible

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/chat/[conversationId]/_components/ChatHeader.tsx` |
| **Line** | 43–55 |
| **WCAG** | 2.1.1 Keyboard |

**Description:**  
The `<div>` wrapping the user's avatar + name (`onClick={onUserClick}`, `cursor: pointer`) has no `role`, `tabIndex`, or `onKeyDown` handler. Keyboard users cannot activate this control to view the other user's profile.

**Suggested Fix:**
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={onUserClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onUserClick(); } }}
  aria-label={`צפייה בפרופיל של ${otherUser.display_name}`}
  style={{ ... }}
>
```

---

### 3 · SERIOUS - Back Button Below Minimum Touch Target

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/chat/[conversationId]/_components/ChatHeader.tsx` |
| **Line** | 30–38 |
| **WCAG** | 2.5.8 Target Size (Minimum) |

**Description:**  
The back button (`←`) has inline `padding: '4px'` and `fontSize: '18px'` with no explicit `minWidth`/`minHeight`. The rendered size is approximately 26×26px - well below the 44×44px WCAG minimum. By contrast, the menu button at line 75 correctly sets `minWidth: '44px', minHeight: '44px'`.

**Suggested Fix:**
```tsx
<button
  onClick={onBack}
  aria-label="חזרה"
  style={{ ..., padding: '8px', minWidth: '44px', minHeight: '44px' }}
>
```

---

### 4 · SERIOUS - Photo Grid Items Not Keyboard-Accessible

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/profile/_components/ProfilePhotoGrid.tsx` |
| **Lines** | 175–199 |
| **WCAG** | 2.1.1 Keyboard |

**Description:**  
Each existing photo `<div>` has `onClick={() => handlePhotoTap(idx)}` and `draggable` for reordering but is missing `role`, `tabIndex`, and `onKeyDown`. Keyboard users cannot select photos to swap/reorder. The "add photo" placeholder at line 224 correctly has `role="button"`, `tabIndex={0}`, and `onKeyDown` - the existing photo items should match.

**Suggested Fix:**
```tsx
<div
  key={photo.id}
  role="button"
  tabIndex={0}
  aria-label={`תמונה ${idx + 1}${idx === 0 ? ' (ראשית)' : ''}${selectedIdx === idx ? ' - נבחרה' : ''}`}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePhotoTap(idx); } }}
  onClick={() => handlePhotoTap(idx)}
  draggable
  ...
>
```

---

### 5 · SERIOUS - Photo Delete Buttons Missing Accessible Name

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/profile/_components/ProfilePhotoGrid.tsx` |
| **Line** | 211 |
| **WCAG** | 4.1.2 Name Role Value |

**Description:**  
Each photo's delete `<button>` uses `✕` as its text content with no `aria-label`. Screen readers will announce "✕" which is meaningless.

**Suggested Fix:**
```tsx
<button
  type="button"
  aria-label={`מחיקת תמונה ${idx + 1}`}
  className="profile-edit-photo-remove"
  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
>✕</button>
```

---

### 6 · SERIOUS - Guest Portal Form Inputs Missing Labels

| Field | Value |
|-------|-------|
| **File** | `src/app/guest-upload/[slug]/_components/AddPhoneForm.tsx` |
| **Lines** | 49, 57 |
| **WCAG** | 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions |

**Description:**  
Both inputs rely on `placeholder` alone as their accessible name:
- **Line 49** - Name input: `placeholder="שם (אופציונלי)"`, no `<label>` or `aria-label`.
- **Line 57** - Phone input: `placeholder="050-1234567"`, no `<label>` or `aria-label`.

**Suggested Fix:**
```tsx
<input aria-label="שם (אופציונלי)" placeholder="שם (אופציונלי)" ... />
<input aria-label="מספר טלפון" placeholder="050-1234567" ... />
```

---

### 7 · SERIOUS - Guest Portal Search Input Missing Label

| Field | Value |
|-------|-------|
| **File** | `src/app/guest-upload/[slug]/_components/GuestListTable.tsx` |
| **Line** | 85 |
| **WCAG** | 1.3.1 Info and Relationships |

**Description:**  
The guest search `<input>` has `placeholder="🔍 חיפוש לפי שם או מספר טלפון..."` but no `<label>` or `aria-label`. Placeholder text is not a substitute for a label.

**Suggested Fix:**
```tsx
<input
  type="text"
  aria-label="חיפוש לפי שם או מספר טלפון"
  placeholder="🔍 חיפוש לפי שם או מספר טלפון..."
  ...
/>
```

---

### 8 · SERIOUS - Guest Portal Error Not Announced

| Field | Value |
|-------|-------|
| **File** | `src/app/guest-upload/[slug]/_components/AddPhoneForm.tsx` |
| **Line** | 72 |
| **WCAG** | 4.1.3 Status Messages |

**Description:**  
The form error message is rendered as a plain `<p>` with styled red text but no `role="alert"` or `aria-live`. Screen readers will not announce the error when it appears.

**Suggested Fix:**
```tsx
<p role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 8 }}>
  {error}
</p>
```

---

### 9 · MODERATE - Guest Remove Button Missing Accessible Name

| Field | Value |
|-------|-------|
| **File** | `src/app/guest-upload/[slug]/_components/GuestListTable.tsx` |
| **Line** | 119 |
| **WCAG** | 4.1.2 Name Role Value |

**Description:**  
The remove button uses the 🗑 emoji as its text content and has a `title` attribute but no `aria-label`. While `title` provides a tooltip, `aria-label` is more reliably announced by screen readers.

**Suggested Fix:**
```tsx
<button
  className="portal-guest-remove"
  aria-label={`הסרת ${guest.name || guest.phone}`}
  title={guest.sent ? 'לא ניתן להסיר - כבר נשלחה הודעה' : 'הסרה'}
  ...
>🗑</button>
```

---

### 10 · MODERATE - Guest List Uses Divs Instead of Table Semantics

| Field | Value |
|-------|-------|
| **File** | `src/app/guest-upload/[slug]/_components/GuestListTable.tsx` |
| **Lines** | 95–130 |
| **WCAG** | 1.3.1 Info and Relationships |

**Description:**  
The guest list displays tabular data (name, phone, status, action) using `<div>` elements with CSS grid/flex styling. Screen readers cannot convey column/row relationships. This is a data table by nature ("GuestListTable").

**Suggested Fix:**  
Replace the div structure with a semantic `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` structure, or add ARIA table roles (`role="table"`, `role="row"`, `role="cell"`, etc.) to the existing divs.

---

### 11 · MODERATE - Likes Page Tab Pattern Incomplete

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/likes/page.tsx` |
| **Lines** | 146–175 |
| **WCAG** | 4.1.2 Name Role Value |

**Description:**  
The three tab buttons all share `aria-controls="tabpanel-likes"` pointing to the same panel. Per the ARIA tabs pattern:
- Each `<button role="tab">` should have a unique `id`.
- Each tab panel should reference the active tab via `aria-labelledby`.
- Arrow key navigation between tabs is expected (currently only click/Enter works).

**Suggested Fix:**
```tsx
<button role="tab" id="tab-matches" aria-selected={tab === 'matches'} aria-controls="tabpanel-matches" ...>
<button role="tab" id="tab-received" aria-selected={tab === 'received'} aria-controls="tabpanel-received" ...>
<button role="tab" id="tab-sent" aria-selected={tab === 'sent'} aria-controls="tabpanel-sent" ...>

<div id="tabpanel-matches" role="tabpanel" aria-labelledby="tab-matches" ...>
```

---

### 12 · MODERATE - Swipe Card Photo Navigation Not Keyboard-Accessible

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/[eventSlug]/_components/SwipeCard.tsx` |
| **Lines** | 105–114 |
| **WCAG** | 2.1.1 Keyboard |

**Description:**  
Photo navigation within a swipe card works by tapping the left/right halves of the image. There is no keyboard equivalent (e.g., arrow keys) to cycle through photos. The like/skip/profile buttons ARE keyboard-accessible, but the photo gallery within the card is not.

**Suggested Fix:**  
Add `onKeyDown` for `ArrowLeft`/`ArrowRight` on the card container (or when focused on the card) to cycle photos, or add small prev/next buttons with `aria-label`.

---

### 13 · MODERATE - Event-Over Countdown Not Announced

| Field | Value |
|-------|-------|
| **File** | `src/app/dating/event-over/page.tsx` |
| **Lines** | 154–160 |
| **WCAG** | 4.1.3 Status Messages |

**Description:**  
The auto-redirect countdown timer (15 → 0 seconds with ring animation) has no `role="timer"` or `aria-live` region. Screen reader users will not be informed that an automatic redirect is happening or how much time remains.

**Suggested Fix:**
```tsx
<div className="eo__bottom" role="timer" aria-live="polite" aria-label={`מועברים לאתר הראשי בעוד ${countdown} שניות`}>
```

---

### 14 · MODERATE - Onboarding Slide Indicators Not Accessible

| Field | Value |
|-------|-------|
| **File** | `src/components/OnboardingSlides.tsx` |
| **Lines** | 121–127 |
| **WCAG** | 4.1.2 Name Role Value |

**Description:**  
The dot indicators showing current slide position are empty `<div>` elements styled visually. They convey no information to screen readers - users cannot tell which slide they're on or how many there are.

**Suggested Fix:**
```tsx
<div style={styles.dots} role="group" aria-label="מיקום בשקופיות">
  {SLIDES.map((_, i) => (
    <div
      key={i}
      role="img"
      aria-label={`שקופית ${i + 1} מתוך ${SLIDES.length}${i === current ? ' (נוכחית)' : ''}`}
      style={{ ...styles.dot, ...(i === current ? styles.dotActive : {}) }}
    />
  ))}
</div>
```

---

### 15 · MINOR - Heading Hierarchy: ErrorBoundary Uses `<h2>` Without `<h1>`

| Field | Value |
|-------|-------|
| **File** | `src/components/ErrorBoundary.tsx` |
| **Line** | 44 |
| **WCAG** | 1.3.1 Info and Relationships |

**Description:**  
The fallback UI uses `<h2>אופס, משהו השתבש</h2>` but there is no `<h1>` on the page when this component renders as the sole content. Since it replaces the entire page content, it should use `<h1>`.

**Suggested Fix:**
```tsx
<h1 style={{ fontSize: '20px', color: '#e91e63', margin: 0 }}>
  אופס, משהו השתבש
</h1>
```

---

### 16 · MINOR - How-It-Works Demo Phone: Decorative SVGs Missing `aria-hidden`

| Field | Value |
|-------|-------|
| **File** | `src/app/how-it-works/page.tsx` |
| **Lines** | 100–108 (HIcon object) |
| **WCAG** | 1.1.1 Non-text Content |

**Description:**  
Several inline SVGs in the `HIcon` object (used inside the `PhoneScreen` demo component) lack `aria-hidden="true" focusable="false"`. While the demo phone is largely decorative (`aria-hidden` is set on parent in some places), the SVGs like `send`, `camera`, `back` defined at lines 100–108 are missing these attributes, which could cause screen readers to try to announce empty SVG content.

**Suggested Fix:**
```tsx
send: <svg aria-hidden="true" focusable="false" width="16" height="16" ...>,
camera: <svg aria-hidden="true" focusable="false" width="16" height="16" ...>,
back: <svg aria-hidden="true" focusable="false" width="18" height="18" ...>,
```

---

## Summary Table

| # | Severity | Component | Issue |
|---|----------|-----------|-------|
| 1 | **CRITICAL** | ChatInputBar | 3 controls (camera, input, send) have no accessible name |
| 2 | **CRITICAL** | ChatHeader | Clickable user info div not keyboard-accessible |
| 3 | **SERIOUS** | ChatHeader | Back button ~26×26px (needs 44×44px min) |
| 4 | **SERIOUS** | ProfilePhotoGrid | Existing photo items lack role/tabIndex/keyboard handler |
| 5 | **SERIOUS** | ProfilePhotoGrid | Delete photo buttons missing aria-label |
| 6 | **SERIOUS** | AddPhoneForm | Both inputs rely on placeholder only (no label) |
| 7 | **SERIOUS** | GuestListTable | Search input missing label |
| 8 | **SERIOUS** | AddPhoneForm | Error message not announced (no role="alert") |
| 9 | **MODERATE** | GuestListTable | Remove button: emoji-only, no aria-label |
| 10 | **MODERATE** | GuestListTable | Tabular data rendered with divs, no table semantics |
| 11 | **MODERATE** | Likes page | Incomplete ARIA tabs pattern (shared aria-controls, no ids) |
| 12 | **MODERATE** | SwipeCard | Photo navigation within card not keyboard-accessible |
| 13 | **MODERATE** | Event-over page | Auto-redirect countdown not announced to screen readers |
| 14 | **MODERATE** | OnboardingSlides | Dot indicators convey no info to screen readers |
| 15 | **MINOR** | ErrorBoundary | Uses `<h2>` where `<h1>` is appropriate |
| 16 | **MINOR** | How-It-Works | Some inline SVGs in HIcon missing aria-hidden |

**Total: 2 Critical · 6 Serious · 6 Moderate · 2 Minor**

---

## What's Done Well (Not Exhaustive)

- ✅ `<html lang="he" dir="rtl">` on root layout
- ✅ Skip-to-content link with proper CSS
- ✅ `<main id="main-content">` on all pages
- ✅ Global `:focus-visible` ring (`2px solid var(--primary)`, `offset: 2px`)
- ✅ `prefers-reduced-motion` in base.css → `animation-duration: 0.01ms !important`
- ✅ `<h1>` present on every page/view
- ✅ All decorative SVGs consistently use `aria-hidden="true" focusable="false"`
- ✅ All dialogs: `role="dialog" aria-modal="true"` + focus trap + Escape key close
- ✅ Form validation: `aria-invalid`, `aria-describedby`, `role="alert"` on errors
- ✅ TabBar: `aria-current="page"`, `aria-label` with badge counts
- ✅ Grid/Likes cards: `role="button" tabIndex={0}` + keyboard handlers
- ✅ Chat page: `role="menu"` + `role="menuitem"` dropdown, `role="dialog"` fullscreen viewer
- ✅ User profile carousel: `role="region" aria-roledescription="קרוסלה"` + arrow key nav
- ✅ Feedback page: `role="progressbar"`, `aria-pressed` on options
- ✅ Toast: `role="status" aria-live="polite"`
- ✅ Network status: `role="alert" aria-live="assertive"`
- ✅ Loading skeletons: `role="status" aria-label="טוען..."` variants
- ✅ SR-only class defined and used appropriately
- ✅ Custom checkboxes: `role="checkbox" aria-checked` + keyboard handler
- ✅ Phone input: `role="combobox"` + `aria-expanded` + `aria-activedescendant`
