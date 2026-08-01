import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { z } from 'zod';

const vitalsSchema = z.object({
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().optional(),
  url: z.string().max(500).optional(),
  event_id: z.string().uuid().optional(),
});

/**
 * POST /api/telemetry/vitals
 * Receives Web Vitals metrics from the client and persists them to event_vitals.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = checkRateLimit(`tel:vitals:${ip}`, { windowMs: 60_000, maxRequests: 30 });
  if (!allowed) {
    return NextResponse.json({ ok: true }); // Silently drop excess
  }

  try {
    const body = await req.json();
    const parsed = vitalsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    const { name, value, rating, url, event_id } = parsed.data;
    logger.info(`[VITALS] ${name}=${value.toFixed(1)} rating=${rating ?? 'unknown'}`);

    const supabase = getServiceClient();
    await supabase.from('event_vitals').insert({
      event_id: event_id ?? null,
      metric_name: name,
      value,
      rating: rating ?? null,
      url: url ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
