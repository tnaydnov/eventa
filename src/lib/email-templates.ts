/**
 * Email templates for the order system.
 * Clean, table-based HTML emails with correct RTL + BiDi isolation.
 *
 * Design principles:
 *  - Light background for maximum email-client compatibility
 *  - Table layout (no flexbox/grid) for Outlook + Gmail
 *  - No emojis — only styled HTML elements
 *  - English brand names wrapped in dir="ltr" spans for proper BiDi
 *  - Minimal color palette: warm neutral + rose-gold accent
 */

import { EVENT_TYPE_LABELS } from '@/lib/constants';

/* ─── Shared palette ─── */
const C = {
  bg:       '#f5f3f0',
  card:     '#ffffff',
  text:     '#1a1a1a',
  muted:    '#6b6b6b',
  dim:      '#999999',
  border:   '#e8e4df',
  accent:   '#b08d7e', // warm rose-gold
  accentBg: '#faf6f4',
  paybox:   '#004aad',
  bit:      '#1aab4a',
  warn:     '#c27816',
  warnBg:   '#fef9f0',
} as const;

/** Escape HTML special characters to prevent injection in email template. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap an English string in LTR isolation so it flows correctly inside RTL. */
function ltr(s: string): string {
  return `<span dir="ltr" style="unicode-bidi:embed;">${s}</span>`;
}

/** Format ISO datetime to readable Hebrew date. */
function fmtDate(iso: string): string {
  if (!iso) return '\u2014';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Format ISO datetime to HH:MM */
function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
    eventName: escapeHtml(data.eventName),
    startsAt: fmtDate(data.startsAt),
    startsTime: fmtTime(data.startsAt),
    endsAt: fmtDate(data.endsAt),
    endsTime: fmtTime(data.endsAt),
    template: escapeHtml(data.selectedTemplate),
    specialReqs: escapeHtml(data.specialRequests),
  };

  const contactPrefLabel = data.contactPreference === 'call-me'
    ? 'התקשרו אליי'
    : 'שלחו לינק לתשלום';

  const subject = `בקשה חדשה \u2014 ${s.eventLabel} | ${data.contactName}`;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Main card -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Header bar -->
        <tr>
          <td style="background-color:${C.text};padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:${C.card};">${ltr('EVENTA')}</div>
            <div style="font-size:12px;color:${C.dim};margin-top:6px;letter-spacing:1px;">בקשת אירוע חדשה</div>
          </td>
        </tr>

        <!-- Contact preference banner -->
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:${data.contactPreference === 'send-link' ? '#eef4ff' : C.accentBg};padding:14px 32px;border-bottom:1px solid ${C.border};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:14px;font-weight:600;color:${data.contactPreference === 'send-link' ? C.paybox : C.accent};">
                        ${data.contactPreference === 'send-link' ? 'הלקוח ביקש לקבל לינק לתשלום' : 'הלקוח מבקש שנחזור אליו'}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Event info section -->
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטי האירוע</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;width:90px;vertical-align:top;">סוג אירוע</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;font-weight:600;">${s.eventLabel}</td>
              </tr>
              ${s.eventName ? `<tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;vertical-align:top;">שם</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;font-weight:500;">${s.eventName}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;vertical-align:top;">התחלה</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;">${s.startsAt}${s.startsTime ? `, ${ltr(s.startsTime)}` : ''}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;vertical-align:top;">סיום</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;">${s.endsAt}${s.endsTime ? `, ${ltr(s.endsTime)}` : ''}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Options section -->
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">אפשרויות</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;width:90px;">רקע</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;">
                  ${data.wantsCustomBackground ? `רקע מותאם אישית${data.hasBgImage ? ' (תמונה מצורפת)' : ''}` : 'ברירת מחדל'}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;">פוסטר</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;">
                  ${data.posterChoice === 'qr-only' ? `${ltr('QR')} בלבד` : `תבנית: ${s.template}`}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;">הודעות</td>
                <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;">
                  ${data.wantsGuestMessages ? 'כן' : 'לא'}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:${C.muted};font-size:13px;">העדפת קשר</td>
                <td style="padding:10px 0;color:${C.text};font-size:14px;font-weight:500;">${contactPrefLabel}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${s.specialReqs ? `
        <!-- Special requests -->
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:10px;">בקשות מיוחדות</div>
            <div style="background-color:${C.accentBg};border-right:3px solid ${C.accent};border-radius:6px;padding:14px 16px;font-size:14px;color:${C.text};line-height:1.7;">
              ${s.specialReqs}
            </div>
          </td>
        </tr>` : ''}

        <!-- Contact section -->
        <tr>
          <td style="padding:24px 32px 28px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.accent};margin-bottom:14px;">פרטי לקוח</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#fafaf8;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;width:70px;">שם</td>
                <td style="padding:12px 16px;border-bottom:1px solid ${C.border};color:${C.text};font-size:15px;font-weight:600;">${s.name}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}color:${C.muted};font-size:13px;">טלפון</td>
                <td style="padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}">
                  <a href="tel:${s.phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${s.phone}</a>
                </td>
              </tr>
              ${s.email ? `<tr>
                <td style="padding:12px 16px;color:${C.muted};font-size:13px;">אימייל</td>
                <td style="padding:12px 16px;">
                  <a href="mailto:${s.email}" style="color:${C.accent};font-size:14px;text-decoration:none;" dir="ltr">${s.email}</a>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

      </table>
      <!-- /Main card -->

      <!-- Footer -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:16px 0;text-align:center;font-size:11px;color:${C.dim};">
            ${ltr('Eventa')} &middot; בקשה מהאתר &middot; ${ltr(new Date().toLocaleDateString('he-IL'))}
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}


/* ═══════════════════════════════════════════════════════════════
   2. CLIENT PAYMENT EMAIL
   Sent to the client when they choose "send-link" payment option.
   Includes PayBox, Bit buttons + "contact me instead" fallback.
   ═══════════════════════════════════════════════════════════════ */

export function buildClientPaymentEmail(data: {
  contactName: string;
  contactEmail: string;
  eventType: string;
  eventName: string;
  requestId: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(data.contactName);
  const safeEventLabel = escapeHtml(EVENT_TYPE_LABELS[data.eventType] || data.eventType);
  const safeEventName = data.eventName ? escapeHtml(data.eventName) : '';
  const contactMeUrl = `${data.baseUrl}/api/order/contact-me?id=${data.requestId}`;

  const eventLine = safeEventName
    ? `${safeEventLabel} &middot; ${safeEventName}`
    : safeEventLabel;

  const subject = `${ltr('Eventa')} \u2014 פרטי תשלום עבור האירוע שלך`;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr><td align="center" style="padding:40px 16px;">

      <!-- Main card -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Header -->
        <tr>
          <td style="padding:36px 32px 28px;text-align:center;background-color:${C.card};border-bottom:1px solid ${C.border};">
            <div style="font-size:24px;font-weight:700;letter-spacing:4px;color:${C.text};margin-bottom:20px;">${ltr('EVENTA')}</div>
            <div style="font-size:16px;color:${C.text};font-weight:500;line-height:1.6;">שלום ${safeName},</div>
            <div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">הבקשה שלך התקבלה בהצלחה.</div>
            <div style="font-size:14px;color:${C.muted};line-height:1.6;">ניתן להשלים את התשלום באחת הדרכים הבאות:</div>
          </td>
        </tr>

        <!-- Event summary -->
        <tr>
          <td style="padding:18px 32px;background-color:#fafaf8;border-bottom:1px solid ${C.border};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:${C.dim};margin-bottom:4px;">האירוע שלך</div>
                  <div style="font-size:15px;font-weight:600;color:${C.text};">${eventLine}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Payment buttons -->
        <tr>
          <td style="padding:32px 32px 24px;">

            <!-- PayBox -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td align="center">
                  <a href="#" style="display:block;text-decoration:none;" target="_blank">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:${C.paybox};border-radius:10px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('PayBox')}</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">תשלום מאובטח</div>
                        </td>
                      </tr>
                    </table>
                  </a>
                </td>
              </tr>
            </table>

            <!-- Bit -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
              <tr>
                <td align="center">
                  <a href="#" style="display:block;text-decoration:none;" target="_blank">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:${C.bit};border-radius:10px;padding:18px 24px;">
                          <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${ltr('Bit')}</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">תשלום מאובטח</div>
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
              <tr>
                <td style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Contact me instead -->
        <tr>
          <td style="padding:24px 32px 32px;text-align:center;">
            <div style="font-size:13px;color:${C.muted};margin-bottom:14px;">מעדיפים שניצור איתכם קשר?</div>
            <a href="${contactMeUrl}" style="display:inline-block;text-decoration:none;border:1px solid ${C.accent};border-radius:8px;padding:12px 28px;color:${C.accent};font-size:14px;font-weight:600;" target="_blank">
              העדפתי שתצרו איתי קשר
            </a>
            <div style="font-size:12px;color:${C.dim};margin-top:10px;">נחזור אליכם תוך 24 שעות</div>
          </td>
        </tr>

      </table>
      <!-- /Main card -->

      <!-- Footer -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <div style="font-size:12px;color:${C.dim};margin-bottom:6px;">
              לשאלות ניתן לפנות אלינו: <a href="mailto:contact@eventa.productions" style="color:${C.accent};text-decoration:none;" dir="ltr">contact@eventa.productions</a>
            </div>
            <div style="font-size:11px;color:#bbb;">&copy; ${ltr(String(new Date().getFullYear()))} ${ltr('Eventa')}</div>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
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

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Main card -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Header -->
        <tr>
          <td style="background-color:${C.text};padding:22px 32px;text-align:center;">
            <div style="font-size:20px;font-weight:700;letter-spacing:3px;color:${C.card};">${ltr('EVENTA')}</div>
          </td>
        </tr>

        <!-- Alert banner -->
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:${C.warnBg};padding:16px 32px;border-bottom:1px solid ${C.border};">
                  <div style="font-size:14px;font-weight:600;color:${C.warn};">לקוח שינה העדפה \u2014 מבקש שניצור קשר</div>
                  <div style="font-size:13px;color:${C.muted};margin-top:4px;">
                    הלקוח קיבל לינק לתשלום אבל בחר לבקש שנחזור אליו.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:24px 32px;">
            <div style="font-size:14px;color:${C.text};line-height:1.7;margin-bottom:20px;">
              <strong>${s.name}</strong> ביקש/ה ליצור קשר טלפוני במקום תשלום אונליין עבור ${s.eventLabel}${s.eventName ? ` (${s.eventName})` : ''}.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#fafaf8;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;width:70px;">שם</td>
                <td style="padding:12px 16px;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;font-weight:600;">${s.name}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}color:${C.muted};font-size:13px;">טלפון</td>
                <td style="padding:12px 16px;${s.email ? `border-bottom:1px solid ${C.border};` : ''}">
                  <a href="tel:${s.phone}" style="color:${C.accent};font-size:15px;font-weight:600;text-decoration:none;" dir="ltr">${s.phone}</a>
                </td>
              </tr>
              ${s.email ? `<tr>
                <td style="padding:12px 16px;color:${C.muted};font-size:13px;">אימייל</td>
                <td style="padding:12px 16px;">
                  <a href="mailto:${s.email}" style="color:${C.accent};font-size:14px;text-decoration:none;" dir="ltr">${s.email}</a>
                </td>
              </tr>` : ''}
            </table>

            <div style="margin-top:16px;font-size:12px;color:${C.dim};">
              מזהה בקשה: ${ltr(escapeHtml(data.requestId))}
            </div>
          </td>
        </tr>

      </table>

      <!-- Footer -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="padding:14px 0;text-align:center;font-size:11px;color:${C.dim};">
            ${ltr('Eventa')} &middot; התראת שינוי העדפה
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
