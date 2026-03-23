/**
 * Email templates for Eventa.
 *
 * 10 templates total:
 *
 *   Client-facing (7):
 *     C1. Call Me Back - client filled the form, wants a callback
 *     C3. Contact Only - client left contact details without filling event form
 *     C4. Approval - order approved, charged, event created
 *     C5. Upload Reminder (7-day) - guest list upload reminder
 *     C6. Upload Reminder (3-day) - urgent guest list upload reminder
 *     C7. Event Summary - post-event stats (day after)
 *     C8. QR Page Ready - A4 print page with QR code attachments
 *
 *   Admin-facing (3):
 *     A1. Payment Received - payment completed, event auto-created
 *     A2. Call Me Back - client filled form, wants callback
 *     A3. Contact Only - client wants contact, no event form filled
 *
 * Design rules for email HTML RTL:
 *  - Gmail strips dir from <html>/<body>, so EVERY <td> gets dir="rtl" + text-align:right
 *  - Table-based layout only (no flexbox/grid) for Outlook + Gmail
 *  - No emojis in email body
 *  - English words (brand, phone, email) in dir="ltr" spans with unicode-bidi:isolate
 *  - Logo from https://www.eventa.productions/icons/Eventa_Logo.png
 *
 * Design system:
 *  - Card shadow, pill-shaped CTAs, accent section titles, step pills
 *  - Responsive: max-width 600px card, 100% on mobile
 *  - Typography: base 15px, titles 18px bold, labels 14px semi-bold, values 15px
 */

import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { BASE_PRICE } from '@/lib/config';

/** Light logo (shown on dark backgrounds / dark mode). */
const LOGO_LIGHT = 'https://www.eventa.productions/icons/Eventa_Logo.png';
/** Dark logo (shown on light backgrounds / light mode). */
const LOGO_DARK  = 'https://www.eventa.productions/icons/Eventa_Logo_Dark.png';

/* ג”€ג”€ג”€ Shared palette ג”€ג”€ג”€ */
const C = {
  bg:        '#f5f3f0',
  card:      '#ffffff',
  text:      '#1e1e1e',
  muted:     '#6b6b6b',
  dim:       '#999999',
  border:    '#ece7e4',
  accent:    '#b08d7e',
  accentBg:  '#faf6f4',
  rowAlt:    '#faf7f4',
  success:   '#2e7d32',
  successBg: '#e8f5e9',
  warn:      '#c27816',
  warnBg:    '#fef9f0',
} as const;

/** Shorthand: every <td> in the email needs this for RTL to work in Gmail. */
const RTL = 'dir="rtl" style="text-align:right;"';


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   UTILITY FUNCTIONS
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

/** Escape HTML special characters. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap an English/LTR string so it doesn't flip inside RTL context. */
function ltr(s: string): string {
  return `<span dir="ltr" style="unicode-bidi:isolate;">${s}</span>`;
}

/** Format ISO datetime ג†’ Hebrew date string. */
function fmtDate(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

/** Format ISO datetime ג†’ HH:MM. */
function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/** Format ISO datetime ג†’ "׳™׳•׳ ׳¨׳‘׳™׳¢׳™, 15 ׳‘׳׳₪׳¨׳™׳ 2026 ׳‘׳©׳¢׳” 19:00". */
function fmtDateTime(iso: string): string {
  if (!iso) return '-';
  const d = fmtDate(iso);
  const t = fmtTime(iso);
  return t ? `${d} \u05D1\u05E9\u05E2\u05D4 ${ltr(t)}` : d;
}

/**
 * Schedule info block: shows message send time and upload deadline.
 * Returns a full <tr> with a table inside an accentBg box.
 */
function scheduleBlock(messageSendAt: string, uploadDeadline: string): string {
  return `
        <tr>
          <td ${RTL} style="text-align:right;padding:20px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05DC\u05D5\u05D7 \u05D6\u05DE\u05E0\u05D9\u05DD')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;background-color:${C.accentBg};border-radius:8px;overflow:hidden;">
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 18px;border-bottom:1px solid ${C.border};background-color:${C.accentBg};color:${C.muted};font-size:14px;font-weight:600;width:140px;vertical-align:top;line-height:1.5;">\u05D3\u05D3\u05DC\u05D9\u05D9\u05DF \u05DC\u05D4\u05E2\u05DC\u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05D4</td>
                <td dir="rtl" style="text-align:right;padding:14px 18px;border-bottom:1px solid ${C.border};background-color:${C.accentBg};color:${C.text};font-size:15px;line-height:1.5;font-weight:600;">${fmtDateTime(uploadDeadline)}</td>
              </tr>
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 18px;background-color:${C.accentBg};color:${C.muted};font-size:14px;font-weight:600;width:140px;vertical-align:top;line-height:1.5;">\u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA</td>
                <td dir="rtl" style="text-align:right;padding:14px 18px;background-color:${C.accentBg};color:${C.text};font-size:15px;line-height:1.5;font-weight:600;">${fmtDateTime(messageSendAt)}</td>
              </tr>
            </table>
          </td>
        </tr>`;
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   DESIGN-SYSTEM HELPERS
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

/** Build a two-column info row: label | value. Both cells are RTL. */
function row(label: string, value: string, isLast = false): string {
  const bb = isLast ? '' : `border-bottom:1px solid ${C.border};`;
  return `<tr>
    <td dir="rtl" style="text-align:right;padding:12px 4px 12px 12px;${bb}background-color:${C.card};color:#555555;font-size:14px;font-weight:600;width:100px;vertical-align:top;line-height:1.5;">${label}</td>
    <td dir="rtl" style="text-align:right;padding:12px 12px 12px 4px;${bb}background-color:${C.card};color:${C.text};font-size:15px;line-height:1.5;">${value}</td>
  </tr>`;
}

/** Section title with accent right-border (visual leading-edge in RTL). */
function sectionTitle(text: string): string {
  return `<div dir="rtl" style="direction:rtl;text-align:right;font-size:18px;font-weight:700;color:${C.text};margin-bottom:14px;padding-right:12px;border-right:3px solid ${C.accent};line-height:1.4;">${text}</div>`;
}

/** Step row with accent-colored number pill. */
function stepRow(num: number, text: string, isLast = false): string {
  const bb = isLast ? '' : `border-bottom:1px solid ${C.border};`;
  return `<tr>
    <td dir="rtl" style="text-align:right;padding:14px 4px 14px 8px;${bb}background-color:${C.card};vertical-align:middle;width:44px;">
      <div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background-color:${C.accent};color:#ffffff;font-size:14px;font-weight:700;margin:0 auto;">${num}</div>
    </td>
    <td dir="rtl" style="text-align:right;padding:14px 12px 14px 4px;${bb}background-color:${C.card};color:${C.text};font-size:15px;line-height:1.5;vertical-align:middle;">${text}</td>
  </tr>`;
}

/** Pill-shaped CTA button with shadow. Returns a full <tr>. */
function ctaBtn(href: string, text: string, bgColor: string = C.accent): string {
  return `
        <tr>
          <td style="padding:28px 32px 12px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(href)}" style="display:inline-block;text-decoration:none;background-color:${bgColor};border-radius:999px;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.13);" target="_blank">
                    ${text}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Section divider - a soft horizontal line with spacing. */
function divider(): string {
  return `
        <tr>
          <td style="padding:16px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>`;
}

/** Accent-bordered tip / callout box. Returns a full <tr>. */
function tipBox(html: string): string {
  return `
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:16px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:8px;padding:16px 18px;font-size:14px;color:${C.muted};line-height:1.7;">
              ${html}
            </div>
          </td>
        </tr>`;
}

/** Standardized support email row at bottom of card. */
function supportRow(): string {
  return `
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:13px;color:${C.dim};">
              \u05DC\u05E9\u05D0\u05DC\u05D5\u05EA \u05E0\u05D9\u05EA\u05DF \u05DC\u05E4\u05E0\u05D5\u05EA \u05D0\u05DC\u05D9\u05E0\u05D5&rlm;: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
          </td>
        </tr>`;
}

/** Greeting block: name line + subtitle lines. Returns a full <tr>. */
function greeting(name: string, ...lines: string[]): string {
  return `
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:17px;color:${C.text};font-weight:600;line-height:1.5;">\u05E9\u05DC\u05D5\u05DD ${name}&rlm;,</div>
            ${lines.map((l, i) => `<div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};${i === 0 ? 'margin-top:8px;' : ''}line-height:1.6;${i === lines.length - 1 ? 'padding-bottom:20px;' : ''}">${l}</div>`).join('\n            ')}
          </td>
        </tr>`;
}

/** Contact info card used in admin emails. */
function contactCard(name: string, phone: string, email: string): string {
  return `
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-row-alt" style="direction:rtl;border-collapse:collapse;background-color:${C.rowAlt};border-radius:8px;overflow:hidden;">
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;width:70px;">\u05E9\u05DD</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:${C.rowAlt};color:${C.text};font-size:15px;font-weight:600;">${name}</td>
              </tr>
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${email ? `border-bottom:1px solid ${C.border};` : ''}background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;">\u05D8\u05DC\u05E4\u05D5\u05DF</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${email ? `border-bottom:1px solid ${C.border};` : ''}background-color:${C.rowAlt};">
                  <a href="tel:${phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${phone}</a>
                </td>
              </tr>
              ${email ? `<tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;">\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:${C.rowAlt};">
                  <a href="mailto:${email}" style="color:${C.accent};font-size:15px;text-decoration:none;" dir="ltr">${email}</a>
                </td>
              </tr>` : ''}
            </table>`;
}

/** Colored status banner at the top of an email. */
function statusBanner(text: string, subtext: string | null, bgColor: string, textColor: string): string {
  return `
        <tr>
          <td ${RTL} style="text-align:right;background-color:${bgColor} !important;padding:16px 32px;border-bottom:1px solid ${C.border};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;font-weight:700;color:${textColor};">${text}</div>
            ${subtext ? `<div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.5;">${subtext}</div>` : ''}
          </td>
        </tr>`;
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   DATA INTERFACE & SHARED BLOCKS
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

/** Event form data used by shared helpers (eventDetailsBlock, priceBlock). */
interface EventFormData {
  eventType: string;
  eventName: string;
  startsAt: string;
  endsAt: string;
  wantsCustomBackground: boolean;
  hasBgImage: boolean;
  posterChoice: string;
  selectedTemplate: string;
  specialRequests: string;
  wantsGuestMessages: boolean;
}

/* ג”€ג”€ג”€ Shared email shell ג”€ג”€ג”€ */
/** Wrap template body inside a full HTML email with the correct RTL + logo header. */
function shell(title: string, inner: string, subtitle?: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      body, table, td, div, p, a, span { background-color: ${C.bg} !important; color: ${C.text} !important; }
      .em-card { background-color: ${C.card} !important; }
      .em-row-alt { background-color: ${C.rowAlt} !important; }
      .em-success { background-color: ${C.successBg} !important; }
      .em-warn { background-color: ${C.warnBg} !important; }
      .em-logo-dark  { display: none !important; }
      .em-logo-light { display: inline-block !important; }
    }
    @media only screen and (max-width: 620px) {
      .em-card { width: 100% !important; border-radius: 0 !important; }
      .em-body-pad { padding: 16px 0 !important; }
      .em-inner-pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body dir="rtl" style="margin:0;padding:0;direction:rtl;text-align:right;background-color:${C.bg};color:${C.text};font-family:'Segoe UI',Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-size:15px;line-height:1.5;">

  <!-- Outer wrapper -->
  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;background-color:${C.bg};">
    <tr><td align="center" class="em-body-pad" style="padding:32px 16px;">

      <!-- Main card -->
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" class="em-card" style="direction:rtl;max-width:600px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 3px 12px rgba(0,0,0,0.08);">

        <!-- Accent top strip -->
        <tr><td style="background-color:${C.accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header row: subtitle + logo on one line -->
        <tr>
          <td style="background-color:${C.card};padding:0;border-bottom:1px solid ${C.border};">
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;">
              <tr>
                <!-- Subtitle (RTL start = right) -->
                <td dir="rtl" style="text-align:right;padding:24px 28px 24px 0;vertical-align:middle;">
                  ${subtitle
                    ? `<div dir="rtl" style="direction:rtl;text-align:right;font-size:20px;font-weight:700;color:${C.accent};line-height:1.3;">${subtitle}</div>`
                    : `<div style="font-size:14px;color:${C.dim};letter-spacing:0.5px;">${ltr('EVENTA')}</div>`}
                </td>
                <!-- Logo (RTL end = left), sized to fill row height -->
                <td style="text-align:left;padding:4px 28px 4px 0;vertical-align:middle;">
                  <img class="em-logo-dark" src="${LOGO_DARK}" alt="Eventa" width="130" height="auto" style="display:inline-block;max-width:130px;height:auto;border:0;vertical-align:middle;" />
                  <img class="em-logo-light" src="${LOGO_LIGHT}" alt="Eventa" width="130" height="auto" style="display:none;max-width:130px;height:auto;border:0;vertical-align:middle;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${inner}

      </table>
      <!-- /Main card -->

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" class="em-card" style="max-width:600px;width:100%;">
        <tr>
          <td style="padding:20px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0 20px;text-align:center;font-size:12px;color:${C.dim};opacity:0.7;">
            &copy; ${ltr(String(new Date().getFullYear()))} ${ltr('Eventa')}
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Build the price breakdown table shared by admin & client emails. */
function priceBlock(_wantsGuestMessages: boolean): string {
  return `
        <!-- Price breakdown -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E2\u05DC\u05D5\u05EA')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05D7\u05D1\u05D9\u05DC\u05EA Eventa \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2', ltr(`\u20AA${BASE_PRICE}`))}
              ${_wantsGuestMessages ? row('\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD', '\u05DB\u05DC\u05D5\u05DC \u05D1\u05DE\u05D7\u05D9\u05E8') : ''}
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 0 14px 12px;background-color:${C.card};color:${C.accent};font-size:16px;font-weight:700;width:100px;border-top:2px solid ${C.accent};vertical-align:top;">\u05E1\u05D4\u05F4\u05DB</td>
                <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;background-color:${C.card};color:${C.text};font-size:20px;font-weight:700;border-top:2px solid ${C.accent};">${ltr(`\u20AA${BASE_PRICE}`)}</td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Build the event details + options sections shared by admin & client emails. */
function eventDetailsBlock(data: EventFormData): string {
  const s = {
    eventLabel: escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType),
    eventName: escapeHtml(data.eventName),
    startsAt: fmtDate(data.startsAt),
    startsTime: fmtTime(data.startsAt),
    endsAt: fmtDate(data.endsAt),
    endsTime: fmtTime(data.endsAt),
    template: escapeHtml(data.selectedTemplate),
    specialReqs: escapeHtml(data.specialRequests),
  };

  return `
        <!-- Event info section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E1\u05D5\u05D2 \u05D0\u05D9\u05E8\u05D5\u05E2', `<strong>${s.eventLabel}</strong>`)}
              ${s.eventName ? row('\u05E9\u05DD', s.eventName) : ''}
              ${row('\u05D4\u05EA\u05D7\u05DC\u05D4', `${s.startsAt}${s.startsTime ? `&rlm;, ${ltr(s.startsTime)}` : ''}`)}
              ${row('\u05E1\u05D9\u05D5\u05DD', `${s.endsAt}${s.endsTime ? `&rlm;, ${ltr(s.endsTime)}` : ''}`, true)}
            </table>
          </td>
        </tr>

        <!-- Options section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E8\u05E7\u05E2', data.wantsCustomBackground ? `\u05E8\u05E7\u05E2 \u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA${data.hasBgImage ? ' (\u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05E6\u05D5\u05E8\u05E4\u05EA)' : ''}` : '\u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC')}
              ${row('\u05E4\u05D5\u05E1\u05D8\u05E8', data.posterChoice === 'qr-only' ? `${ltr('QR')} \u05D1\u05DC\u05D1\u05D3` : `\u05EA\u05D1\u05E0\u05D9\u05EA&rlm;: ${s.template}`)}
              ${row('\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD', data.wantsGuestMessages ? '\u05DB\u05DF' : '\u05DC\u05D0', true)}
            </table>
          </td>
        </tr>

        ${s.specialReqs ? `
        <!-- Special requests -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D1\u05E7\u05E9\u05D5\u05EA \u05DE\u05D9\u05D5\u05D7\u05D3\u05D5\u05EA')}
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:8px;padding:16px 18px;font-size:15px;color:${C.text};line-height:1.7;">
              ${s.specialReqs}
            </div>
          </td>
        </tr>` : ''}`;
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C1. CLIENT - CALL ME BACK
   Client filled the full event form and wants to be contacted.
   Shows event summary + "we'll contact you within 48 hours".
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientCallMeBackEmail(data: EventFormData & {
  contactName: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(data.contactName);
  const safeEvent = escapeHtml(data.eventName);

  const subject = `Eventa - \u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA`;

  const inner = `
        ${greeting(
          safeName,
          `\u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong>.`,
          `\u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05D4\u05D5\u05E2\u05D1\u05E8\u05D5 \u05DC\u05E6\u05D5\u05D5\u05EA \u05E9\u05DC\u05E0\u05D5 \u05D5\u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05DA \u05E7\u05E9\u05E8 \u05EA\u05D5\u05DA 48 \u05E9\u05E2\u05D5\u05EA.`,
        )}

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        ${tipBox(`<strong>\u05DE\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5?</strong> \u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05DC\u05E2\u05E9\u05D5\u05EA \u05D3\u05D1\u05E8 - \u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05DA \u05E7\u05E9\u05E8 \u05EA\u05D5\u05DA 48 \u05E9\u05E2\u05D5\u05EA \u05DE\u05E8\u05D2\u05E2 \u05E7\u05D1\u05DC\u05EA \u05D4\u05E4\u05E0\u05D9\u05D9\u05D4.`)}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C2b. CLIENT - PAYMENT LINK
   Client chose "send-link" - receives a payment link by email.
   Shows event summary + price + CTA to payment page.
   Also used when admin resends a payment link.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientPaymentLinkEmail(data: EventFormData & {
  contactName: string;
  paymentUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(data.contactName);
  const safeEvent = escapeHtml(data.eventName);

  const subject = `Eventa - \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD`;

  const inner = `
        ${greeting(
          safeName,
          safeEvent
            ? `\u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong>.`
            : `\u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA.`,
          `\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DC\u05DE\u05E2\u05D1\u05E8 \u05DC\u05D3\u05E3 \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05DE\u05D0\u05D5\u05D1\u05D8\u05D7.`,
        )}

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        ${ctaBtn(data.paymentUrl, '\u05DC\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7')}

        ${tipBox(`\u05DC\u05D0\u05D7\u05E8 \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05E4\u05E8\u05D8\u05D9 \u05D4\u05D0\u05E9\u05E8\u05D0\u05D9 \u05E0\u05E9\u05DE\u05E8\u05D9\u05DD. \u05D4\u05DB\u05E8\u05D8\u05D9\u05E1 \u05DC\u05D0 \u05D9\u05D7\u05D5\u05D9\u05D1 \u05E2\u05D3 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4.`)}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C3. CLIENT - CONTACT ONLY
   Client left contact details without filling the event form.
   Simple confirmation: "we got your details, we'll contact you".
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientContactOnlyEmail(data: {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(data.contactName);
  const safePhone = escapeHtml(data.contactPhone);
  const safeEmail = data.contactEmail ? escapeHtml(data.contactEmail) : '';

  const subject = `Eventa - \u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05E4\u05E0\u05D9\u05D9\u05D4 \u05E9\u05DC\u05DA`;

  const inner = `
        ${greeting(
          safeName,
          `\u05EA\u05D5\u05D3\u05D4 \u05E9\u05E4\u05E0\u05D9\u05EA \u05D0\u05DC\u05D9\u05E0\u05D5!`,
          `\u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05E9\u05DC\u05DA \u05D5\u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05DA \u05E7\u05E9\u05E8 \u05EA\u05D5\u05DA 48 \u05E9\u05E2\u05D5\u05EA.`,
        )}

        <!-- Details you entered -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05E9\u05D4\u05D6\u05E0\u05EA')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E9\u05DD', safeName)}
              ${row('\u05D8\u05DC\u05E4\u05D5\u05DF', ltr(safePhone), !safeEmail)}
              ${safeEmail ? row('\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC', ltr(safeEmail), true) : ''}
            </table>
          </td>
        </tr>

        ${tipBox(`\u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05DC\u05E2\u05E9\u05D5\u05EA \u05D3\u05D1\u05E8 \u05E0\u05D5\u05E1\u05E3 - \u05D4\u05E6\u05D5\u05D5\u05EA \u05E9\u05DC\u05E0\u05D5 \u05D9\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05DA \u05E7\u05E9\u05E8 \u05D1\u05D4\u05E7\u05D3\u05DD.`)}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D4\u05E4\u05E0\u05D9\u05D9\u05D4 \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C4. CLIENT - APPROVAL
   Order approved + charged + event created.
   Full order details + payment confirmation.
   If messaging enabled: portal link + explanation + reminders info.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientApprovalEmail(params: EventFormData & {
  contactName: string;
  totalPriceShekel: number;
  paymentMethod: string;
  eventUrl: string;
  portalUrl?: string;
  messageSendAt?: string;
  uploadDeadline?: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `Eventa - \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D5\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8!`;

  /* Payment confirmation section */
  const paymentSection = `
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E1\u05D8\u05D8\u05D5\u05E1', `<strong style="color:${C.success};">\u05E9\u05D5\u05DC\u05DD \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4</strong>`)}
              ${row('\u05E1\u05DB\u05D5\u05DD', ltr(`\u20AA${params.totalPriceShekel}`))}
              ${row('\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD', escapeHtml(params.paymentMethod))}
              ${row('\u05EA\u05D0\u05E8\u05D9\u05DA \u05D7\u05D9\u05D5\u05D1', fmtDate(new Date().toISOString()), true)}
            </table>
          </td>
        </tr>

        <!-- Invoice note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:12px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.dim};">
              \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05DE\u05E6\u05D5\u05E8\u05E4\u05EA \u05DC\u05DE\u05D9\u05D9\u05DC \u05D6\u05D4.
            </div>
          </td>
        </tr>`;

  /* Messaging section (only if chosen) */
  const waSection = params.wantsGuestMessages && params.portalUrl ? `
        ${divider()}

        <!-- Guest messaging info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};line-height:1.7;margin-bottom:20px;">
              \u05d4\u05d6\u05de\u05e0\u05ea\u05dd \u05d0\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd. \u05db\u05d3\u05d9 \u05e9\u05e0\u05d5\u05db\u05dc \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd \u05e9\u05dc\u05db\u05dd \u05dc\u05e4\u05e0\u05d9 \u05d4\u05d0\u05d9\u05e8\u05d5\u05e2, \u05d9\u05e9 \u05dc\u05d4\u05e2\u05dc\u05d5\u05ea \u05d0\u05ea \u05e8\u05e9\u05d9\u05de\u05ea \u05de\u05e1\u05e4\u05e8\u05d9 \u05d4\u05d8\u05dc\u05e4\u05d5\u05df \u05d3\u05e8\u05da \u05e4\u05d5\u05e8\u05d8\u05dc \u05d4\u05dc\u05e7\u05d5\u05d7.
            </div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, `\u05D4\u05D9\u05DB\u05E0\u05E1\u05D5 \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7`)}
              ${stepRow(2, `\u05D4\u05D5\u05E8\u05D9\u05D3\u05D5 \u05D0\u05EA \u05D4\u05D8\u05DE\u05E4\u05DC\u05D8 (${ltr('Excel')})`)}
              ${stepRow(3, '\u05DE\u05DC\u05D0\u05D5 \u05D0\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DC \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD')}
              ${stepRow(4, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D3\u05E8\u05DA \u05D4\u05E4\u05D5\u05E8\u05D8\u05DC', true)}
            </table>
          </td>
        </tr>

        ${ctaBtn(params.portalUrl, '\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7')}

        ${params.messageSendAt && params.uploadDeadline ? scheduleBlock(params.messageSendAt, params.uploadDeadline) : ''}

        ${tipBox(`\u05D4\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05E0\u05E9\u05DC\u05D7\u05D5\u05EA 2\u20133 \u05E9\u05E2\u05D5\u05EA \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2. \u05DB\u05DB\u05DC \u05E9\u05EA\u05E2\u05DC\u05D5 \u05DE\u05D5\u05E7\u05D3\u05DD \u05D9\u05D5\u05EA\u05E8, \u05DB\u05DA \u05D9\u05D5\u05EA\u05E8 \u05D8\u05D5\u05D1!<br/><br/>\u05EA\u05E7\u05D1\u05DC\u05D5 \u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D1\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC <strong>\u05E9\u05D1\u05D5\u05E2 \u05DC\u05E4\u05E0\u05D9</strong> \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5-<strong>3 \u05D9\u05DE\u05D9\u05DD \u05DC\u05E4\u05E0\u05D9</strong> \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2.`)}
  ` : '';

  const inner = `
        ${greeting(
          safeName,
          `\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05E2\u05D1\u05D5\u05E8 <strong>${safeEvent}</strong> \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D5\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!`,
        )}

        ${paymentSection}

        ${eventDetailsBlock(params)}

        ${priceBlock(params.wantsGuestMessages)}

        <!-- Event link for guests -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:24px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E7\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};line-height:1.6;margin-bottom:10px;">
              \u05DE\u05E6\u05D5\u05E8\u05E3 \u05DB\u05D0\u05DF \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD.
              <br/>\u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D3\u05E8\u05DA \u05E1\u05E8\u05D9\u05E7\u05EA \u05D4\u05D1\u05E8\u05E7\u05D5\u05D3\u05D9\u05DD \u05E9\u05D9\u05D5\u05E6\u05D2\u05D5 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2, \u05DB\u05DA \u05E9\u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05DC\u05E9\u05DC\u05D5\u05D7 \u05DC\u05D4\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8.
              <br/><br/>\u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DB\u05D0\u05DF \u05E8\u05E7 \u05DC\u05E0\u05D5\u05D7\u05D5\u05EA\u05DB\u05DD \u2013 \u05D1\u05DE\u05D9\u05D3\u05D4 \u05D5\u05EA\u05E8\u05E6\u05D5 \u05DC\u05E9\u05EA\u05E3 \u05D0\u05D5\u05EA\u05D5 \u05E2\u05DD \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D0\u05D5 \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05D1\u05E2\u05E6\u05DE\u05DB\u05DD.
            </div>
            <div dir="ltr" style="text-align:left;background-color:${C.accentBg};border-radius:8px;padding:12px 16px;font-size:14px;word-break:break-all;">
              <a href="${escapeHtml(params.eventUrl)}" style="color:${C.accent};text-decoration:none;" target="_blank">${escapeHtml(params.eventUrl)}</a>
            </div>
          </td>
        </tr>

        <!-- A4 QR page note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:24px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D3\u05E3 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4')}
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-radius:8px;padding:16px 18px;font-size:14px;color:${C.muted};line-height:1.7;">
              \u05D0\u05E0\u05D7\u05E0\u05D5 \u05DE\u05DB\u05D9\u05E0\u05D9\u05DD \u05E2\u05D1\u05D5\u05E8\u05DB\u05DD \u05D3\u05E3 \u05D1\u05D2\u05D5\u05D3\u05DC ${ltr('A4')} \u05E2\u05DD \u05E7\u05D5\u05D3 ${ltr('QR')} \u05D9\u05D9\u05D7\u05D5\u05D3\u05D9 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD.
              <br/>\u05D4\u05D3\u05E3 \u05D9\u05D9\u05E9\u05DC\u05D7 \u05D0\u05DC\u05D9\u05DB\u05DD \u05D1\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05E0\u05E4\u05E8\u05D3 <strong>\u05D1\u05D4\u05E7\u05D3\u05DD \u05D4\u05D0\u05E4\u05E9\u05E8\u05D9</strong>, \u05DE\u05D5\u05DB\u05DF \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4 \u05D5\u05DC\u05E4\u05D9\u05D6\u05D5\u05E8 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2.
            </div>
          </td>
        </tr>

        ${waSection}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4') };
}

/* ═══════════════════════════════════════════════════════════════
   C4b. CLIENT - EVENT CREATED (admin-created)
   Sent when admin manually creates an event with a client email.
   Lighter version of C4 – no payment section, no order-specific fields.
   Shows event details, event link, QR page note.
   ═══════════════════════════════════════════════════════════════ */

export function buildEventCreatedEmail(params: {
  contactName: string;
  eventName: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  wantsGuestMessages: boolean;
  eventUrl: string;
  portalUrl?: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName || '');
  const safeEvent = escapeHtml(params.eventName);

  const subject = `Eventa - \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD \u05E0\u05D5\u05E6\u05E8!`;

  const eventLabel = escapeHtml(EVENT_TYPE_LABELS[params.eventType] || params.eventType);

  /* Messaging section (only if addon chosen + portal exists) */
  const waSection = params.wantsGuestMessages && params.portalUrl ? `
        ${divider()}

        <!-- Guest messaging info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};line-height:1.7;margin-bottom:20px;">
              \u05d4\u05d6\u05de\u05e0\u05ea\u05dd \u05d0\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd. \u05db\u05d3\u05d9 \u05e9\u05e0\u05d5\u05db\u05dc \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05dc\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd \u05e9\u05dc\u05db\u05dd \u05dc\u05e4\u05e0\u05d9 \u05d4\u05d0\u05d9\u05e8\u05d5\u05e2, \u05d9\u05e9 \u05dc\u05d4\u05e2\u05dc\u05d5\u05ea \u05d0\u05ea \u05e8\u05e9\u05d9\u05de\u05ea \u05de\u05e1\u05e4\u05e8\u05d9 \u05d4\u05d8\u05dc\u05e4\u05d5\u05df \u05d3\u05e8\u05da \u05e4\u05d5\u05e8\u05d8\u05dc \u05d4\u05dc\u05e7\u05d5\u05d7.
            </div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, `\u05D4\u05D9\u05DB\u05E0\u05E1\u05D5 \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7`)}
              ${stepRow(2, `\u05D4\u05D5\u05E8\u05D9\u05D3\u05D5 \u05D0\u05EA \u05D4\u05D8\u05DE\u05E4\u05DC\u05D8 (${ltr('Excel')})`)}
              ${stepRow(3, '\u05DE\u05DC\u05D0\u05D5 \u05D0\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DC \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD')}
              ${stepRow(4, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D3\u05E8\u05DA \u05D4\u05E4\u05D5\u05E8\u05D8\u05DC', true)}
            </table>
          </td>
        </tr>

        ${ctaBtn(params.portalUrl, '\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7')}
  ` : '';

  const inner = `
        ${greeting(
          safeName || '\u05DC\u05E7\u05D5\u05D7/\u05D4',
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!`,
        )}

        <!-- Event info section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E1\u05D5\u05D2 \u05D0\u05D9\u05E8\u05D5\u05E2', `<strong>${eventLabel}</strong>`)}
              ${row('\u05E9\u05DD', safeEvent)}
              ${row('\u05D4\u05EA\u05D7\u05DC\u05D4', `${fmtDate(params.startsAt)}${fmtTime(params.startsAt) ? `&rlm;, ${ltr(fmtTime(params.startsAt))}` : ''}`)}
              ${row('\u05E1\u05D9\u05D5\u05DD', `${fmtDate(params.endsAt)}${fmtTime(params.endsAt) ? `&rlm;, ${ltr(fmtTime(params.endsAt))}` : ''}`, true)}
            </table>
          </td>
        </tr>

        <!-- Event link -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:24px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E7\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};line-height:1.6;margin-bottom:10px;">
              \u05DE\u05E6\u05D5\u05E8\u05E3 \u05DB\u05D0\u05DF \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD.
              <br/>\u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D3\u05E8\u05DA \u05E1\u05E8\u05D9\u05E7\u05EA \u05D4\u05D1\u05E8\u05E7\u05D5\u05D3\u05D9\u05DD \u05E9\u05D9\u05D5\u05E6\u05D2\u05D5 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2, \u05DB\u05DA \u05E9\u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05DC\u05E9\u05DC\u05D5\u05D7 \u05DC\u05D4\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8.
              <br/><br/>\u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DB\u05D0\u05DF \u05E8\u05E7 \u05DC\u05E0\u05D5\u05D7\u05D5\u05EA\u05DB\u05DD \u2013 \u05D1\u05DE\u05D9\u05D3\u05D4 \u05D5\u05EA\u05E8\u05E6\u05D5 \u05DC\u05E9\u05EA\u05E3 \u05D0\u05D5\u05EA\u05D5 \u05E2\u05DD \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D0\u05D5 \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05D1\u05E2\u05E6\u05DE\u05DB\u05DD.
            </div>
            <div dir="ltr" style="text-align:left;background-color:${C.accentBg};border-radius:8px;padding:12px 16px;font-size:14px;word-break:break-all;">
              <a href="${escapeHtml(params.eventUrl)}" style="color:${C.accent};text-decoration:none;" target="_blank">${escapeHtml(params.eventUrl)}</a>
            </div>
          </td>
        </tr>

        <!-- A4 QR page note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:24px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D3\u05E3 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4')}
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-radius:8px;padding:16px 18px;font-size:14px;color:${C.muted};line-height:1.7;">
              \u05D0\u05E0\u05D7\u05E0\u05D5 \u05DE\u05DB\u05D9\u05E0\u05D9\u05DD \u05E2\u05D1\u05D5\u05E8\u05DB\u05DD \u05D3\u05E3 \u05D1\u05D2\u05D5\u05D3\u05DC ${ltr('A4')} \u05E2\u05DD \u05E7\u05D5\u05D3 ${ltr('QR')} \u05D9\u05D9\u05D7\u05D5\u05D3\u05D9 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD.
              <br/>\u05D4\u05D3\u05E3 \u05D9\u05D9\u05E9\u05DC\u05D7 \u05D0\u05DC\u05D9\u05DB\u05DD \u05D1\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05E0\u05E4\u05E8\u05D3 <strong>\u05D1\u05D4\u05E7\u05D3\u05DD \u05D4\u05D0\u05E4\u05E9\u05E8\u05D9</strong>, \u05DE\u05D5\u05DB\u05DF \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4 \u05D5\u05DC\u05E4\u05D9\u05D6\u05D5\u05E8 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2.
            </div>
          </td>
        </tr>

        ${waSection}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C8. CLIENT - QR PAGE READY
   Sent when the admin has prepared the A4 page with QR code.
   Email includes explanation about attached files.
   Attachments (PDF, PDF-cropped, image, QR-only) are handled
   by the send-email API, not by this template function.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientQrPageEmail(params: {
  contactName: string;
  eventName: string;
  /** When true, email describes only the QR code image (no full A4 page). */
  qrOnly?: boolean;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);
  const qrOnly = !!params.qrOnly;

  const subject = qrOnly
    ? `Eventa - \u05E7\u05D5\u05D3 \u05D4-QR \u05E9\u05DC\u05DB\u05DD \u05DE\u05D5\u05DB\u05DF!`
    : `Eventa - \u05D3\u05E3 \u05D4-QR \u05E9\u05DC\u05DB\u05DD \u05DE\u05D5\u05DB\u05DF!`;

  const greetingSub = qrOnly
    ? `\u05E7\u05D5\u05D3 \u05D4-${ltr('QR')} \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05DE\u05D5\u05DB\u05DF!`
    : `\u05D3\u05E3 \u05D4-${ltr('QR')} \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05DE\u05D5\u05DB\u05DF!`;

  const greetingBody = qrOnly
    ? `\u05D4\u05D3\u05E4\u05D9\u05E1\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05D5\u05E4\u05D6\u05E8\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 - \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E1\u05D5\u05E8\u05E7\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05D5\u05E0\u05DB\u05E0\u05E1\u05D9\u05DD \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4.`
    : `\u05D4\u05D3\u05E4\u05D9\u05E1\u05D5 \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D5\u05E4\u05D6\u05E8\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 - \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E1\u05D5\u05E8\u05E7\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05D5\u05E0\u05DB\u05E0\u05E1\u05D9\u05DD \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4.`;

  /* ── QR-only: single attachment explanation ── */
  const qrOnlySection = `
        <!-- Explanation -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05DE\u05D4 \u05DE\u05E6\u05D5\u05E8\u05E3 \u05DC\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4?')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};line-height:1.7;margin-bottom:16px;">
              \u05E6\u05D9\u05E8\u05E4\u05E0\u05D5 \u05DC\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4 \u05D0\u05EA <strong>\u05E7\u05D5\u05D3 \u05D4-${ltr('QR')}</strong> \u05E9\u05DC \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD.
            </div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, `<strong>\u05E7\u05D5\u05D3 ${ltr('QR')}</strong> - \u05EA\u05DE\u05D5\u05E0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05DC\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D7\u05D5\u05E4\u05E9\u05D9, \u05DC\u05E9\u05D9\u05EA\u05D5\u05E3 \u05D0\u05D5 \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4`, true)}
            </table>
          </td>
        </tr>`;

  /* ── Full page: 4 attachments explanation ── */
  const fullSection = `
        <!-- Explanation -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05DE\u05D4 \u05DE\u05E6\u05D5\u05E8\u05E3 \u05DC\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4?')}
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};line-height:1.7;margin-bottom:16px;">
              \u05E6\u05D9\u05E8\u05E4\u05E0\u05D5 \u05DC\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4 <strong>4 \u05E7\u05D1\u05E6\u05D9\u05DD</strong> \u05DC\u05E0\u05D5\u05D7\u05D9\u05D5\u05EA\u05DB\u05DD&rlm;:
            </div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, `<strong>\u05D3\u05E3 ${ltr('A4')} \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4</strong> (${ltr('PDF')}) - \u05DE\u05D5\u05DB\u05DF \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05E2\u05DC \u05D3\u05E3 ${ltr('A4')} \u05E8\u05D2\u05D9\u05DC`)}
              ${stepRow(2, `<strong>\u05D3\u05E3 ${ltr('A4')} \u05E2\u05DD \u05E9\u05D5\u05DC\u05D9\u05D9\u05DD</strong> (${ltr('PDF')}) - \u05D2\u05E8\u05E1\u05D4 \u05E2\u05DD \u05E9\u05D5\u05DC\u05D9\u05D9\u05DD \u05DC\u05D7\u05D9\u05EA\u05D5\u05DA \u05DE\u05D3\u05D5\u05D9\u05E7`)}
              ${stepRow(3, `<strong>\u05EA\u05DE\u05D5\u05E0\u05D4</strong> (${ltr('PNG / JPG')}) - \u05DC\u05E9\u05D9\u05EA\u05D5\u05E3 \u05D1\u05E8\u05E9\u05EA\u05D5\u05EA \u05D7\u05D1\u05E8\u05EA\u05D9\u05D5\u05EA \u05D0\u05D5 \u05DC\u05E9\u05DC\u05D9\u05D7\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA`)}
              ${stepRow(4, `<strong>\u05E7\u05D5\u05D3 ${ltr('QR')} \u05D1\u05DC\u05D1\u05D3</strong> - \u05D0\u05DD \u05EA\u05E8\u05E6\u05D5 \u05DC\u05E2\u05E6\u05D1 \u05DE\u05E9\u05D4\u05D5 \u05DE\u05E9\u05DC\u05DB\u05DD \u05D0\u05D5 \u05DC\u05D4\u05D3\u05E4\u05D9\u05E1 \u05E8\u05E7 \u05D0\u05EA \u05D4\u05D1\u05E8\u05E7\u05D5\u05D3`, true)}
            </table>
          </td>
        </tr>`;

  const fullTip = `\u05DE\u05DE\u05DC\u05D9\u05E6\u05D9\u05DD \u05DC\u05D4\u05D3\u05E4\u05D9\u05E1 \u05E2\u05D5\u05EA\u05E7\u05D9\u05DD \u05DE\u05D4\u05D3\u05E3 \u05D5\u05DC\u05E4\u05D6\u05E8 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 - \u05D1\u05DB\u05E0\u05D9\u05E1\u05D4, \u05E2\u05DC \u05D4\u05D1\u05E8\u05D9\u05DD, \u05E2\u05DC \u05D4\u05E9\u05D5\u05DC\u05D7\u05E0\u05D5\u05EA, \u05E2\u05DC \u05EA\u05D0\u05D9 \u05D4\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD - \u05D1\u05DB\u05DC \u05DE\u05E7\u05D5\u05DD \u05E0\u05D2\u05D9\u05E9 \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.<br/><br/>\u05DB\u05DB\u05DC \u05E9\u05D9\u05D4\u05D9\u05D5 \u05D9\u05D5\u05EA\u05E8 \u05E2\u05D5\u05EA\u05E7\u05D9\u05DD, \u05DB\u05DA \u05D9\u05D5\u05EA\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D9\u05E6\u05D8\u05E8\u05E4\u05D5!<br/><br/>\u05DB\u05D0\u05E9\u05E8 \u05DE\u05D3\u05E4\u05D9\u05E1\u05D9\u05DD, \u05DB\u05D3\u05D0\u05D9 \u05DC\u05D4\u05D3\u05E4\u05D9\u05E1 \u05D0\u05EA \u05D4\u05D2\u05E8\u05E1\u05D4 \u05E2\u05DD \u05D4\u05E9\u05D5\u05DC\u05D9\u05D9\u05DD - \u05E8\u05D5\u05D1 \u05D4\u05DE\u05D3\u05E4\u05E1\u05D5\u05EA \u05DC\u05D0 \u05EA\u05D5\u05DE\u05DB\u05D5\u05EA \u05D1\u05D4\u05D3\u05E4\u05E1\u05D4 \u05DC\u05DC\u05D0 \u05E9\u05D5\u05DC\u05D9\u05D9\u05DD \u05D1\u05DB\u05DC\u05DC, \u05D5\u05D7\u05DC\u05E7 \u05DE\u05D4\u05D3\u05E3 \u05E2\u05DC\u05D5\u05DC \u05DC\u05D4\u05D9\u05D7\u05EA\u05DA.`;

  const qrOnlyTip = `\u05D4\u05D3\u05E4\u05D9\u05E1\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05D5\u05E4\u05D6\u05E8\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 - \u05D1\u05DB\u05E0\u05D9\u05E1\u05D4, \u05E2\u05DC \u05D4\u05D1\u05E8\u05D9\u05DD, \u05E2\u05DC \u05D4\u05E9\u05D5\u05DC\u05D7\u05E0\u05D5\u05EA, \u05E2\u05DC \u05EA\u05D0\u05D9 \u05D4\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD - \u05D1\u05DB\u05DC \u05DE\u05E7\u05D5\u05DD \u05E0\u05D2\u05D9\u05E9 \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.<br/><br/>\u05DB\u05DB\u05DC \u05E9\u05D9\u05D4\u05D9\u05D5 \u05D9\u05D5\u05EA\u05E8 \u05E2\u05D5\u05EA\u05E7\u05D9\u05DD, \u05DB\u05DA \u05D9\u05D5\u05EA\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05D9\u05E6\u05D8\u05E8\u05E4\u05D5!`;

  const inner = `
        ${greeting(safeName, greetingSub, greetingBody)}

        ${qrOnly ? qrOnlySection : fullSection}

        ${tipBox(qrOnly ? qrOnlyTip : fullTip)}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D3\u05E3 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C5. CLIENT - UPLOAD REMINDER (7-DAY)
   Sent 7 days before the event when guest list not yet uploaded.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientUploadReminder7DayEmail(params: {
  contactName: string;
  eventName: string;
  daysLeft: number;
  uploadUrl: string;
  messageSendAt: string;
  uploadDeadline: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA: \u05D4\u05E2\u05DC\u05D5 \u05E8\u05E9\u05D9\u05DE\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05DC-\u201C${params.eventName}\u201D`;

  const inner = `
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05D1\u05E2\u05D5\u05D3 <strong>${ltr(String(params.daysLeft))}</strong> \u05D9\u05DE\u05D9\u05DD \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05D4\u05E2\u05DC\u05D9\u05EA\u05DD \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.`,
          `\u05DB\u05D3\u05D9 \u05E9\u05E0\u05D5\u05DB\u05DC \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E9\u05DC\u05DB\u05DD, \u05D0\u05E0\u05D7\u05E0\u05D5 \u05E6\u05E8\u05D9\u05DB\u05D9\u05DD \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF.`,
        )}

        ${scheduleBlock(params.messageSendAt, params.uploadDeadline)}

        ${ctaBtn(params.uploadUrl, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5')}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D9\u05D3\u05D9\u05D3\u05D5\u05EA\u05D9\u05EA') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C6. CLIENT - UPLOAD REMINDER (3-DAY)
   Urgent reminder 3 days before the event.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientUploadReminder3DayEmail(params: {
  contactName: string;
  eventName: string;
  uploadUrl: string;
  messageSendAt: string;
  uploadDeadline: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4! \u05E8\u05E9\u05D9\u05DE\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05DC-\u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Urgent banner -->
        ${statusBanner(
          '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4',
          '\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D1\u05E2\u05D5\u05D3 3 \u05D9\u05DE\u05D9\u05DD \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E8\u05E9\u05D9\u05DE\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD',
          C.warnBg, C.warn,
        )}

        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05DB\u05D1\u05E8 \u05D1\u05E2\u05D5\u05D3 <strong>3 \u05D9\u05DE\u05D9\u05DD</strong> \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05DC\u05E0\u05D5 \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.`,
        )}

        <!-- Warning text -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.warn};font-weight:600;line-height:1.6;">
              \u05D1\u05DC\u05D9 \u05D4\u05E8\u05E9\u05D9\u05DE\u05D4, \u05DC\u05D0 \u05E0\u05D5\u05DB\u05DC \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.
            </div>
          </td>
        </tr>

        ${scheduleBlock(params.messageSendAt, params.uploadDeadline)}

        ${tipBox(`\u05D0\u05DD \u05D0\u05EA\u05DD \u05DC\u05D0 \u05DE\u05EA\u05DB\u05E0\u05E0\u05D9\u05DD \u05DC\u05D4\u05E2\u05DC\u05D5\u05EA \u05E8\u05E9\u05D9\u05DE\u05D4, \u05D6\u05D4 \u05D1\u05E1\u05D3\u05E8 &mdash; \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05E6\u05D8\u05E8\u05E3 \u05D3\u05E8\u05DA ${ltr('QR')} \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E2\u05E6\u05DE\u05D5.`)}

        ${ctaBtn(params.uploadUrl, '\u05D4\u05E2\u05DC\u05D5 \u05E2\u05DB\u05E9\u05D9\u05D5 - \u05DC\u05E4\u05E0\u05D9 \u05E9\u05DE\u05D0\u05D5\u05D7\u05E8!', C.warn)}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D3\u05D7\u05D5\u05E4\u05D4') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   C7. CLIENT - EVENT SUMMARY
   Sent the day after the event with stats.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildClientEventSummaryEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  stats: {
    totalParticipants: number;
    men: number;
    women: number;
    totalMatches: number;
    totalConversations: number;
  };
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);
  const s = params.stats;

  const subject = `Eventa - \u05E1\u05D9\u05DB\u05D5\u05DD \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u201C${params.eventName}\u201D`;

  const inner = `
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05D4\u05E1\u05EA\u05D9\u05D9\u05DD! \u05D4\u05E0\u05D4 \u05E1\u05D9\u05DB\u05D5\u05DD \u05E7\u05E6\u05E8&rlm;:`,
        )}

        <!-- Stats -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E1\u05D4\u05F4\u05DB \u05DE\u05E9\u05EA\u05EA\u05E4\u05D9\u05DD', ltr(String(s.totalParticipants)))}
              ${row('\u05D2\u05D1\u05E8\u05D9\u05DD', ltr(String(s.men)))}
              ${row('\u05E0\u05E9\u05D9\u05DD', ltr(String(s.women)))}
              ${row(`\u05D4\u05EA\u05D0\u05DE\u05D5\u05EA (${ltr('Matches')})`, ltr(String(s.totalMatches)))}
              ${row('\u05E9\u05D9\u05D7\u05D5\u05EA', ltr(String(s.totalConversations)), true)}
            </table>
          </td>
        </tr>

        <!-- Thank you -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:32px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:15px;color:${C.muted};line-height:1.7;">
              \u05EA\u05D5\u05D3\u05D4 \u05E9\u05D1\u05D7\u05E8\u05EA\u05DD \u05D1-${ltr('Eventa')}!<br/>\u05E0\u05E9\u05DE\u05D7 \u05DC\u05D0\u05E8\u05D7 \u05D0\u05EA\u05DB\u05DD \u05E9\u05D5\u05D1.
            </div>
          </td>
        </tr>

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05E1\u05D9\u05DB\u05D5\u05DD \u05D0\u05D9\u05E8\u05D5\u05E2') };
}


/* ═══════════════════════════════════════════════════════════════
   A1. ADMIN - PAYMENT RECEIVED NOTIFICATION
   Payment completed and event auto-created.
   ═══════════════════════════════════════════════════════════════ */

export function buildAdminPayNowNotification(data: EventFormData & {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  requestId: string;
  eventSlug?: string;
  eventId?: string;
}): { subject: string; html: string } {
  const s = {
    name: escapeHtml(data.contactName),
    phone: escapeHtml(data.contactPhone),
    email: data.contactEmail ? escapeHtml(data.contactEmail) : '',
    eventLabel: escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType),
  };

  const totalShekel = BASE_PRICE;

  const subject = `\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05EA\u05E7\u05D1\u05DC \u05D5\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8 - ${data.contactName} | ${EVENT_TYPE_LABELS[data.eventType] || data.eventType} (\u20AA${totalShekel})`;

  const inner = `
        ${statusBanner(
          '\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05EA\u05E7\u05D1\u05DC - \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA',
          null,
          C.successBg, C.success,
        )}

        <!-- Contact info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05DC\u05E7\u05D5\u05D7')}
            ${contactCard(s.name, s.phone, s.email)}
          </td>
        </tr>

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        <!-- Request & Event IDs -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:0 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.dim};line-height:1.8;">
              \u05DE\u05D6\u05D4\u05D4 \u05D1\u05E7\u05E9\u05D4&rlm;: ${ltr(escapeHtml(data.requestId))}${data.eventSlug ? `<br/>slug&rlm;: ${ltr(escapeHtml(data.eventSlug))}` : ''}${data.eventId ? `<br/>\u05DE\u05D6\u05D4\u05D4 \u05D0\u05D9\u05E8\u05D5\u05E2&rlm;: ${ltr(escapeHtml(data.eventId))}` : ''}
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05EA\u05E7\u05D1\u05DC') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   A2. ADMIN - CALL ME BACK NOTIFICATION
   Client filled the full form and wants to be contacted.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildAdminCallMeBackNotification(data: EventFormData & {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  requestId: string;
}): { subject: string; html: string } {
  const s = {
    name: escapeHtml(data.contactName),
    phone: escapeHtml(data.contactPhone),
    email: data.contactEmail ? escapeHtml(data.contactEmail) : '',
    eventLabel: escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType),
  };

  const subject = `\u05D1\u05E7\u05E9\u05D4 \u05D7\u05D3\u05E9\u05D4 (\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05E9\u05D9\u05D7\u05D4) - ${data.contactName} | ${EVENT_TYPE_LABELS[data.eventType] || data.eventType}`;

  const inner = `
        ${statusBanner(
          '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05DE\u05D9\u05DC\u05D0 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05DE\u05DC\u05D0\u05D4 \u05D5\u05DE\u05D1\u05E7\u05E9 \u05E9\u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05D5 \u05E7\u05E9\u05E8',
          null,
          C.accentBg, C.accent,
        )}

        <!-- Contact info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05DC\u05E7\u05D5\u05D7')}
            ${contactCard(s.name, s.phone, s.email)}
          </td>
        </tr>

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        <!-- Request ID -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:16px 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.dim};">
              \u05DE\u05D6\u05D4\u05D4 \u05D1\u05E7\u05E9\u05D4&rlm;: ${ltr(escapeHtml(data.requestId))}
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05D1\u05E7\u05E9\u05D4 \u05D7\u05D3\u05E9\u05D4') };
}


/* ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
   A3. ADMIN - CONTACT ONLY NOTIFICATION
   Client wants to be contacted. No event form filled.
   ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג• */

export function buildAdminContactOnlyNotification(data: {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  message?: string;
}): { subject: string; html: string } {
  const s = {
    name: escapeHtml(data.contactName),
    phone: escapeHtml(data.contactPhone),
    email: data.contactEmail ? escapeHtml(data.contactEmail) : '',
  };

  const subject = `\u05E4\u05E0\u05D9\u05D9\u05D4 \u05D7\u05D3\u05E9\u05D4 (\u05DC\u05DC\u05D0 \u05D8\u05D5\u05E4\u05E1) - ${data.contactName}`;

  const inner = `
        ${statusBanner(
          '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05E8\u05D5\u05E6\u05D4 \u05E9\u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05D5 \u05E7\u05E9\u05E8 - \u05DC\u05D0 \u05DE\u05D9\u05DC\u05D0 \u05E4\u05E8\u05D8\u05D9 \u05D0\u05D9\u05E8\u05D5\u05E2',
          null,
          C.warnBg, C.warn,
        )}

        <!-- Contact info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05DC\u05E7\u05D5\u05D7')}
            ${contactCard(s.name, s.phone, s.email)}
          </td>
        </tr>

        ${data.message ? `
        <!-- Client message -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px 24px;background-color:${C.card};">
            ${sectionTitle('\u05D4\u05D5\u05D3\u05E2\u05D4 \u05DE\u05D4\u05DC\u05E7\u05D5\u05D7')}
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:8px;padding:16px 18px;font-size:15px;color:${C.text};line-height:1.7;">
              ${escapeHtml(data.message)}
            </div>
          </td>
        </tr>` : `
        <!-- Bottom spacing -->
        <tr><td style="padding:0 0 16px;background-color:${C.card};">&nbsp;</td></tr>`}`;

  return { subject, html: shell(subject, inner, '\u05E4\u05E0\u05D9\u05D9\u05D4 \u05D7\u05D3\u05E9\u05D4') };
}
