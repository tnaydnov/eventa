import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { z } from 'zod';

const errorSchema = z.object({
  message: z.string().max(500),
  stack: z.string().max(2000).optional(),
  componentStack: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
  event_id: z.string().uuid().optional(),
});

/**
 * POST /api/telemetry/error
 * Receives client-side errors from ErrorBoundary and window.onerror.
 * Rate-limited aggressively to prevent log flooding.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = checkRateLimit(`tel:error:${ip}`, { windowMs: 60_000, maxRequests: 10 });
  if (!allowed) {
    return NextResponse.json({ ok: true }); // Silently drop excess
  }

  try {
    const body = await req.json();
    const parsed = errorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    const { message, stack, url, event_id } = parsed.data;
    logger.error(`[CLIENT_ERROR] ${message}`, { stack, url, event_id });

    const supabase = getServiceClient();
    await supabase.from('event_errors').insert({
      event_id: event_id ?? null,
      message,
      stack: stack ?? null,
      url: url ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
