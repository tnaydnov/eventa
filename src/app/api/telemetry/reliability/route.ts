import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { z } from 'zod';

const reliabilitySchema = z.object({
  metricType: z.enum([
    'realtime_disconnect',
    'realtime_recovered',
    'notification_delivery',
    'api_request',
    'api_error',
  ]),
  event_id: z.string().uuid().optional(),
  source: z.enum(['ws', 'poll', 'unknown']).optional(),
  value: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/telemetry/reliability
 * Captures runtime reliability events and delivery-path attribution.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = checkRateLimit(`tel:reliability:${ip}`, { windowMs: 60_000, maxRequests: 60 });
  if (!allowed) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await req.json();
    const parsed = reliabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getServiceClient();
    const { metricType, event_id, source, value, metadata } = parsed.data;

    const { error } = await supabase.from('event_reliability_metrics').insert({
      event_id: event_id ?? null,
      metric_type: metricType,
      source: source ?? null,
      value: typeof value === 'number' ? value : null,
      metadata: metadata ?? null,
    });

    if (error) {
      logger.error('[TELEMETRY_RELIABILITY] insert error:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
