import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { BRAND_NAME, CONTACT_EMAIL } from '@/config/site';

/* ── Email header-injection guard (defense-in-depth) ─────────────────
 * Several emails interpolate user-derived values into header fields - the
 * order form's `contactName` appears in the Subject, and `contactEmail`
 * becomes the `to` address. An RFC 5322 header value must be a single line;
 * a CR/LF smuggled into one of those values could otherwise inject extra
 * headers (e.g. a hidden Bcc). Nodemailer already encodes headers, but we
 * scrub these fields at the single send choke-point below so NO individual
 * call site has to remember to - and so a future caller can't reintroduce
 * the gap. Removing CR/LF from a legitimate subject/address is a no-op, so
 * this never changes what a real recipient sees.
 */

/** Strip CR, LF, NUL and other C0/C1 control chars from a header value. */
export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n\u0000-\u001F\u007F]+/g, ' ').trim();
}

/** Recursively sanitize a Nodemailer address value (string | {name,address} | array). */
function sanitizeAddress(addr: unknown): unknown {
  if (typeof addr === 'string') return sanitizeEmailHeader(addr);
  if (Array.isArray(addr)) return addr.map(sanitizeAddress);
  if (addr && typeof addr === 'object') {
    const a = addr as { name?: string; address?: string };
    return {
      ...a,
      ...(typeof a.name === 'string' ? { name: sanitizeEmailHeader(a.name) } : {}),
      ...(typeof a.address === 'string' ? { address: sanitizeEmailHeader(a.address) } : {}),
    };
  }
  return addr;
}

/** Sanitize every header-bound field of a sendMail options object. */
function sanitizeMailHeaders(options: SendMailOptions): SendMailOptions {
  const out: SendMailOptions = { ...options };
  if (typeof out.subject === 'string') out.subject = sanitizeEmailHeader(out.subject);
  for (const field of ['to', 'from', 'cc', 'bcc', 'replyTo', 'sender'] as const) {
    if (out[field] != null) {
      (out as Record<string, unknown>)[field] = sanitizeAddress(out[field]);
    }
  }
  return out;
}

/**
 * Lazily-initialized singleton nodemailer transporter.
 * Avoids module-scope env-var reads that can break on serverless cold-start
 * when SMTP_* vars are not yet available.
 *
 * The transporter's `sendMail` is wrapped once so that every outbound email -
 * regardless of which route sends it - passes through `sanitizeMailHeaders`.
 */
let _transporter: Transporter | null = null;

export function getMailTransporter(): Transporter {
  if (!_transporter) {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Single choke-point: sanitize header-bound fields on every send.
    // Every caller uses the promise form (`await getMailTransporter().sendMail(...)`),
    // so we wrap that path; the cast satisfies Nodemailer's overloaded signature.
    const originalSendMail = t.sendMail.bind(t);
    t.sendMail = ((mailOptions: SendMailOptions) =>
      originalSendMail(sanitizeMailHeaders(mailOptions))) as Transporter['sendMail'];

    _transporter = t;
  }
  return _transporter;
}

/** Standard "From" header for outbound emails. */
export function getSmtpFrom(): string {
  return `"${BRAND_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
}

/**
 * Mailbox that receives internal operator notifications (new orders, payment
 * confirmations, contact requests). Falls back to the public contact address,
 * then to the SMTP account itself.
 */
export function getAdminNotificationEmail(): string {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    CONTACT_EMAIL ||
    process.env.SMTP_USER ||
    ''
  );
}
