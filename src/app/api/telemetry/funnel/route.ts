import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const funnelSchema = z.object({
  event_id: z.string().uuid(),
  session_id: z.string().max(128).optional(),
  step: z.enum([
    'qr_scan', 'join_page_view', 'otp_requested', 'otp_verified',
    'setup_started', 'profile_complete', 'like_sent', 'match_created', 'message_sent', 'conversation_opened',
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/telemetry/funnel
 * Lightweight endpoint for client-side funnel event reporting.
 * Rate-limited per IP; no auth required (public funnel steps like qr_scan, join_page_view).
 */
export async function POST(req: NextRequest) {
  // Rate limit: 60 funnel events per minute per IP
  const ip = getClientIp(req.headers);
  const { allowed } = checkRateLimit(`tel:funnel:${ip}`, { windowMs: 60_000, maxRequests: 60 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = funnelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { event_id, session_id, step, metadata } = parsed.data;

    const supabase = getServiceClient();
    const { error } = await supabase.from('funnel_events').insert({
      event_id,
      session_id: session_id ?? null,
      step,
      metadata: metadata ?? {},
    });

    if (error) {
      logger.error('[TELEMETRY_FUNNEL] insert error:', error.message);
      // Return 200 anyway - analytics failures must not break client flows
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[TELEMETRY_FUNNEL] unexpected error:', err);
    return NextResponse.json({ ok: true }); // Always succeed to client
  }
}
