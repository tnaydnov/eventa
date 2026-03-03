/**
 * Preview all email templates - generates HTML files you can open in a browser.
 *
 * Usage:
 *   npx tsx scripts/preview-emails.ts
 *
 * Output:
 *   Creates .html files in  scripts/email-previews/  folder.
 *   Also creates an index.html with links to every template.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  buildClientCallMeBackEmail,
  buildClientPayNowEmail,
  buildClientContactOnlyEmail,
  buildClientApprovalEmail,
  buildClientUploadReminder7DayEmail,
  buildClientUploadReminder3DayEmail,
  buildClientEventSummaryEmail,
  buildClientQrPageEmail,
  buildAdminPayNowNotification,
  buildAdminCallMeBackNotification,
  buildAdminContactOnlyNotification,
} from '../src/lib/email-templates';

/* ── Shared sample data ── */

const SAMPLE_EVENT = {
  eventType: 'wedding',
  eventName: 'החתונה של דנה ויובל',
  startsAt: '2026-04-15T19:00:00.000Z',
  endsAt: '2026-04-16T01:00:00.000Z',
  wantsCustomBackground: true,
  hasBgImage: true,
  posterChoice: 'design-A',
  selectedTemplate: 'wedding/classic',
  specialRequests: 'נשמח לעיצוב בטונים ורודים ולבנים',
  wantsGuestMessages: true,
};

const SAMPLE_CONTACT = {
  contactName: 'דנה כהן',
  contactPhone: '054-1234567',
  contactEmail: 'dana@example.com',
};

/* ── Build each template ── */

const templates: Array<{ name: string; label: string; type: 'client' | 'admin'; subject: string; html: string }> = [];

// C1. Client - Call Me Back
{
  const { subject, html } = buildClientCallMeBackEmail({
    ...SAMPLE_EVENT,
    contactName: SAMPLE_CONTACT.contactName,
  });
  templates.push({ name: 'C1-client-call-me-back', label: 'C1. לקוח - מבקש שנחזור', type: 'client', subject, html });
}

// C2. Client - Pay Now
{
  const { subject, html } = buildClientPayNowEmail({
    ...SAMPLE_EVENT,
    contactName: SAMPLE_CONTACT.contactName,
  });
  templates.push({ name: 'C2-client-pay-now', label: 'C2. לקוח - שילם באתר', type: 'client', subject, html });
}

// C3. Client - Contact Only
{
  const { subject, html } = buildClientContactOnlyEmail({
    contactName: 'דנה כהן',
    contactPhone: '054-1234567',
    contactEmail: 'dana@example.com',
  });
  templates.push({ name: 'C3-client-contact-only', label: 'C3. לקוח - יצירת קשר בלבד', type: 'client', subject, html });
}

// C4. Client - Approval (with WhatsApp)
{
  const { subject, html } = buildClientApprovalEmail({
    ...SAMPLE_EVENT,
    contactName: SAMPLE_CONTACT.contactName,
    totalPriceShekel: 300,
    paymentMethod: 'כרטיס אשראי',
    eventUrl: 'https://www.eventa.productions/e/dana-yuval-wedding',
    portalUrl: 'https://www.eventa.productions/guest-upload/abc123',
    messageSendAt: '2026-04-15T16:00:00.000Z',
    uploadDeadline: '2026-04-14T23:59:00.000Z',
  });
  templates.push({ name: 'C4-client-approval-wa', label: 'C4. לקוח - אישור הזמנה (עם WhatsApp)', type: 'client', subject, html });
}

// C4b. Client - Approval (without WhatsApp)
{
  const { subject, html } = buildClientApprovalEmail({
    ...SAMPLE_EVENT,
    wantsGuestMessages: false,
    contactName: SAMPLE_CONTACT.contactName,
    totalPriceShekel: 250,
    paymentMethod: 'כרטיס אשראי',
    eventUrl: 'https://www.eventa.productions/e/dana-yuval-wedding',
  });
  templates.push({ name: 'C4b-client-approval-no-wa', label: 'C4b. לקוח - אישור הזמנה (בלי WhatsApp)', type: 'client', subject, html });
}

// C5. Client - Upload Reminder 7 Day
{
  const { subject, html } = buildClientUploadReminder7DayEmail({
    contactName: 'דנה כהן',
    eventName: 'החתונה של דנה ויובל',
    daysLeft: 7,
    uploadUrl: 'https://www.eventa.productions/guest-upload/abc123',
    messageSendAt: '2026-04-15T16:00:00.000Z',
    uploadDeadline: '2026-04-14T23:59:00.000Z',
  });
  templates.push({ name: 'C5-client-reminder-7day', label: 'C5. לקוח - תזכורת 7 ימים', type: 'client', subject, html });
}

// C6. Client - Upload Reminder 3 Day
{
  const { subject, html } = buildClientUploadReminder3DayEmail({
    contactName: 'דנה כהן',
    eventName: 'החתונה של דנה ויובל',
    uploadUrl: 'https://www.eventa.productions/guest-upload/abc123',
    messageSendAt: '2026-04-15T16:00:00.000Z',
    uploadDeadline: '2026-04-14T23:59:00.000Z',
  });
  templates.push({ name: 'C6-client-reminder-3day', label: 'C6. לקוח - תזכורת 3 ימים', type: 'client', subject, html });
}

// C7. Client - Event Summary
{
  const { subject, html } = buildClientEventSummaryEmail({
    contactName: 'דנה כהן',
    eventName: 'החתונה של דנה ויובל',
    eventDate: '15 באפריל 2026',
    stats: {
      totalParticipants: 187,
      men: 94,
      women: 93,
      totalMatches: 23,
      totalConversations: 156,
    },
  });
  templates.push({ name: 'C7-client-event-summary', label: 'C7. לקוח - סיכום אירוע', type: 'client', subject, html });
}

// C8. Client - QR Page Ready
{
  const { subject, html } = buildClientQrPageEmail({
    contactName: 'דנה כהן',
    eventName: 'החתונה של דנה ויובל',
  });
  templates.push({ name: 'C8-client-qr-page', label: 'C8. לקוח - דף QR מוכן', type: 'client', subject, html });
}

// A1. Admin - Pay Now
{
  const { subject, html } = buildAdminPayNowNotification({
    ...SAMPLE_EVENT,
    ...SAMPLE_CONTACT,
    requestId: 'req_abc123',
  });
  templates.push({ name: 'A1-admin-pay-now', label: 'A1. אדמין - תשלום באתר', type: 'admin', subject, html });
}

// A2. Admin - Call Me Back
{
  const { subject, html } = buildAdminCallMeBackNotification({
    ...SAMPLE_EVENT,
    ...SAMPLE_CONTACT,
    requestId: 'req_def456',
  });
  templates.push({ name: 'A2-admin-call-me-back', label: 'A2. אדמין - מבקש שנחזור', type: 'admin', subject, html });
}

// A3. Admin - Contact Only
{
  const { subject, html } = buildAdminContactOnlyNotification({
    contactName: 'דנה כהן',
    contactPhone: '054-1234567',
    contactEmail: 'dana@example.com',
    message: 'שלום, אני מתעניינת באירוע חתונה בסביבות מאי. אשמח לשמוע פרטים.',
  });
  templates.push({ name: 'A3-admin-contact-only', label: 'A3. אדמין - יצירת קשר בלבד', type: 'admin', subject, html });
}

// A3b. Admin - Contact Only (no message)
{
  const { subject, html } = buildAdminContactOnlyNotification({
    contactName: 'דנה כהן',
    contactPhone: '054-1234567',
  });
  templates.push({ name: 'A3b-admin-contact-only-no-msg', label: 'A3b. אדמין - יצירת קשר (ללא הודעה)', type: 'admin', subject, html });
}

/* ── Write files ── */

const outDir = path.join(__dirname, 'email-previews');
fs.mkdirSync(outDir, { recursive: true });

for (const t of templates) {
  const filePath = path.join(outDir, `${t.name}.html`);
  fs.writeFileSync(filePath, t.html, 'utf-8');
  console.log(`  ✔ ${t.name}.html`);
}

// Count types
const clientCount = templates.filter(t => t.type === 'client').length;
const adminCount = templates.filter(t => t.type === 'admin').length;

// Index page
const indexHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Eventa - Email Template Previews</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f3f0; padding: 40px 20px; color: #1e1e1e; }
    h1 { text-align: center; margin-bottom: 8px; font-size: 28px; }
    .subtitle { text-align: center; color: #6b6b6b; margin-bottom: 32px; font-size: 15px; }
    h2 { font-size: 20px; color: #b08d7e; margin: 32px 0 16px; padding-right: 12px; border-right: 3px solid #b08d7e; max-width: 1100px; margin-left: auto; margin-right: auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto 40px; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; transition: transform .15s; }
    .card:hover { transform: translateY(-3px); box-shadow: 0 4px 16px rgba(0,0,0,.12); }
    .card a { display: block; text-decoration: none; color: inherit; }
    .card .num { background: #b08d7e; color: #fff; display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; }
    .card .num.admin { background: #6b6b6b; }
    .card .body { padding: 20px; }
    .card .name { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
    .card .subject { font-size: 12px; color: #6b6b6b; direction: rtl; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card iframe { width: 100%; height: 280px; border: none; pointer-events: none; }
  </style>
</head>
<body>
  <h1>Eventa - Email Templates</h1>
  <div class="subtitle">${clientCount} מיילים ללקוח &bull; ${adminCount} מיילים לאדמין &bull; ${templates.length} סה"כ</div>

  <h2>מיילים ללקוח (${clientCount})</h2>
  <div class="grid">
    ${templates.filter(t => t.type === 'client').map((t) => `
    <div class="card">
      <a href="${t.name}.html" target="_blank">
        <iframe src="${t.name}.html" loading="lazy"></iframe>
        <div class="body">
          <span class="num">${t.name.split('-')[0]}</span>
          <div class="name">${t.label}</div>
          <div class="subject">${t.subject}</div>
        </div>
      </a>
    </div>`).join('\n')}
  </div>

  <h2>מיילים לאדמין (${adminCount})</h2>
  <div class="grid">
    ${templates.filter(t => t.type === 'admin').map((t) => `
    <div class="card">
      <a href="${t.name}.html" target="_blank">
        <iframe src="${t.name}.html" loading="lazy"></iframe>
        <div class="body">
          <span class="num admin">${t.name.split('-')[0]}</span>
          <div class="name">${t.label}</div>
          <div class="subject">${t.subject}</div>
        </div>
      </a>
    </div>`).join('\n')}
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml, 'utf-8');
console.log(`\n  ✔ index.html  (gallery: ${clientCount} client + ${adminCount} admin = ${templates.length} total)\n`);
console.log(`Open in browser:  ${path.join(outDir, 'index.html')}`);
