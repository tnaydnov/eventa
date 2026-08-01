import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/messaging';
import { logger } from '@/lib/logger';

/**
 * POST /api/sms/inbound
 * Handles inbound SMS webhooks (STOP / הסר) and stores opt-out numbers.
 * Accepts either JSON or form-url-encoded payloads from providers.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SMS_INBOUND_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const authHash = crypto.createHash('sha256').update(auth).digest();
    const expectedHash = crypto.createHash('sha256').update(`Bearer ${secret}`).digest();
    if (!crypto.timingSafeEqual(authHash, expectedHash)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let payload: Record<string, unknown> = {};
  const contentType = (req.headers.get('content-type') || '').toLowerCase();

  try {
    if (contentType.includes('application/json')) {
      payload = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    return NextResponse.json({ ok: true });
  }

  const rawText = (
    payload.text ?? payload.message ?? payload.body ?? payload.sms ?? ''
  ).toString();
  const rawPhone = (
    payload.from ?? payload.msisdn ?? payload.phone ?? payload.sender ?? ''
  ).toString();

  const text = rawText.trim().toLowerCase();
  const phone = normalizePhone(rawPhone);

  if (!phone || !text) {
    return NextResponse.json({ ok: true });
  }

  const isStop = text === 'stop' || text === 'unsubscribe' || text === 'הסר' || text === 'בטל';
  if (!isStop) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getServiceClient();
  const optedOutAt = new Date().toISOString();
  const { error } = await supabase
    .from('sms_optout')
    .upsert({ phone, opted_out_at: optedOutAt }, { onConflict: 'phone' });

  if (error) {
    logger.error('[SMS_INBOUND] opt-out upsert error:', error.message);
  }

  return NextResponse.json({ ok: true });
}
