import { NextRequest, NextResponse } from 'next/server';
import { adminGuard, jsonError } from '../../_helpers';
import { RATE_LIMITS, isDistributedRateLimitEnabled } from '@/lib/rate-limit';
import { normalizePhone, isValidIsraeliMobile } from '@/lib/messaging';
import { logger } from '@/lib/logger';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * DELETE /api/admin/rate-limit/otp-phone
 *
 * Clears the Upstash Redis per-phone OTP hourly rate-limit key so the phone
 * can immediately send a new OTP. Useful during development when the developer's
 * phone exhausts the hourly cap during testing.
 *
 * Body: { phone: string }  — accepts any format (0501234567, +972501234567, etc.)
 */
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req, 'admin-rate-limit-flush', RATE_LIMITS.strict);
  if (denied) return denied;

  if (!isDistributedRateLimitEnabled()) {
    return NextResponse.json(
      { error: 'Distributed rate limiting (Upstash) is not enabled on this deployment.' },
      { status: 400 }
    );
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const rawPhone = body?.phone;
  if (!rawPhone || typeof rawPhone !== 'string') {
    return jsonError('phone is required', 400);
  }

  const phone = normalizePhone(rawPhone);
  if (!phone || !isValidIsraeliMobile(phone)) {
    return jsonError('Invalid Israeli mobile number', 400);
  }

  const key = `rl:send-otp-phone:${phone}`;

  try {
    const res = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(3_000),
    });

    if (!res.ok) {
      throw new Error(`Upstash DEL failed: HTTP ${res.status}`);
    }

    logger.info('[ADMIN] OTP rate-limit key flushed', { phone: `${phone.slice(0, 6)}***`, key });
    return NextResponse.json({ success: true, key, message: `Rate-limit cleared for ${phone.slice(0, 6)}*** — phone can now send OTP immediately.` });
  } catch (err) {
    logger.error('[ADMIN] Failed to flush OTP rate-limit key', { error: err });
    return jsonError('Failed to clear rate-limit key', 500);
  }
}
