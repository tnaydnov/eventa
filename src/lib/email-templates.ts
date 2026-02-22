/**
 * Email templates for the order system.
 * Professional HTML email designs matching the Eventa brand.
 */

import { EVENT_TYPE_LABELS } from '@/lib/constants';

/** Escape HTML special characters to prevent injection in email template. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format ISO datetime to a readable Hebrew string. */
function formatDateHebrew(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
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
    startsAt: formatDateHebrew(data.startsAt),
    endsAt: formatDateHebrew(data.endsAt),
    template: escapeHtml(data.selectedTemplate),
    specialReqs: escapeHtml(data.specialRequests),
  };

  const contactPrefLabel = data.contactPreference === 'call-me'
    ? 'צרו איתי קשר'
    : 'שלחו לינק לתשלום';

  const subject = `בקשה חדשה — ${s.eventLabel} | ${s.name}`;

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    
    <!-- Header -->
    <div style="text-align:center;padding:32px 24px 24px;border-radius:16px 16px 0 0;background:linear-gradient(135deg,#1a1216 0%,#0d0a0b 100%);border-bottom:2px solid rgba(212,165,154,0.3);">
      <div style="font-size:28px;font-weight:700;color:#d4a59a;letter-spacing:1px;margin-bottom:4px;">EVENTA</div>
      <div style="font-size:13px;color:#b0b0b0;letter-spacing:2px;text-transform:uppercase;">בקשת אירוע חדשה</div>
    </div>

    <!-- Body -->
    <div style="background:#141414;padding:28px 24px;border-radius:0 0 16px 16px;">
      
      <!-- Priority Banner -->
      <div style="background:linear-gradient(90deg,rgba(212,165,154,0.12),rgba(212,165,154,0.04));border-right:3px solid #d4a59a;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:600;color:#e8c4bb;margin-bottom:4px;">
          ${data.contactPreference === 'send-link' ? '⚡ רוצה לינק לתשלום מיידי' : '📞 מבקש שנחזור אליו'}
        </div>
        <div style="font-size:13px;color:#b0b0b0;">
          ${data.contactPreference === 'send-link' ? 'נשלח ללקוח אימייל עם כפתורי תשלום' : 'יש לחזור ללקוח תוך 24 שעות'}
        </div>
      </div>

      <!-- Event Info Section -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d4a59a;margin-bottom:12px;font-weight:600;">פרטי האירוע</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;width:120px;vertical-align:top;">סוג</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;font-weight:500;">${s.eventLabel}</td>
          </tr>
          ${s.eventName ? `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;vertical-align:top;">שם</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;font-weight:500;">${s.eventName}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;vertical-align:top;">התחלה</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;">${s.startsAt}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;vertical-align:top;">סיום</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;">${s.endsAt}</td>
          </tr>
        </table>
      </div>

      <!-- Options Section -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d4a59a;margin-bottom:12px;font-weight:600;">אפשרויות שנבחרו</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;width:120px;">רקע</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;">
              ${data.wantsCustomBackground ? `<span style="color:#22c55e;">✓</span> רקע מותאם${data.hasBgImage ? ' (תמונה מצורפת)' : ''}` : '<span style="color:#888;">ברירת מחדל</span>'}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;">פוסטר</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;">
              ${data.posterChoice === 'qr-only' ? 'QR בלבד' : `תבנית: ${s.template}`}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;">הודעות</td>
            <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f0ede8;font-size:14px;">
              ${data.wantsGuestMessages ? '<span style="color:#22c55e;">✓</span> כן, שלחו הודעות' : '<span style="color:#888;">לא</span>'}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;color:#888;font-size:13px;">העדפת קשר</td>
            <td style="padding:10px 12px;color:#f0ede8;font-size:14px;">${contactPrefLabel}</td>
          </tr>
        </table>
      </div>

      ${s.specialReqs ? `
      <!-- Special Requests -->
      <div style="background:#1a1a1a;border-radius:10px;padding:14px 16px;margin-bottom:20px;border:1px solid #222;">
        <div style="font-size:12px;color:#d4a59a;margin-bottom:6px;font-weight:600;">בקשות מיוחדות</div>
        <div style="font-size:14px;color:#e0e0e0;line-height:1.6;">${s.specialReqs}</div>
      </div>` : ''}

      <!-- Contact Section -->
      <div style="background:linear-gradient(135deg,rgba(212,165,154,0.08),rgba(212,165,154,0.02));border-radius:12px;padding:18px 20px;border:1px solid rgba(212,165,154,0.15);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d4a59a;margin-bottom:12px;font-weight:600;">פרטי הלקוח</div>
        <div style="margin-bottom:8px;">
          <span style="color:#888;font-size:13px;">שם: </span>
          <span style="color:#f0ede8;font-size:15px;font-weight:600;">${s.name}</span>
        </div>
        <div style="margin-bottom:8px;">
          <span style="color:#888;font-size:13px;">טלפון: </span>
          <a href="tel:${s.phone}" style="color:#d4a59a;font-size:15px;font-weight:600;text-decoration:none;">${s.phone}</a>
        </div>
        ${s.email ? `
        <div>
          <span style="color:#888;font-size:13px;">אימייל: </span>
          <a href="mailto:${s.email}" style="color:#d4a59a;font-size:14px;text-decoration:none;">${s.email}</a>
        </div>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px;font-size:11px;color:#555;">
      Eventa — בקשה מהוויזארד באתר · ${new Date().toLocaleDateString('he-IL')}
    </div>
  </div>
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

  const subject = `Eventa — פרטי תשלום עבור ${safeEventLabel}${safeEventName ? ` | ${safeEventName}` : ''}`;

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <!-- Header with gradient -->
    <div style="text-align:center;padding:40px 24px 32px;border-radius:20px 20px 0 0;background:linear-gradient(160deg,#1a1216 0%,#0f0c0d 50%,#0a0a0a 100%);position:relative;overflow:hidden;">
      <!-- Decorative circles -->
      <div style="position:absolute;top:-30px;left:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(212,165,154,0.08),transparent);"></div>
      <div style="position:absolute;bottom:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(201,165,128,0.06),transparent);"></div>
      
      <div style="font-size:32px;font-weight:700;color:#d4a59a;letter-spacing:2px;margin-bottom:8px;">EVENTA</div>
      <div style="width:40px;height:2px;background:linear-gradient(90deg,transparent,#d4a59a,transparent);margin:0 auto 16px;"></div>
      <div style="font-size:16px;color:#f0ede8;font-weight:500;margin-bottom:4px;">היי ${safeName}! 👋</div>
      <div style="font-size:14px;color:#b0b0b0;">תודה שבחרת ב-Eventa לאירוע שלך</div>
    </div>

    <!-- Body -->
    <div style="background:#111;padding:0;border-radius:0 0 20px 20px;overflow:hidden;">
      
      <!-- Event Summary strip -->
      <div style="background:#161616;padding:18px 24px;border-bottom:1px solid #222;display:flex;justify-content:space-between;">
        <table style="width:100%;">
          <tr>
            <td style="text-align:right;">
              <div style="font-size:12px;color:#888;margin-bottom:2px;">האירוע שלך</div>
              <div style="font-size:16px;color:#f0ede8;font-weight:600;">${safeEventLabel}${safeEventName ? ` — ${safeEventName}` : ''}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment Section -->
      <div style="padding:28px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:18px;font-weight:600;color:#f0ede8;margin-bottom:6px;">בחרו את אמצעי התשלום</div>
          <div style="font-size:13px;color:#888;">לחצו על הכפתור המועדף ותועברו לאפליקציה</div>
        </div>

        <!-- PayBox Button -->
        <a href="#" style="display:block;text-decoration:none;margin-bottom:12px;">
          <div style="background:linear-gradient(135deg,#0066cc,#0052a3);border-radius:14px;padding:18px 24px;text-align:center;transition:all 0.3s;">
            <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px;">PayBox</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);">תשלום מאובטח דרך PayBox</div>
          </div>
        </a>

        <!-- Bit Button -->
        <a href="#" style="display:block;text-decoration:none;margin-bottom:12px;">
          <div style="background:linear-gradient(135deg,#2bc157,#1fa34a);border-radius:14px;padding:18px 24px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px;">Bit</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);">תשלום מאובטח דרך Bit</div>
          </div>
        </a>

        <!-- Divider -->
        <div style="display:flex;align-items:center;gap:12px;margin:24px 0;">
          <div style="flex:1;height:1px;background:#222;"></div>
          <div style="font-size:12px;color:#555;white-space:nowrap;">או שנתקשר אליך?</div>
          <div style="flex:1;height:1px;background:#222;"></div>
        </div>

        <!-- Contact Me Instead Button -->
        <a href="${contactMeUrl}" style="display:block;text-decoration:none;">
          <div style="border:1px solid rgba(212,165,154,0.25);border-radius:14px;padding:16px 24px;text-align:center;background:rgba(212,165,154,0.04);">
            <div style="font-size:15px;font-weight:600;color:#d4a59a;margin-bottom:2px;">העדפתי שתצרו איתי קשר</div>
            <div style="font-size:12px;color:#888;">נחזור אליכם תוך 24 שעות</div>
          </div>
        </a>
      </div>

      <!-- Trust Section -->
      <div style="background:#0d0d0d;padding:20px 24px;border-top:1px solid #1a1a1a;">
        <table style="width:100%;">
          <tr>
            <td style="text-align:center;padding:0 8px;">
              <div style="font-size:18px;margin-bottom:4px;">🔒</div>
              <div style="font-size:11px;color:#666;">תשלום מאובטח</div>
            </td>
            <td style="text-align:center;padding:0 8px;">
              <div style="font-size:18px;margin-bottom:4px;">⚡</div>
              <div style="font-size:11px;color:#666;">הפעלה מיידית</div>
            </td>
            <td style="text-align:center;padding:0 8px;">
              <div style="font-size:18px;margin-bottom:4px;">💎</div>
              <div style="font-size:11px;color:#666;">חוויה פרימיום</div>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 16px;">
      <div style="font-size:11px;color:#444;margin-bottom:8px;">
        אימייל זה נשלח אוטומטית מ-Eventa. לשאלות: <a href="mailto:contact@eventa.productions" style="color:#d4a59a;text-decoration:none;">contact@eventa.productions</a>
      </div>
      <div style="font-size:10px;color:#333;">© ${new Date().getFullYear()} Eventa</div>
    </div>
  </div>
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

  const subject = `🔔 לקוח מבקש שנחזור אליו — ${s.name}`;

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:28px 24px;border-radius:16px 16px 0 0;background:linear-gradient(135deg,#1a1216 0%,#0d0a0b 100%);border-bottom:2px solid rgba(212,165,154,0.3);">
      <div style="font-size:24px;font-weight:700;color:#d4a59a;letter-spacing:1px;margin-bottom:8px;">EVENTA</div>
      <div style="font-size:14px;color:#f59e0b;font-weight:600;">⚠️ לקוח שינה דעתו — רוצה שנתקשר</div>
    </div>

    <!-- Body -->
    <div style="background:#141414;padding:24px;border-radius:0 0 16px 16px;">
      <div style="background:rgba(245,158,11,0.08);border-right:3px solid #f59e0b;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:14px;color:#f0ede8;">
          הלקוח <strong>${s.name}</strong> קיבל לינק לתשלום עבור <strong>${s.eventLabel}</strong>${s.eventName ? ` (${s.eventName})` : ''} אבל לחץ על "העדפתי שתצרו איתי קשר".
        </div>
      </div>

      <div style="background:#1a1a1a;border-radius:10px;padding:16px 18px;border:1px solid #222;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d4a59a;margin-bottom:12px;font-weight:600;">פרטי קשר</div>
        <div style="margin-bottom:8px;">
          <span style="color:#888;">שם: </span>
          <span style="color:#f0ede8;font-weight:600;">${s.name}</span>
        </div>
        <div style="margin-bottom:8px;">
          <span style="color:#888;">טלפון: </span>
          <a href="tel:${s.phone}" style="color:#d4a59a;font-weight:600;text-decoration:none;">${s.phone}</a>
        </div>
        ${s.email ? `
        <div>
          <span style="color:#888;">אימייל: </span>
          <a href="mailto:${s.email}" style="color:#d4a59a;text-decoration:none;">${s.email}</a>
        </div>` : ''}
      </div>

      <div style="margin-top:16px;font-size:12px;color:#666;text-align:center;">
        מזהה בקשה: ${escapeHtml(data.requestId)}
      </div>
    </div>

    <div style="text-align:center;padding:12px;font-size:11px;color:#444;">
      Eventa — התראת שינוי העדפה
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
