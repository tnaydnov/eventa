import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/csp-report
 * Receives Content-Security-Policy violation reports from browsers.
 *
 * Browsers send a JSON body with a "csp-report" key when the CSP
 * `report-uri` directive is set. Logged and counted for monitoring.
 *
 * Rate-limited aggressively to prevent log flooding from a malicious
 * page that injects many CSP violations.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 reports per minute per IP (browsers batch reports, so this is generous)
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`csp-report:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

  try {
    const body = await req.json();
    const report = body['csp-report'] ?? body; // browsers send { "csp-report": {...} }

    logger.warn('[CSP_VIOLATION]', {
      documentUri: report['document-uri'],
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      originalPolicy: undefined, // omit — too verbose
      disposition: report['disposition'],
      referrer: report['referrer'],
    });
  } catch {
    // Silently ignore malformed reports — don't leak error details
  }

  // CSP report endpoints must return 2xx; body is ignored by the browser
  return new NextResponse(null, { status: 204 });
}
