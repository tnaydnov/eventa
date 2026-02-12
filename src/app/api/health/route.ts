import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/**
 * GET /api/health
 * Lightweight health check — verifies the app is running and Supabase is reachable.
 * Used by monitoring, load balancers, and uptime checks.
 */
export async function GET() {
  const start = Date.now();

  try {
    // Lightweight DB ping — count(events) is a trivial query
    const supabase = getServiceClient();
    const { error } = await supabase.from('events').select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        { status: 'degraded', error: 'Database unreachable', latency: Date.now() - start },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Health check failed', latency: Date.now() - start },
      { status: 503 },
    );
  }
}
