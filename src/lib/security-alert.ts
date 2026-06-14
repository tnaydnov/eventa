/**
 * Security alerting — fire-and-forget webhook notifications for critical security events.
 *
 * Configure SECURITY_ALERT_WEBHOOK_URL in env to receive alerts (Slack/Discord/custom).
 * If the env var is not set, alerts are only written to the logger (stdout).
 *
 * Slack webhook format is used by default (also compatible with Discord).
 *
 * All alerts are:
 * - Fire-and-forget (never block the request path)
 * - Deduplicated within a 60-second window (same type + key won't alert twice)
 * - Fail-silently (never throw into the calling code)
 */
import { logger } from '@/lib/logger';

const WEBHOOK_URL = process.env.SECURITY_ALERT_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventa.productions';

/** De-duplication map: `${type}:${key}` → last-alert timestamp */
const recentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000; // 1 minute

export type AlertSeverity = 'critical' | 'high' | 'medium';

export interface SecurityAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
  /** De-dup key — same type+key won't alert again within DEDUP_WINDOW_MS */
  dedupKey?: string;
  details?: Record<string, unknown>;
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: '🚨',
  high: '⚠️',
  medium: '📢',
};

/**
 * Send a security alert.
 * Non-blocking — returns immediately, fires webhook in the background.
 */
export function securityAlert(alert: SecurityAlert): void {
  const key = `${alert.type}:${alert.dedupKey ?? ''}`;
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return; // de-dup
  recentAlerts.set(key, Date.now());

  // Always log
  logger.warn(`[SECURITY_ALERT] ${alert.type}`, { severity: alert.severity, message: alert.message, ...alert.details });

  // Fire webhook if configured
  if (WEBHOOK_URL) {
    void sendWebhook(alert).catch(() => {/* swallow */});
  }
}

async function sendWebhook(alert: SecurityAlert): Promise<void> {
  const emoji = SEVERITY_EMOJI[alert.severity];
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

  // Slack/Discord compatible payload
  const payload = {
    text: `${emoji} *[${alert.severity.toUpperCase()}] ${alert.type}*\n${alert.message}`,
    attachments: [
      {
        color: alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : '#439FE0',
        fields: [
          { title: 'App', value: APP_URL, short: true },
          { title: 'Time (IL)', value: now, short: true },
          ...Object.entries(alert.details ?? {}).map(([title, value]) => ({
            title,
            value: String(value),
            short: true,
          })),
        ],
      },
    ],
  };

  await fetch(WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  });
}

// ─── Pre-built alert helpers ──────────────────────────────────────────────────

/** OTP rate limit spike — either per-phone or per-IP. */
export function alertOtpRateLimit(key: string, type: 'phone' | 'ip' | 'global'): void {
  securityAlert({
    type: 'OTP_RATE_LIMIT',
    severity: type === 'global' ? 'critical' : 'high',
    message: `OTP rate limit hit (${type}): ${key}`,
    dedupKey: `${type}:${key}`,
    details: { limitType: type, key },
  });
}

/** Multiple failed admin login attempts. */
export function alertAdminLoginFailures(ip: string, count: number): void {
  securityAlert({
    type: 'ADMIN_LOGIN_FAILURES',
    severity: count >= 5 ? 'critical' : 'high',
    message: `${count} failed admin login attempts from IP ${ip}`,
    dedupKey: ip,
    details: { ip, count },
  });
}

/** Admin TOTP verification failures. */
export function alertAdminTotpFailures(ip: string, count: number): void {
  securityAlert({
    type: 'ADMIN_TOTP_FAILURES',
    severity: 'high',
    message: `${count} failed TOTP attempts from IP ${ip}`,
    dedupKey: ip,
    details: { ip, count },
  });
}

/** AI moderation hard-blocked a CSAM image. */
export function alertCsamDetected(participantId: string, eventId: string, storagePath: string): void {
  securityAlert({
    type: 'CSAM_DETECTED',
    severity: 'critical',
    message: `CSAM hard-block: participant ${participantId} in event ${eventId}`,
    dedupKey: storagePath,
    details: { participantId, eventId, storagePath },
  });
}

/** Server-side magic bytes check rejected an upload. */
export function alertInvalidFileUpload(participantId: string, storagePath: string, reason: string): void {
  securityAlert({
    type: 'INVALID_FILE_UPLOAD',
    severity: 'medium',
    message: `Invalid file upload rejected for participant ${participantId}`,
    dedupKey: `${participantId}:${storagePath}`,
    details: { participantId, storagePath, reason },
  });
}

/** A cron job failed or was skipped. */
export function alertCronFailure(cronName: string, error: string): void {
  securityAlert({
    type: 'CRON_FAILURE',
    severity: 'high',
    message: `Cron "${cronName}" failed: ${error}`,
    dedupKey: cronName,
    details: { cronName, error },
  });
}

/** Rate limit spike on a participant endpoint. */
export function alertRateLimitSpike(route: string, ip: string): void {
  securityAlert({
    type: 'RATE_LIMIT_SPIKE',
    severity: 'medium',
    message: `Rate limit spike on ${route} from IP ${ip}`,
    dedupKey: `${route}:${ip}`,
    details: { route, ip },
  });
}
