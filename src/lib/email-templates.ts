/**
 * Email templates for the order system.
 *
 * Key design rules for email HTML RTL:
 *  - Gmail strips dir from <html>/<body>, so EVERY <td> gets dir="rtl" + text-align:right
 *  - Table-based layout only (no flexbox/grid) for Outlook + Gmail
 *  - No emojis
 *  - English words (brand, phone, email) in dir="ltr" spans with unicode-bidi:isolate
 *  - Logo from https://www.eventa.productions/icons/Eventa_Logo.png
 */

import { EVENT_TYPE_LABELS } from '@/lib/constants';

const LOGO_URL = 'https://www.eventa.productions/icons/Eventa_Logo.png';

/* ─── Shared palette ─── */
const C = {
  bg:       '#f5f3f0',
  card:     '#ffffff',
  text:     '#1a1a1a',
  muted:    '#6b6b6b',
  dim:      '#999999',
  border:   '#e8e4df',
  accent:   '#b08d7e',
  accentBg: '#faf6f4',
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

/** Build a two-column info row: label | value. Both cells are RTL. */
function row(label: string, value: string, isLast = false): string {
  const bb = isLast ? '' : `border-bottom:1px solid ${C.border};`;
  return `<tr>
    <td dir="rtl" style="text-align:right;padding:10px 0 10px 12px;${bb}background-color:${C.card};color:${C.muted};font-size:13px;width:90px;vertical-align:top;">${label}</td>
    <td dir="rtl" style="text-align:right;padding:10px 12px 10px 0;${bb}background-color:${C.card};color:${C.text};font-size:14px;">${value}</td>
  </tr>`;
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
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      body, table, td, div, p, a, span { background-color: ${C.bg} !important; color: ${C.text} !important; }
      .em-card { background-color: ${C.card} !important; }
      .em-header { background-color: ${C.text} !important; }
      .em-row-alt { background-color: #fafaf8 !important; }
      .em-paybox { background-color: ${C.paybox} !important; }
      .em-bit { background-color: ${C.bit} !important; }
      .em-warn { background-color: ${C.warnBg} !important; }
    }
  </style>
</head>
<body dir="rtl" style="margin:0;padding:0;direction:rtl;text-align:right;background-color:${C.bg};color:${C.text};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;background-color:${C.bg};">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Main card -->
      <table dir="rtl" role="presentation" width="560" cellpadding="0" cellspacing="0" class="em-card" style="direction:rtl;max-width:560px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Logo header -->
        <tr>
          <td class="em-header" style="background-color:${C.text};padding:24px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="Eventa" width="140" height="auto" style="display:inline-block;max-width:140px;height:auto;border:0;" />
            ${subtitle ? `<div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};margin-top:8px;letter-spacing:1px;">${subtitle}</div>` : ''}
          </td>
        </tr>

        ${inner}

      </table>
      <!-- /Main card -->

      <!-- Footer -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:16px 0;text-align:center;font-size:11px;color:${C.dim};">
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
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">עלות</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('חבילה בסיסית', ltr(`\u20AA${base}`))}
              ${wantsGuestMessages ? row('הודעות לאורחים', ltr(`\u20AA${msgAddon}`)) : ''}
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 0 14px 12px;background-color:${C.card};color:${C.accent};font-size:15px;font-weight:700;width:90px;border-top:2px solid ${C.accent};vertical-align:top;">סה\u05F4כ</td>
                <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;background-color:${C.card};color:${C.text};font-size:18px;font-weight:700;border-top:2px solid ${C.accent};">${ltr(`\u20AA${total}`)}</td>
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
          <td ${RTL} style="text-align:right;padding:28px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטי האירוע</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('סוג אירוע', `<strong>${s.eventLabel}</strong>`)}
              ${s.eventName ? row('שם', s.eventName) : ''}
              ${row('התחלה', `${s.startsAt}${s.startsTime ? `&rlm;, ${ltr(s.startsTime)}` : ''}`)}
              ${row('סיום', `${s.endsAt}${s.endsTime ? `&rlm;, ${ltr(s.endsTime)}` : ''}`, true)}
            </table>
          </td>
        </tr>

        <!-- Options section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">אפשרויות</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('רקע', data.wantsCustomBackground ? `רקע מותאם אישית${data.hasBgImage ? ' (תמונה מצורפת)' : ''}` : 'ברירת מחדל')}
              ${row('פוסטר', data.posterChoice === 'qr-only' ? `${ltr('QR')} בלבד` : `תבנית&rlm;: ${s.template}`)}
              ${row('הודעות', data.wantsGuestMessages ? 'כן' : 'לא', true)}
            </table>
          </td>
        </tr>

        ${s.specialReqs ? `
        <!-- Special requests -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:10px;">בקשות מיוחדות</div>
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:6px;padding:14px 16px;font-size:14px;color:${C.text};line-height:1.7;">
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
    ? 'התקשרו אליי'
    : 'שלחו לינק לתשלום';

  const subject = `בקשה חדשה \u2014 ${s.eventLabel} | ${data.contactName}`;

  const inner = `
        <!-- Contact preference banner -->
        <tr>
          <td ${RTL} style="text-align:right;background-color:${data.contactPreference === 'send-link' ? '#eef4ff' : C.accentBg} !important;padding:14px 32px;border-bottom:1px solid ${C.border};font-size:14px;font-weight:600;color:${data.contactPreference === 'send-link' ? C.paybox : C.accent};">
            ${data.contactPreference === 'send-link' ? 'הלקוח ביקש לקבל לינק לתשלום' : 'הלקוח מבקש שנחזור אליו'}
          </td>
        </tr>

        ${eventDetailsBlock(data)}

        ${priceBlock(data.wantsGuestMessages)}

        <!-- Contact preference row -->
        <tr>
          <td ${RTL} style="text-align:right;padding:0 32px 4px;background-color:${C.card};">
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('העדפת קשר', `<strong>${contactPrefLabel}</strong>`, true)}
            </table>
          </td>
        </tr>

        <!-- Contact section -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטי לקוח</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-row-alt" style="direction:rtl;border-collapse:collapse;background-color:#fafaf8;border-radius:8px;overflow:hidden;">
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:#fafaf8;color:${C.muted};font-size:13px;width:70px;">שם</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:#fafaf8;color:${C.text};font-size:15px;font-weight:600;">${s.name}</td>
              </tr>
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}background-color:#fafaf8;color:${C.muted};font-size:13px;">טלפון</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}background-color:#fafaf8;">
                  <a href="tel:${s.phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${s.phone}</a>
                </td>
              </tr>
              ${s.email ? `<tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:#fafaf8;color:${C.muted};font-size:13px;">אימייל</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:#fafaf8;">
                  <a href="mailto:${s.email}" style="color:${C.accent};font-size:14px;text-decoration:none;" dir="ltr">${s.email}</a>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'בקשת אירוע חדשה') };
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

  const subject = `${ltr('Eventa')} \u2014 פרטי תשלום עבור האירוע שלך`;

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
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">הבקשה שלך התקבלה בהצלחה.</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};line-height:1.6;padding-bottom:20px;">ניתן להשלים את התשלום באחת הדרכים הבאות&rlm;:</div>
          </td>
        </tr>

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
                        <td align="center" class="em-paybox" style="background-color:${C.paybox} !important;border-radius:10px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('PayBox')}</div>
                          <div dir="rtl" style="direction:rtl;font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">תשלום מאובטח</div>
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
                        <td align="center" class="em-bit" style="background-color:${C.bit} !important;border-radius:10px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('Bit')}</div>
                          <div dir="rtl" style="direction:rtl;font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">תשלום מאובטח</div>
                        </td>
                      </tr>
                    </table>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Separator -->
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        ${eventDetailsBlock(orderLike)}

        ${priceBlock(data.wantsGuestMessages)}

        <!-- Separator -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Contact me instead -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:24px 32px 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:13px;color:${C.muted};margin-bottom:14px;">מעדיפים שניצור איתכם קשר&rlm;?</div>
            <a href="${contactMeUrl}" style="display:inline-block;text-decoration:none;border:1px solid ${C.accent};border-radius:8px;padding:12px 28px;color:${C.accent};font-size:14px;font-weight:600;" target="_blank">
              צרו איתי קשר
            </a>
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};margin-top:10px;">נחזור אליכם תוך 48 שעות</div>
          </td>
        </tr>

        <!-- Support footer row -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};">
              לשאלות ניתן לפנות אלינו&rlm;: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
          </td>
        </tr>`;

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

  const subject = `לקוח מבקש שניצור קשר \u2014 ${data.contactName}`;

  const inner = `
        <!-- Alert banner -->
        <tr>
          <td ${RTL} class="em-warn" style="text-align:right;background-color:${C.warnBg} !important;padding:16px 32px;border-bottom:1px solid ${C.border};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;font-weight:600;color:${C.warn};">לקוח שינה העדפה \u2014 מבקש שניצור קשר</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.muted};margin-top:4px;">
              הלקוח קיבל לינק לתשלום אבל בחר לבקש שנחזור אליו.
            </div>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.text};line-height:1.7;margin-bottom:20px;">
              <strong>${s.name}</strong> ביקש/ה ליצור קשר טלפוני במקום תשלום אונליין עבור ${s.eventLabel}${s.eventName ? ` (${s.eventName})` : ''}.
            </div>

            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-row-alt" style="direction:rtl;border-collapse:collapse;background-color:#fafaf8;border-radius:8px;overflow:hidden;">
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:#fafaf8;color:${C.muted};font-size:13px;width:70px;">שם</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;border-bottom:1px solid ${C.border};background-color:#fafaf8;color:${C.text};font-size:14px;font-weight:600;">${s.name}</td>
              </tr>
              <tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}background-color:#fafaf8;color:${C.muted};font-size:13px;">טלפון</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}background-color:#fafaf8;">
                  <a href="tel:${s.phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${s.phone}</a>
                </td>
              </tr>
              ${s.email ? `<tr>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:#fafaf8;color:${C.muted};font-size:13px;">אימייל</td>
                <td dir="rtl" style="text-align:right;padding:12px 16px;background-color:#fafaf8;">
                  <a href="mailto:${s.email}" style="color:${C.accent};font-size:14px;text-decoration:none;" dir="ltr">${s.email}</a>
                </td>
              </tr>` : ''}
            </table>

            <div dir="rtl" style="direction:rtl;text-align:right;margin-top:16px;font-size:12px;color:${C.dim};">
              מזהה בקשה&rlm;: ${ltr(escapeHtml(data.requestId))}
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

  const subject = `האירוע שלכם אושר — הכינו את רשימת האורחים`;

  const inner = `
        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
              האירוע <strong>${safeEvent}</strong> אושר ונוצר בהצלחה!
            </div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};line-height:1.6;padding-bottom:20px;">
              הזמנתם את שירות ההודעות לאורחים &mdash; כדי שנוכל לשלוח הודעות ${ltr('WhatsApp')}
              לאורחים שלכם לפני האירוע, צריך להעלות את רשימת מספרי הטלפון.
            </div>
          </td>
        </tr>

        <!-- How it works -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">איך זה עובד?</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('שלב 1', 'הורידו את הטמפלט (Excel)')}
              ${row('שלב 2', 'מלאו את מספרי הטלפון של האורחים')}
              ${row('שלב 3', 'העלו את הקובץ בלינק שלמטה', true)}
            </table>
          </td>
        </tr>

        <!-- Event info -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטים</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('תאריך האירוע', `${escapeHtml(params.eventDate)}${params.eventTime ? `&rlm;, ${ltr(escapeHtml(params.eventTime))}` : ''}`)}
              ${row('מספרי טלפון', 'סלולרי ישראלי (05X) בלבד')}
              ${row('דד-ליין להעלאה', '3 שעות לפני האירוע', true)}
            </table>
          </td>
        </tr>

        <!-- CTA buttons -->
        <tr>
          <td style="padding:28px 32px 12px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.uploadUrl)}" style="display:inline-block;text-decoration:none;background-color:${C.accent};border-radius:10px;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:700;" target="_blank">
                    העלו את רשימת האורחים
                  </a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.templateUrl)}" style="color:${C.accent};text-decoration:underline;font-size:14px;" target="_blank">
                    הורידו טמפלט ${ltr('Excel')}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tip -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:right;padding:16px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:6px;padding:14px 16px;font-size:13px;color:${C.muted};line-height:1.7;">
              <strong>טיפ:</strong> תוכלו להוסיף, להסיר, ולהעלות מספרים נוספים בכל שלב דרך הלינק הזה. הפורטל פתוח עד סיום האירוע.
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'אירוע אושר') };
}


/* ═══════════════════════════════════════════════════════════════
   5. UPLOAD REMINDER EMAIL (7‑day)
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

  const subject = `תזכורת: העלו את רשימת האורחים ל-\u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
              האירוע <strong>${safeEvent}</strong> בעוד
              <strong>${ltr(String(params.daysLeft))}</strong> ימים ועדיין לא העליתם את רשימת האורחים.
            </div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};line-height:1.6;padding-bottom:20px;">
              כדי שנוכל לשלוח הודעות ${ltr('WhatsApp')} לאורחים שלכם, אנחנו צריכים
              את רשימת מספרי הטלפון. אפשר להעלות קובץ ${ltr('Excel')} או להוסיף מספרים ידנית.
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 32px 20px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.uploadUrl)}" style="display:inline-block;text-decoration:none;background-color:${C.accent};border-radius:10px;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:700;" target="_blank">
                    העלו את הרשימה עכשיו
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Note -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};">
              ההודעות נשלחות 2&ndash;3 שעות לפני האירוע. ככל שתעלו מוקדם יותר, כך יותר טוב!
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'תזכורת ידידותית') };
}


/* ═══════════════════════════════════════════════════════════════
   6. UPLOAD URGENT REMINDER EMAIL (3‑day)
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

  const subject = `אחרון להעלאת רשימת אורחים ל-\u201C${params.eventName}\u201D!`;

  const inner = `
        <!-- Urgent banner -->
        <tr>
          <td ${RTL} class="em-warn" style="text-align:right;background-color:${C.warnBg} !important;padding:16px 32px;border-bottom:1px solid ${C.border};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;font-weight:600;color:${C.warn};">תזכורת אחרונה</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.muted};margin-top:4px;">
              האירוע בעוד 3 ימים ועדיין אין רשימת אורחים
            </div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
              האירוע <strong>${safeEvent}</strong> כבר בעוד <strong>3 ימים</strong> ועדיין אין לנו את רשימת האורחים.
            </div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.warn};font-weight:600;line-height:1.6;margin-top:8px;">
              בלי הרשימה, לא נוכל לשלוח הודעות ${ltr('WhatsApp')} לאורחים.
            </div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:13px;color:${C.muted};line-height:1.6;margin-top:8px;padding-bottom:20px;">
              אם אתם לא מתכננים להעלות רשימה, זה בסדר &mdash; האורחים עדיין יוכלו
              להצטרף דרך ${ltr('QR')} באירוע עצמו.
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:8px 32px 28px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.uploadUrl)}" style="display:inline-block;text-decoration:none;background-color:${C.warn};border-radius:10px;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:700;" target="_blank">
                    העלו עכשיו &mdash; לפני שמאוחר!
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'תזכורת דחופה') };
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

  const subject = `סיכום האירוע: \u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;padding-bottom:20px;">
              האירוע <strong>${safeEvent}</strong> הסתיים! הנה סיכום קצר&rlm;:
            </div>
          </td>
        </tr>

        <!-- Stats -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">נתוני האירוע</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('משתתפים', ltr(String(s.totalParticipants)))}
              ${row('הגיעו מ-WhatsApp', ltr(String(s.fromPreEvent)))}
              ${row('הגיעו מ-QR', ltr(String(s.fromQr)))}
              ${row('התאמות (Matches)', ltr(String(s.totalMatches)))}
              ${row('הודעות שנשלחו', ltr(`${s.messagesDelivered}/${s.messagesFromGuests}`))}
              ${row('פידבקים שנשלחו', ltr(String(s.feedbackSent)), true)}
            </table>
          </td>
        </tr>

        <!-- Thank you -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:24px 32px 28px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:14px;color:${C.muted};line-height:1.7;">
              תודה שבחרתם ב-${ltr('Eventa')}!<br/>נשמח לארח אתכם שוב.
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'סיכום אירוע') };
}


/* ═══════════════════════════════════════════════════════════════
   8. MESSAGING ADD-ON INVOICE EMAIL
   Sent when admin enables messaging for an event after the fact —
   ₪50 add-on invoice with PayBox + Bit payment options.
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

  const subject = `חשבון: שירות הודעות ל-\u201C${params.eventName}\u201D \u2014 \u20AA${addonPrice}`;

  const inner = `
        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;padding-bottom:20px;">
              הוספנו את שירות ההודעות לאורחים לאירוע <strong>${safeEvent}</strong>.
            </div>
          </td>
        </tr>

        <!-- Invoice details -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px 0;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטי חשבון</div>
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;border-collapse:collapse;">
              ${row('שירות', `הודעות ${ltr('WhatsApp')} לאורחים`)}
              <tr>
                <td dir="rtl" style="text-align:right;padding:14px 0 14px 12px;background-color:${C.card};color:${C.accent};font-size:15px;font-weight:700;width:90px;border-top:2px solid ${C.accent};vertical-align:top;">סה\u05F4כ</td>
                <td dir="rtl" style="text-align:right;padding:14px 12px 14px 0;background-color:${C.card};color:${C.text};font-size:18px;font-weight:700;border-top:2px solid ${C.accent};">${ltr(`\u20AA${addonPrice}`)}</td>
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
                        <td align="center" class="em-paybox" style="background-color:${C.paybox} !important;border-radius:10px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">שלמו עכשיו (${ltr('PayBox')})</div>
                          <div dir="rtl" style="direction:rtl;font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">תשלום מאובטח</div>
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
              או העבירו ${ltr(`\u20AA${addonPrice}`)} ב-${ltr('Bit')}&rlm;: ${ltr(escapeHtml(params.bitPhone))}
            </div>
          </td>
        </tr>

        <!-- Support footer row -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};">
              לשאלות ניתן לפנות אלינו&rlm;: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'חשבון שירות הודעות') };
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

  const subject = `תזכורת מ-Eventa: \u201C${params.eventName}\u201D`;

  const inner = `
        <!-- Greeting -->
        <tr>
          <td ${RTL} style="text-align:right;padding:28px 32px 4px;border-bottom:1px solid ${C.border};background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName}&rlm;,</div>
            <div dir="rtl" style="direction:rtl;text-align:right;font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;padding-bottom:20px;">
              בנוגע לאירוע <strong>${safeEvent}</strong>&rlm;:
            </div>
          </td>
        </tr>

        <!-- Message body -->
        <tr>
          <td ${RTL} style="text-align:right;padding:24px 32px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:right;background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:6px;padding:16px 18px;font-size:14px;color:${C.text};line-height:1.8;white-space:pre-line;">
              ${safeMessage}
            </div>
          </td>
        </tr>

        ${params.uploadUrl ? `
        <!-- Upload CTA -->
        <tr>
          <td style="padding:8px 32px 28px;text-align:center;background-color:${C.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(params.uploadUrl)}" style="display:inline-block;text-decoration:none;background-color:${C.accent};border-radius:10px;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:700;" target="_blank">
                    לפורטל העלאת אורחים
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : `
        <!-- Bottom padding -->
        <tr>
          <td style="padding:0 0 16px;background-color:${C.card};">&nbsp;</td>
        </tr>`}

        <!-- Support footer row -->
        <tr>
          <td dir="rtl" style="direction:rtl;text-align:center;padding:0 32px 24px;background-color:${C.card};">
            <div dir="rtl" style="direction:rtl;text-align:center;font-size:12px;color:${C.dim};">
              לשאלות ניתן לפנות אלינו&rlm;: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
          </td>
        </tr>`;

  return { subject, html: shell(subject, inner, 'תזכורת') };
}
