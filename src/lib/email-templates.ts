/**
 * Email templates for the order system.
 *
 * Key design rules for email HTML RTL:
 *  - Gmail strips dir from <html>/<body>, so EVERY <td> gets dir="rtl" + text-align:right
 *  - Table-based layout only (no flexbox/grid) for Outlook + Gmail
 *  - No emojis
 *  - English words (brand, phone, email) in dir="ltr" spans with unicode-bidi:isolate
 *  - Logo from https://www.eventa.productions/icons/Eventa_Logo.png
 *
 * Design system v2 — consistent across all emails:
 *  - Card shadow, pill-shaped CTAs, accent section titles, step pills
 *  - Responsive: max-width 600px card, 100% on mobile
 *  - Typography: base 15px, titles 18px bold, labels 14px semi-bold, values 15px
 */

import { EVENT_TYPE_LABELS } from '@/lib/constants';

/** Light logo (shown on dark backgrounds / dark mode). */
const LOGO_LIGHT = 'https://www.eventa.productions/icons/Eventa_Logo.png';
/** Dark logo (shown on light backgrounds / light mode). */
const LOGO_DARK  = 'https://www.eventa.productions/icons/Eventa_Logo_Dark.png';

/* ─── Shared palette ─── */
const C = {
  bg:       '#f5f3f0',
  card:     '#ffffff',
  text:     '#1e1e1e',
  muted:    '#6b6b6b',
  dim:      '#999999',
  border:   '#ece7e4',
  accent:   '#b08d7e',
  accentBg: '#faf6f4',
  rowAlt:   '#faf7f4',
  paybox:   '#004aad',
  bit:      '#1aab4a',
  warn:     '#c27816',
  warnBg:   '#fef9f0',
} as const;

/** Shorthand: every <td> in the email needs this for RTL to work in Gmail. */
const RTL = 'dir="rtl" style="text-align:right;"';

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

/** Format ISO datetime → Hebrew date string. */
function fmtDate(iso: string): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

/** Format ISO datetime → HH:MM. */
function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}


/* ─── Design-system helpers ─── */

/** Build a two-column info row: label | value. Both cells are RTL. */
function row(label: string, value: string, isLast = false): string {
  const bb = isLast ? '' : `border-bottom:1px solid ${C.border};`;
  return `<tr>
    <td dir="rtl" style="text-align:right;padding:12px 0 12px 12px;${bb}background-color:${C.card};color:#555555;font-size:14px;font-weight:600;width:100px;vertical-align:top;line-height:1.5;">${label}</td>
    <td dir="rtl" style="text-align:right;padding:12px 12px 12px 0;${bb}background-color:${C.card};color:${C.text};font-size:15px;line-height:1.5;">${value}</td>
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
    <td dir="rtl" style="text-align:right;padding:14px 0 14px 8px;${bb}background-color:${C.card};vertical-align:middle;width:44px;">
      <div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background-color:${C.accent};color:#ffffff;font-size:14px;font-weight:700;margin:0 auto;">${num}</div>
    </td>
    <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;${bb}background-color:${C.card};color:${C.text};font-size:15px;line-height:1.5;vertical-align:middle;">${text}</td>
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

/** Section divider — a soft horizontal line with spacing. */
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
              לשאלות ניתן לפנות אלינו&rlm;: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
          </td>
        </tr>`;
}

/** Greeting block: name line + subtitle lines. Returns a full <tr>. */
function greeting(name: string, ...lines: string[]): string {
  return `
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:17px;color:${C.text};font-weight:600;line-height:1.5;">שלום ${name}&rlm;,</div>
            ${lines.map((l, i) => `<div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.muted};${i === 0 ? 'margin-top:8px;' : ''}line-height:1.6;${i === lines.length - 1 ? 'padding-bottom:20px;' : ''}">${l}</div>`).join('\n            ')}
          </td>
        </tr>`;
}

/** Contact info card used in admin emails. */
function contactCard(name: string, phone: string, email: string): string {
  return `
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-row-alt" style="direction:rtl;border-collapse:collapse;background-color:${C.rowAlt};border-radius:8px;overflow:hidden;">
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;width:70px;">שם</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:${C.rowAlt};color:${C.text};font-size:15px;font-weight:600;">${name}</td>
              </tr>
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${email ? `border-bottom:1px solid ${C.border};` : ''}background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;">טלפון</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${email ? `border-bottom:1px solid ${C.border};` : ''}background-color:${C.rowAlt};">
                  <a href="tel:${phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${phone}</a>
                </td>
              </tr>
              ${email ? `<tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:${C.rowAlt};color:#555555;font-size:14px;font-weight:600;">אימייל</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:${C.rowAlt};">
                  <a href="mailto:${email}" style="color:${C.accent};font-size:15px;text-decoration:none;" dir="ltr">${email}</a>
                </td>
              </tr>` : ''}
            </table>`;
}


interface OrderData {
  eventType: string;
  eventName: string;
  startsAt: string;
  endsAt: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  wantsCustomBackground: boolean;
  hasBgImage: boolean;
  posterChoice: string;
  selectedTemplate: string;
  specialRequests: string;
  wantsGuestMessages: boolean;
  contactPreference: string;
  isWizard: boolean;
}

/* ─── Shared email shell ─── */
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
      .em-paybox { background-color: ${C.paybox} !important; }
      .em-bit { background-color: ${C.bit} !important; }
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
      <table dir="rtl" role="presentation" width="600" cellpadding="0" cellspacing="0" class="em-card" style="direction:rtl;max-width:600px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 3px 12px rgba(0,0,0,0.08);">

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
                <td style="text-align:left;padding:8px 28px 8px 0;vertical-align:middle;width:140px;">
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
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="em-card" style="max-width:600px;width:100%;">
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
function priceBlock(wantsGuestMessages: boolean): string {
  const base = 250;
  const msgAddon = wantsGuestMessages ? 50 : 0;
  const total = base + msgAddon;

  return `
        <!-- Price breakdown -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E2\u05DC\u05D5\u05EA')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05D7\u05D1\u05D9\u05DC\u05D4 \u05D1\u05E1\u05D9\u05E1\u05D9\u05EA', ltr(`\u20AA${base}`))}
              ${wantsGuestMessages ? row('\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD', ltr(`\u20AA${msgAddon}`)) : ''}
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 0 14px 12px;background-color:${C.card};color:${C.accent};font-size:16px;font-weight:700;width:100px;border-top:2px solid ${C.accent};vertical-align:top;">\u05E1\u05D4\u05F4\u05DB</td>
                <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;background-color:${C.card};color:${C.text};font-size:20px;font-weight:700;border-top:2px solid ${C.accent};">${ltr(`\u20AA${total}`)}</td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Build the event details + options sections shared by admin & client emails. */
function eventDetailsBlock(data: OrderData): string {
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
              ${row('\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA', data.wantsGuestMessages ? '\u05DB\u05DF' : '\u05DC\u05D0', true)}
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


/* ═══════════════════════════════════════════════════════════════
   1. ADMIN NOTIFICATION EMAIL
   Sent to contact@eventa.productions when someone submits a request.
   ═══════════════════════════════════════════════════════════════ */

export function buildAdminNotificationEmail(data: OrderData): { subject: string; html: string } {
  const s = {
    eventLabel: escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType),
    name: escapeHtml(data.contactName),
    phone: escapeHtml(data.contactPhone),
    email: data.contactEmail ? escapeHtml(data.contactEmail) : '',
  };

  const contactPrefLabel = data.contactPreference === 'call-me'
    ? '\u05D4\u05EA\u05E7\u05E9\u05E8\u05D5 \u05D0\u05DC\u05D9\u05D9'
    : data.contactPreference === 'pay-now'
      ? '\u05EA\u05E9\u05DC\u05D5\u05DD \u05D1\u05D0\u05EA\u05E8 (\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D0\u05E9\u05E8\u05D0\u05D9)'
      : '\u05E9\u05DC\u05D7\u05D5 \u05DC\u05D9\u05E0\u05E7 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD';

  const subject = `\u05D1\u05E7\u05E9\u05D4 \u05D7\u05D3\u05E9\u05D4 \u2014 ${s.eventLabel} | ${data.contactName}`;

  const inner = `
        <!-- Contact preference banner -->
        <tr>
          <td ${RTL} style="text-align:right;background-color:${data.contactPreference === 'pay-now' ? '#e8f5e9' : data.contactPreference === 'send-link' ? '#eef4ff' : C.accentBg} !important;padding:16px 32px;border-bottom:1px solid ${C.border};font-size:15px;font-weight:600;color:${data.contactPreference === 'pay-now' ? '#2e7d32' : data.contactPreference === 'send-link' ? C.paybox : C.accent};">
            ${data.contactPreference === 'pay-now' ? '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05E9\u05D9\u05DC\u05DD \u05D1\u05D0\u05EA\u05E8 (\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D0\u05E9\u05E8\u05D0\u05D9)' : data.contactPreference === 'send-link' ? '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05D1\u05D9\u05E7\u05E9 \u05DC\u05E7\u05D1\u05DC \u05DC\u05D9\u05E0\u05E7 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD' : '\u05D4\u05DC\u05E7\u05D5\u05D7 \u05DE\u05D1\u05E7\u05E9 \u05E9\u05E0\u05D7\u05D6\u05D5\u05E8 \u05D0\u05DC\u05D9\u05D5'}
          </td>
        </tr>

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        <!-- Contact preference row -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px 4px;background-color:${C.card};">
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05D4\u05E2\u05D3\u05E4\u05EA \u05E7\u05E9\u05E8', `<strong>${contactPrefLabel}</strong>`, true)}
            </table>
          </td>
        </tr>

        <!-- Contact section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 28px;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05DC\u05E7\u05D5\u05D7')}
            ${contactCard(s.name, s.phone, s.email)}
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05D1\u05E7\u05E9\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9\u05D4') };
}


/* ═══════════════════════════════════════════════════════════════
   2. CLIENT PAYMENT EMAIL
   Sent to the client when they choose "send-link" payment option.
   Includes PayBox, Bit buttons + full order summary + "contact
   me instead" fallback.
   ═══════════════════════════════════════════════════════════════ */

export function buildClientPaymentEmail(data: {
  contactName: string;
  contactEmail: string;
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
  requestId: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(data.contactName);
  const contactMeUrl = `${data.baseUrl}/api/order/contact-me?id=${data.requestId}`;

  const subject = `${ltr('Eventa')} \u2014 \u05E4\u05E8\u05D8\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD \u05E2\u05D1\u05D5\u05E8 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA`;

  // Cast partial data to OrderData shape for the shared event-details builder
  const orderLike: OrderData = {
    eventType: data.eventType,
    eventName: data.eventName,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    contactName: data.contactName,
    contactPhone: '',
    contactEmail: data.contactEmail,
    wantsCustomBackground: data.wantsCustomBackground,
    hasBgImage: data.hasBgImage,
    posterChoice: data.posterChoice,
    selectedTemplate: data.selectedTemplate,
    specialRequests: data.specialRequests,
    wantsGuestMessages: data.wantsGuestMessages,
    contactPreference: 'send-link',
    isWizard: true,
  };

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4.',
          '\u05E0\u05D9\u05EA\u05DF \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05D1\u05D0\u05D7\u05EA \u05D4\u05D3\u05E8\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D5\u05EA&rlm;:',
        )}

        <!-- Payment buttons -->
        <tr>
          <td style="padding:28px 32px 24px;text-align:center;background-color:${C.card};">
            <!-- PayBox -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td align="center">
                  <a href="#" style="display:block;text-decoration:none;" target="_blank">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" class="em-paybox" style="background-color:${C.paybox} !important;border-radius:12px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('PayBox')}</div>
                          <div dir="rtl" style="direction:rtl;font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7</div>
                        </td>
                      </tr>
                    </table>
                  </a>
                </td>
              </tr>
            </table>
            <!-- Bit -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="#" style="display:block;text-decoration:none;" target="_blank">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" class="em-bit" style="background-color:${C.bit} !important;border-radius:12px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('Bit')}</div>
                          <div dir="rtl" style="direction:rtl;font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7</div>
                        </td>
                      </tr>
                    </table>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${divider()}

        ${eventDetailsBlock(orderLike)}

        ${priceBlock(data.wantsGuestMessages)}

        ${divider()}

        <!-- Contact me instead -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:24px 32px 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:14px;color:${C.muted};margin-bottom:16px;">\u05DE\u05E2\u05D3\u05D9\u05E4\u05D9\u05DD \u05E9\u05E0\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05EA\u05DB\u05DD \u05E7\u05E9\u05E8&rlm;?</div>
            <a href="${contactMeUrl}" style="display:inline-block;text-decoration:none;border:2px solid ${C.accent};border-radius:999px;padding:12px 28px;color:${C.accent};font-size:15px;font-weight:600;" target="_blank">
              \u05E6\u05E8\u05D5 \u05D0\u05D9\u05EA\u05D9 \u05E7\u05E9\u05E8
            </a>
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:13px;color:${C.dim};margin-top:12px;">\u05E0\u05D7\u05D6\u05D5\u05E8 \u05D0\u05DC\u05D9\u05DB\u05DD \u05EA\u05D5\u05DA 48 \u05E9\u05E2\u05D5\u05EA</div>
          </td>
        </tr>

        ${supportRow()}`;

  return { subject, html: shell(subject, inner) };
}


/* ═══════════════════════════════════════════════════════════════
   3. CONTACT-ME-INSTEAD NOTIFICATION EMAIL
   Sent to admin when a client clicks "I want you to contact me"
   from the payment email (they changed their mind).
   ═══════════════════════════════════════════════════════════════ */

export function buildContactMeInsteadEmail(data: {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  eventType: string;
  eventName: string;
  requestId: string;
}): { subject: string; html: string } {
  const s = {
    name: escapeHtml(data.contactName),
    phone: escapeHtml(data.contactPhone),
    email: data.contactEmail ? escapeHtml(data.contactEmail) : '',
    eventLabel: escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType),
    eventName: data.eventName ? escapeHtml(data.eventName) : '',
  };

  const subject = `\u05DC\u05E7\u05D5\u05D7 \u05DE\u05D1\u05E7\u05E9 \u05E9\u05E0\u05D9\u05E6\u05D5\u05E8 \u05E7\u05E9\u05E8 \u2014 ${data.contactName}`;

  const inner = `
        <!-- Alert banner -->
        <tr>
          <td ${RTL} class="em-warn" style="text-align:right;background-color:${C.warnBg} !important;padding:18px 32px;border-bottom:1px solid ${C.border};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;font-weight:700;color:${C.warn};">\u05DC\u05E7\u05D5\u05D7 \u05E9\u05D9\u05E0\u05D4 \u05D4\u05E2\u05D3\u05E4\u05D4 \u2014 \u05DE\u05D1\u05E7\u05E9 \u05E9\u05E0\u05D9\u05E6\u05D5\u05E8 \u05E7\u05E9\u05E8</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.5;">
              \u05D4\u05DC\u05E7\u05D5\u05D7 \u05E7\u05D9\u05D1\u05DC \u05DC\u05D9\u05E0\u05E7 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD \u05D0\u05D1\u05DC \u05D1\u05D7\u05E8 \u05DC\u05D1\u05E7\u05E9 \u05E9\u05E0\u05D7\u05D6\u05D5\u05E8 \u05D0\u05DC\u05D9\u05D5.
            </div>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.text};line-height:1.7;margin-bottom:24px;">
              <strong>${s.name}</strong> \u05D1\u05D9\u05E7\u05E9/\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05E7\u05E9\u05E8 \u05D8\u05DC\u05E4\u05D5\u05E0\u05D9 \u05D1\u05DE\u05E7\u05D5\u05DD \u05EA\u05E9\u05DC\u05D5\u05DD \u05D0\u05D5\u05E0\u05DC\u05D9\u05D9\u05DF \u05E2\u05D1\u05D5\u05E8 ${s.eventLabel}${s.eventName ? ` (${s.eventName})` : ''}.
            </div>

            ${contactCard(s.name, s.phone, s.email)}

            <div dir="rtl" style="direction:rtl;text-align:right;margin-top:16px;font-size:13px;color:${C.dim};">
              \u05DE\u05D6\u05D4\u05D4 \u05D1\u05E7\u05E9\u05D4&rlm;: ${ltr(escapeHtml(data.requestId))}
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner) };
}


/* ═══════════════════════════════════════════════════════════════
   4. UPLOAD INSTRUCTIONS EMAIL
   Sent to the client when their event is approved with messaging.
   Explains how to upload a guest phone list.
   ═══════════════════════════════════════════════════════════════ */

export function buildUploadInstructionsEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  uploadUrl: string;
  templateUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD \u05D0\u05D5\u05E9\u05E8 \u2014 \u05D4\u05DB\u05D9\u05E0\u05D5 \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05D0\u05D5\u05E9\u05E8 \u05D5\u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!`,
          `\u05D4\u05D6\u05DE\u05E0\u05EA\u05DD \u05D0\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD &mdash; \u05DB\u05D3\u05D9 \u05E9\u05E0\u05D5\u05DB\u05DC \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA ${ltr('WhatsApp')} \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E9\u05DC\u05DB\u05DD \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2, \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05E2\u05DC\u05D5\u05EA \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF.`,
        )}

        <!-- How it works -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D0\u05D9\u05DA \u05D6\u05D4 \u05E2\u05D5\u05D1\u05D3?')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, `\u05D4\u05D5\u05E8\u05D9\u05D3\u05D5 \u05D0\u05EA \u05D4\u05D8\u05DE\u05E4\u05DC\u05D8 (${ltr('Excel')})`)}
              ${stepRow(2, '\u05DE\u05DC\u05D0\u05D5 \u05D0\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DC \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD')}
              ${stepRow(3, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D1\u05DC\u05D9\u05E0\u05E7 \u05E9\u05DC\u05DE\u05D8\u05D4', true)}
            </table>
          </td>
        </tr>

        <!-- Event info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9\u05DD')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2', `${escapeHtml(params.eventDate)}${params.eventTime ? `&rlm;, ${ltr(escapeHtml(params.eventTime))}` : ''}`)}
              ${row('\u05DE\u05E1\u05E4\u05E8\u05D9 \u05D8\u05DC\u05E4\u05D5\u05DF', '\u05E1\u05DC\u05D5\u05DC\u05E8\u05D9 \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9 (05X) \u05D1\u05DC\u05D1\u05D3')}
              ${row('\u05D3\u05D3-\u05DC\u05D9\u05D9\u05DF \u05DC\u05D4\u05E2\u05DC\u05D0\u05D4', '3 \u05E9\u05E2\u05D5\u05EA \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2', true)}
            </table>
          </td>
        </tr>

        <!-- CTA buttons -->
        ${ctaBtn(params.uploadUrl, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD')}

        <tr>
          <td style="padding:0 32px 8px;text-align:center;background-color:${C.card};">
            <a href="${escapeHtml(params.templateUrl)}" style="color:${C.accent};text-decoration:underline;font-size:14px;" target="_blank">
              \u05D4\u05D5\u05E8\u05D9\u05D3\u05D5 \u05D8\u05DE\u05E4\u05DC\u05D8 ${ltr('Excel')}
            </a>
          </td>
        </tr>

        ${tipBox(`<strong>\u05D8\u05D9\u05E4:</strong> \u05EA\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3, \u05DC\u05D4\u05E1\u05D9\u05E8, \u05D5\u05DC\u05D4\u05E2\u05DC\u05D5\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD \u05D1\u05DB\u05DC \u05E9\u05DC\u05D1 \u05D3\u05E8\u05DA \u05D4\u05DC\u05D9\u05E0\u05E7 \u05D4\u05D6\u05D4. \u05D4\u05E4\u05D5\u05E8\u05D8\u05DC \u05E4\u05EA\u05D5\u05D7 \u05E2\u05D3 \u05E1\u05D9\u05D5\u05DD \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2.`)}`;

  return { subject, html: shell(subject, inner, '\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D0\u05D5\u05E9\u05E8') };
}


/* ═══════════════════════════════════════════════════════════════
   5. UPLOAD REMINDER EMAIL (7-day)
   Sent when event is ~7 days away and guest list not yet uploaded.
   ═══════════════════════════════════════════════════════════════ */

export function buildUploadReminderEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  daysLeft: number;
  uploadUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA: \u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05DC-\u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05D1\u05E2\u05D5\u05D3 <strong>${ltr(String(params.daysLeft))}</strong> \u05D9\u05DE\u05D9\u05DD \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05D4\u05E2\u05DC\u05D9\u05EA\u05DD \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.`,
          `\u05DB\u05D3\u05D9 \u05E9\u05E0\u05D5\u05DB\u05DC \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA ${ltr('WhatsApp')} \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E9\u05DC\u05DB\u05DD, \u05D0\u05E0\u05D7\u05E0\u05D5 \u05E6\u05E8\u05D9\u05DB\u05D9\u05DD \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05DE\u05E1\u05E4\u05E8\u05D9 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05E2\u05DC\u05D5\u05EA \u05E7\u05D5\u05D1\u05E5 ${ltr('Excel')} \u05D0\u05D5 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05D9\u05D3\u05E0\u05D9\u05EA.`,
        )}

        ${ctaBtn(params.uploadUrl, '\u05D4\u05E2\u05DC\u05D5 \u05D0\u05EA \u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5')}

        <!-- Note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:8px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:13px;color:${C.dim};line-height:1.5;">
              \u05D4\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05E0\u05E9\u05DC\u05D7\u05D5\u05EA 2&ndash;3 \u05E9\u05E2\u05D5\u05EA \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2. \u05DB\u05DB\u05DC \u05E9\u05EA\u05E2\u05DC\u05D5 \u05DE\u05D5\u05E7\u05D3\u05DD \u05D9\u05D5\u05EA\u05E8, \u05DB\u05DA \u05D9\u05D5\u05EA\u05E8 \u05D8\u05D5\u05D1!
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D9\u05D3\u05D9\u05D3\u05D5\u05EA\u05D9\u05EA') };
}


/* ═══════════════════════════════════════════════════════════════
   6. UPLOAD URGENT REMINDER EMAIL (3-day)
   Sent when event is ~3 days away and guest list still missing.
   ═══════════════════════════════════════════════════════════════ */

export function buildUploadUrgentReminderEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  uploadUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `\u05D0\u05D7\u05E8\u05D5\u05DF \u05DC\u05D4\u05E2\u05DC\u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05DC-\u201C${params.eventName}\u201D!`;

  const inner = `
        <!-- Urgent banner -->
        <tr>
          <td ${RTL} class="em-warn" style="text-align:right;background-color:${C.warnBg} !important;padding:18px 32px;border-bottom:1px solid ${C.border};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;font-weight:700;color:${C.warn};">\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.5;">
              \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D1\u05E2\u05D5\u05D3 3 \u05D9\u05DE\u05D9\u05DD \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E8\u05E9\u05D9\u05DE\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD
            </div>
          </td>
        </tr>

        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05DB\u05D1\u05E8 \u05D1\u05E2\u05D5\u05D3 <strong>3 \u05D9\u05DE\u05D9\u05DD</strong> \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05DC\u05E0\u05D5 \u05D0\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.`,
        )}

        <!-- Warning -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:15px;color:${C.warn};font-weight:600;line-height:1.6;">
              \u05D1\u05DC\u05D9 \u05D4\u05E8\u05E9\u05D9\u05DE\u05D4, \u05DC\u05D0 \u05E0\u05D5\u05DB\u05DC \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA ${ltr('WhatsApp')} \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD.
            </div>
          </td>
        </tr>

        ${tipBox(`\u05D0\u05DD \u05D0\u05EA\u05DD \u05DC\u05D0 \u05DE\u05EA\u05DB\u05E0\u05E0\u05D9\u05DD \u05DC\u05D4\u05E2\u05DC\u05D5\u05EA \u05E8\u05E9\u05D9\u05DE\u05D4, \u05D6\u05D4 \u05D1\u05E1\u05D3\u05E8 &mdash; \u05D4\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05E6\u05D8\u05E8\u05E3 \u05D3\u05E8\u05DA ${ltr('QR')} \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E2\u05E6\u05DE\u05D5.`)}

        ${ctaBtn(params.uploadUrl, '\u05D4\u05E2\u05DC\u05D5 \u05E2\u05DB\u05E9\u05D9\u05D5 \u2014 \u05DC\u05E4\u05E0\u05D9 \u05E9\u05DE\u05D0\u05D5\u05D7\u05E8!', C.warn)}`;

  return { subject, html: shell(subject, inner, '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D3\u05D7\u05D5\u05E4\u05D4') };
}


/* ═══════════════════════════════════════════════════════════════
   7. EVENT SUMMARY EMAIL
   Sent to the client after the event ends with stats overview.
   ═══════════════════════════════════════════════════════════════ */

export function buildEventSummaryEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  stats: {
    totalParticipants: number;
    fromPreEvent: number;
    fromQr: number;
    totalMatches: number;
    messagesFromGuests: number;
    messagesDelivered: number;
    feedbackSent: number;
  };
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);
  const s = params.stats;

  const subject = `\u05E1\u05D9\u05DB\u05D5\u05DD \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2: \u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong> \u05D4\u05E1\u05EA\u05D9\u05D9\u05DD! \u05D4\u05E0\u05D4 \u05E1\u05D9\u05DB\u05D5\u05DD \u05E7\u05E6\u05E8&rlm;:`,
        )}

        <!-- Stats -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05DE\u05E9\u05EA\u05EA\u05E4\u05D9\u05DD', ltr(String(s.totalParticipants)))}
              ${row(`\u05D4\u05D2\u05D9\u05E2\u05D5 \u05DE-${ltr('WhatsApp')}`, ltr(String(s.fromPreEvent)))}
              ${row(`\u05D4\u05D2\u05D9\u05E2\u05D5 \u05DE-${ltr('QR')}`, ltr(String(s.fromQr)))}
              ${row(`\u05D4\u05EA\u05D0\u05DE\u05D5\u05EA (${ltr('Matches')})`, ltr(String(s.totalMatches)))}
              ${row('\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05E9\u05E0\u05E9\u05DC\u05D7\u05D5', ltr(`${s.messagesDelivered}/${s.messagesFromGuests}`))}
              ${row('\u05E4\u05D9\u05D3\u05D1\u05E7\u05D9\u05DD \u05E9\u05E0\u05E9\u05DC\u05D7\u05D5', ltr(String(s.feedbackSent)), true)}
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
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05E1\u05D9\u05DB\u05D5\u05DD \u05D0\u05D9\u05E8\u05D5\u05E2') };
}


/* ═══════════════════════════════════════════════════════════════
   8. MESSAGING ADD-ON INVOICE EMAIL
   Sent when admin enables messaging for an event after the fact —
   50 shekel add-on invoice with PayBox + Bit payment options.
   ═══════════════════════════════════════════════════════════════ */

export function buildMessagingAddonInvoiceEmail(params: {
  contactName: string;
  eventName: string;
  payboxUrl: string;
  bitPhone: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);
  const addonPrice = 50;

  const subject = `\u05D7\u05E9\u05D1\u05D5\u05DF: \u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC-\u201C${params.eventName}\u201D \u2014 \u20AA${addonPrice}`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D5\u05E1\u05E4\u05E0\u05D5 \u05D0\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong>.`,
        )}

        <!-- Invoice details -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05D7\u05E9\u05D1\u05D5\u05DF')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E9\u05D9\u05E8\u05D5\u05EA', `\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA ${ltr('WhatsApp')} \u05DC\u05D0\u05D5\u05E8\u05D7\u05D9\u05DD`)}
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 0 14px 12px;background-color:${C.card};color:${C.accent};font-size:16px;font-weight:700;width:100px;border-top:2px solid ${C.accent};vertical-align:top;">\u05E1\u05D4\u05F4\u05DB</td>
                <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;background-color:${C.card};color:${C.text};font-size:20px;font-weight:700;border-top:2px solid ${C.accent};">${ltr(`\u20AA${addonPrice}`)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Payment buttons -->
        <tr>
          <td style="padding:28px 32px 24px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.payboxUrl)}" style="display:block;text-decoration:none;" target="_blank">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" class="em-paybox" style="background-color:${C.paybox} !important;border-radius:12px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">\u05E9\u05DC\u05DE\u05D5 \u05E2\u05DB\u05E9\u05D9\u05D5 (${ltr('PayBox')})</div>
                          <div dir="rtl" style="direction:rtl;font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7</div>
                        </td>
                      </tr>
                    </table>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Bit alternative -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:14px;color:${C.muted};">
              \u05D0\u05D5 \u05D4\u05E2\u05D1\u05D9\u05E8\u05D5 ${ltr(`\u20AA${addonPrice}`)} \u05D1-${ltr('Bit')}&rlm;: ${ltr(escapeHtml(params.bitPhone))}
            </div>
          </td>
        </tr>

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA') };
}


/* ═══════════════════════════════════════════════════════════════
   9. CUSTOM REMINDER EMAIL
   Flexible admin-triggered email for any manual reminders.
   ═══════════════════════════════════════════════════════════════ */

export function buildCustomReminderEmail(params: {
  contactName: string;
  eventName: string;
  message: string;
  uploadUrl?: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);
  const safeMessage = escapeHtml(params.message);

  const subject = `\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05DE-Eventa: \u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D1\u05E0\u05D5\u05D2\u05E2 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong>&rlm;:`,
        )}

        <!-- Message body -->
        ${tipBox(safeMessage)}

        ${params.uploadUrl ? ctaBtn(params.uploadUrl, '\u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05E2\u05DC\u05D0\u05EA \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD') : `
        <!-- Bottom padding -->
        <tr>
          <td style="padding:0 0 16px;background-color:${C.card};">&nbsp;</td>
        </tr>`}

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA') };
}


/* ═══════════════════════════════════════════════════════════════
   10. CARD CAPTURED CONFIRMATION EMAIL
   Sent to the client right after they enter their credit card
   on the website. Tells them card is saved, charge only on approval.
   ═══════════════════════════════════════════════════════════════ */

export function buildCardCapturedEmail(params: {
  contactName: string;
  eventName: string;
  totalPriceShekel: number;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `${ltr('Eventa')} \u2014 \u05E4\u05E8\u05D8\u05D9 \u05D4\u05DB\u05E8\u05D8\u05D9\u05E1 \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05E4\u05E8\u05D8\u05D9 \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05D0\u05E9\u05E8\u05D0\u05D9 \u05E9\u05DC\u05DA \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4 \u05E2\u05D1\u05D5\u05E8 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 <strong>${safeEvent}</strong>.`,
        )}

        <!-- Info box -->
        ${tipBox(`<strong>\u05D7\u05E9\u05D5\u05D1 \u05DC\u05D3\u05E2\u05EA:</strong> \u05D4\u05DB\u05E8\u05D8\u05D9\u05E1 <u>\u05DC\u05D0 \u05D7\u05D5\u05D9\u05D1</u> \u05D1\u05E9\u05DC\u05D1 \u05D6\u05D4.<br/>
              \u05D4\u05D7\u05D9\u05D5\u05D1 \u05D9\u05EA\u05D1\u05E6\u05E2 \u05E8\u05E7 \u05DC\u05D0\u05D7\u05E8 \u05E9\u05E0\u05D1\u05D3\u05D5\u05E7 \u05D5\u05E0\u05D0\u05E9\u05E8 \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA.<br/>
              \u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1: ${ltr(`\u20AA${params.totalPriceShekel}`)}`)}

        <!-- What happens next -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px 28px;background-color:${C.card};">
            ${sectionTitle('\u05DE\u05D4 \u05E7\u05D5\u05E8\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5?')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${stepRow(1, '\u05D0\u05E0\u05D7\u05E0\u05D5 \u05D1\u05D5\u05D3\u05E7\u05D9\u05DD \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA')}
              ${stepRow(2, '\u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8 \u2014 \u05D4\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D9\u05D7\u05D5\u05D9\u05D1')}
              ${stepRow(3, '\u05EA\u05E7\u05D1\u05DC\u05D5 \u05E7\u05D1\u05DC\u05D4 \u05D1\u05DE\u05D9\u05D9\u05DC + \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D9\u05D9\u05E6\u05D0 \u05DC\u05D0\u05D5\u05D5\u05D9\u05E8', true)}
            </table>
          </td>
        </tr>

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D0\u05D9\u05E9\u05D5\u05E8 \u05DB\u05E8\u05D8\u05D9\u05E1') };
}


/* ═══════════════════════════════════════════════════════════════
   11. APPROVAL + CHARGE EMAIL
   Sent to the client when admin approves the request and the
   credit card charge goes through. Includes receipt info.
   ═══════════════════════════════════════════════════════════════ */

export function buildApprovalChargeEmail(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  totalPriceShekel: number;
  eventUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.contactName);
  const safeEvent = escapeHtml(params.eventName);

  const subject = `${ltr('Eventa')} \u2014 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D5\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8!`;

  const inner = `
        <!-- Greeting -->
        ${greeting(
          safeName,
          `\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05E2\u05D1\u05D5\u05E8 <strong>${safeEvent}</strong> <strong>\u05D0\u05D5\u05E9\u05E8\u05D4</strong> \u05D5\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!`,
        )}

        <!-- Payment confirmation -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E1\u05D8\u05D8\u05D5\u05E1', '<strong style="color:#2e7d32;">\u05E9\u05D5\u05DC\u05DD \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4</strong>')}
              ${row('\u05E1\u05DB\u05D5\u05DD', ltr(`\u20AA${params.totalPriceShekel}`))}
              ${row('\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD', '\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D0\u05E9\u05E8\u05D0\u05D9')}
              ${row('\u05EA\u05D0\u05E8\u05D9\u05DA \u05D7\u05D9\u05D5\u05D1', fmtDate(new Date().toISOString()), true)}
            </table>
          </td>
        </tr>

        <!-- Event info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05E9\u05DD \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2', safeEvent)}
              ${row('\u05EA\u05D0\u05E8\u05D9\u05DA', escapeHtml(params.eventDate), true)}
            </table>
          </td>
        </tr>

        ${ctaBtn(params.eventUrl, '\u05E6\u05E4\u05D9\u05D9\u05D4 \u05D1\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA')}

        <!-- Receipt note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:8px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:14px;color:${C.muted};">
              \u05E7\u05D1\u05DC\u05D4 \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05EA\u05D9\u05E9\u05DC\u05D7 \u05D1\u05E0\u05E4\u05E8\u05D3 \u05DC\u05DB\u05EA\u05D5\u05D1\u05EA \u05D4\u05DE\u05D9\u05D9\u05DC \u05E9\u05DC\u05DA.
            </div>
          </td>
        </tr>

        ${supportRow()}`;

  return { subject, html: shell(subject, inner, '\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4') };
}


/* ═══════════════════════════════════════════════════════════════
   12. ADMIN CHARGE NOTIFICATION EMAIL
   Sent to admin after auto-charge on approval so they have a
   record of the charge.
   ═══════════════════════════════════════════════════════════════ */

export function buildAdminChargeNotificationEmail(params: {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  eventName: string;
  totalPriceShekel: number;
  requestId: string;
  eventId: string;
  eventSlug: string;
}): { subject: string; html: string } {
  const s = {
    name: escapeHtml(params.contactName),
    email: escapeHtml(params.contactEmail),
    phone: escapeHtml(params.contactPhone),
    event: escapeHtml(params.eventName),
  };

  const subject = `\u05D7\u05D9\u05D5\u05D1 \u05D1\u05D5\u05E6\u05E2 \u2014 ${params.contactName} | ${ltr(`\u20AA${params.totalPriceShekel}`)}`;

  const inner = `
        <!-- Success banner -->
        <tr>
          <td ${RTL} style="text-align:right;background-color:#e8f5e9 !important;padding:18px 32px;border-bottom:1px solid ${C.border};font-size:15px;font-weight:700;color:#2e7d32;">
            \u05D7\u05D9\u05D5\u05D1 \u05D1\u05D5\u05E6\u05E2 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4 + \u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D5\u05E6\u05E8
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 0;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4')}
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('\u05DC\u05E7\u05D5\u05D7', s.name)}
              ${row('\u05D0\u05D9\u05E8\u05D5\u05E2', s.event)}
              ${row('\u05E1\u05DB\u05D5\u05DD \u05D7\u05D9\u05D5\u05D1', ltr(`\u20AA${params.totalPriceShekel}`))}
              ${row('\u05D0\u05DE\u05E6\u05E2\u05D9', `\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D0\u05E9\u05E8\u05D0\u05D9 (${ltr('Invoice4U Clearing')})`)}
              ${row('\u05D0\u05D9\u05E8\u05D5\u05E2 ID', ltr(escapeHtml(params.eventId)), true)}
            </table>
          </td>
        </tr>

        <!-- Contact -->
        <tr>
          <td ${RTL} style="text-align:right;padding:32px 32px 28px;background-color:${C.card};">
            ${sectionTitle('\u05E4\u05E8\u05D8\u05D9 \u05DC\u05E7\u05D5\u05D7')}
            ${contactCard(s.name, s.phone, s.email)}
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, '\u05D7\u05D9\u05D5\u05D1 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9') };
}
