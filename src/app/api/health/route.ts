import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/** Cached health response to avoid DB abuse (TTL 5 seconds). */
let cachedResult: { json: object; status: number; ts: number } | null = null;
const CACHE_TTL_MS = 5_000;

/**
 * GET /api/health
 * Lightweight health check - verifies the app is running and Supabase is reachable.
 * Used by monitoring, load balancers, and uptime checks.
 * Rate-limited and response-cached to prevent DB amplification abuse.
 */
export async function GET(req: NextRequest) {
  // Rate limit per IP - 20 requests per 60 seconds
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`health:${ip}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Serve from cache if fresh
  if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL_MS) {
    return NextResponse.json(cachedResult.json, { status: cachedResult.status });
  }

  const start = Date.now();

  try {
    // Lightweight DB ping - count(events) is a trivial query
    const supabase = getServiceClient();
    const { error } = await supabase.from('events').select('id', { count: 'exact', head: true });

    if (error) {
      logger.warn('[HEALTH] DB unreachable', { error: error.message });
      const json = { status: 'degraded', error: 'Database unreachable', latency: Date.now() - start };
      cachedResult = { json, status: 503, ts: Date.now() };
      return NextResponse.json(json, { status: 503 });
    }

    const json = {
      status: 'ok',
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
    cachedResult = { json, status: 200, ts: Date.now() };
    return NextResponse.json(json);
  } catch (err) {
    logger.error('[HEALTH] unexpected error', { error: err instanceof Error ? err.message : String(err) });
    const json = { status: 'error', error: 'Health check failed', latency: Date.now() - start };
    cachedResult = { json, status: 503, ts: Date.now() };
    return NextResponse.json(json, { status: 503 });
  }
}
