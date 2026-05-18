import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { RELIABILITY_ALERT_THRESHOLDS } from '@/lib/reliability-thresholds';

const METRIC_NAMES = ['LCP', 'FCP', 'CLS', 'INP', 'TTFB', 'FID'] as const;

/** Compute the value at a given percentile from a sorted array. */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(sorted.length * pct) - 1);
  return Math.round((sorted[idx] ?? 0) * 10) / 10;
}

/**
 * GET /api/admin/reliability
 * Returns the last 7 days of Web Vitals aggregates (p50/p75/p95 per metric)
 * and client error counts per day - for the admin Reliability tab.
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-reliability', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const supabase = getServiceClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [vitalsRes, errorsRes, reliabilityRes, pendingSmsRes] = await Promise.all([
      supabase
        .from('event_vitals')
        .select('metric_name, value, rating')
        .gte('created_at', since)
        .limit(20000),
      supabase
        .from('event_errors')
        .select('created_at')
        .gte('created_at', since)
        .limit(10000),
      supabase
        .from('event_reliability_metrics')
        .select('metric_type, source, created_at, metadata')
        .gte('created_at', since)
        .limit(30000),
      supabase
        .from('pending_sms')
        .select('message_type, attempts')
        .is('sent_at', null)
        .is('cancelled_at', null)
        .limit(10000),
    ]);

    if (vitalsRes.error) {
      logger.error('[RELIABILITY] vitals query error:', vitalsRes.error.message);
    }
    if (errorsRes.error) {
      logger.error('[RELIABILITY] errors query error:', errorsRes.error.message);
    }
    if (reliabilityRes.error) {
      logger.error('[RELIABILITY] runtime query error:', reliabilityRes.error.message);
    }
    if (pendingSmsRes.error) {
      logger.error('[RELIABILITY] pending sms query error:', pendingSmsRes.error.message);
    }

    // Aggregate vitals per metric name
    const metricMap: Record<
      string,
      { values: number[]; good: number; ni: number; poor: number }
    > = {};

    for (const v of vitalsRes.data ?? []) {
      if (!metricMap[v.metric_name]) {
        metricMap[v.metric_name] = { values: [], good: 0, ni: 0, poor: 0 };
      }
      metricMap[v.metric_name].values.push(v.value as number);
      if (v.rating === 'good') metricMap[v.metric_name].good++;
      else if (v.rating === 'needs-improvement') metricMap[v.metric_name].ni++;
      else if (v.rating === 'poor') metricMap[v.metric_name].poor++;
    }

    const vitals = METRIC_NAMES.filter((name) => metricMap[name]).map((name) => {
      const data = metricMap[name];
      const sorted = [...data.values].sort((a, b) => a - b);
      const total = sorted.length;
      return {
        name,
        count: total,
        p50: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
        p95: percentile(sorted, 0.95),
        good: data.good,
        needsImprovement: data.ni,
        poor: data.poor,
      };
    });

    // Error counts grouped by day
    const errorsByDay: Record<string, number> = {};
    for (const e of errorsRes.data ?? []) {
      const day = (e.created_at as string).substring(0, 10);
      errorsByDay[day] = (errorsByDay[day] || 0) + 1;
    }

    const errorCounts = Object.entries(errorsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const totalErrors = (errorsRes.data ?? []).length;
    const totalVitals = (vitalsRes.data ?? []).length;

    const reliabilityRows = reliabilityRes.data ?? [];
    const disconnects = reliabilityRows.filter((r) => r.metric_type === 'realtime_disconnect').length;
    const recoveries = reliabilityRows.filter((r) => r.metric_type === 'realtime_recovered').length;
    const deliveryRows = reliabilityRows.filter((r) => r.metric_type === 'notification_delivery');
    const wsDeliveries = deliveryRows.filter((r) => r.source === 'ws').length;
    const pollDeliveries = deliveryRows.filter((r) => r.source === 'poll').length;
    const deliveryTotal = wsDeliveries + pollDeliveries;
    const pollingSharePct = deliveryTotal > 0
      ? Math.round((pollDeliveries / deliveryTotal) * 1000) / 10
      : 0;

    const reliability = {
      disconnects,
      recoveries,
      wsDeliveries,
      pollDeliveries,
      deliveryTotal,
      pollingSharePct,
    };

    const apiRequestRows = reliabilityRows.filter((r) => r.metric_type === 'api_request');
    const apiErrorRows = reliabilityRows.filter((r) => r.metric_type === 'api_error');

    const apiRequestRows24h = apiRequestRows.filter((r) => (r.created_at as string) >= since24h);
    const apiErrorRows24h = apiErrorRows.filter((r) => (r.created_at as string) >= since24h);

    const latencies7d = apiRequestRows
      .map((r) => {
        const metadata = (r.metadata ?? {}) as Record<string, unknown>;
        const value = metadata.durationMs;
        return typeof value === 'number' ? value : Number(value);
      })
      .filter((v) => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);

    const latencies24h = apiRequestRows24h
      .map((r) => {
        const metadata = (r.metadata ?? {}) as Record<string, unknown>;
        const value = metadata.durationMs;
        return typeof value === 'number' ? value : Number(value);
      })
      .filter((v) => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);

    const errorByEndpointMap = new Map<string, number>();
    for (const row of apiErrorRows) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const endpoint = typeof metadata.url === 'string' ? metadata.url : 'unknown';
      errorByEndpointMap.set(endpoint, (errorByEndpointMap.get(endpoint) ?? 0) + 1);
    }

    const api = {
      requests24h: apiRequestRows24h.length,
      errors24h: apiErrorRows24h.length,
      requests7d: apiRequestRows.length,
      errors7d: apiErrorRows.length,
      errorRate24h: apiRequestRows24h.length > 0
        ? Math.round((apiErrorRows24h.length / apiRequestRows24h.length) * 1000) / 10
        : 0,
      errorRate7d: apiRequestRows.length > 0
        ? Math.round((apiErrorRows.length / apiRequestRows.length) * 1000) / 10
        : 0,
      p50Latency24h: percentile(latencies24h, 0.5),
      p95Latency24h: percentile(latencies24h, 0.95),
      p50Latency7d: percentile(latencies7d, 0.5),
      p95Latency7d: percentile(latencies7d, 0.95),
      topErrorEndpoints: Array.from(errorByEndpointMap.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };

    const smsSuccessRows = reliabilityRows.filter((r) => r.metric_type === 'sms_delivery_success');
    const smsFailedRows = reliabilityRows.filter((r) => r.metric_type === 'sms_delivery_failed');
    const smsSuccess7d = smsSuccessRows.length;
    const smsFailed7d = smsFailedRows.length;
    const smsTotal7d = smsSuccess7d + smsFailed7d;
    const smsFailurePct7d = smsTotal7d > 0
      ? Math.round((smsFailed7d / smsTotal7d) * 1000) / 10
      : 0;

    const smsSuccess24h = smsSuccessRows.filter((r) => (r.created_at as string) >= since24h).length;
    const smsFailed24h = smsFailedRows.filter((r) => (r.created_at as string) >= since24h).length;
    const smsTotal24h = smsSuccess24h + smsFailed24h;
    const smsFailurePct24h = smsTotal24h > 0
      ? Math.round((smsFailed24h / smsTotal24h) * 1000) / 10
      : 0;

    const sms = {
      success24h: smsSuccess24h,
      failed24h: smsFailed24h,
      total24h: smsTotal24h,
      failurePct24h: smsFailurePct24h,
      success7d: smsSuccess7d,
      failed7d: smsFailed7d,
      total7d: smsTotal7d,
      failurePct7d: smsFailurePct7d,
    };

    const smsByTypeMap: Record<string, { success: number; failed: number }> = {};
    for (const row of [...smsSuccessRows, ...smsFailedRows]) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const messageType = typeof metadata.messageType === 'string' ? metadata.messageType : 'unknown';
      if (!smsByTypeMap[messageType]) {
        smsByTypeMap[messageType] = { success: 0, failed: 0 };
      }
      if (row.metric_type === 'sms_delivery_success') smsByTypeMap[messageType].success += 1;
      if (row.metric_type === 'sms_delivery_failed') smsByTypeMap[messageType].failed += 1;
    }

    const smsByType = Object.entries(smsByTypeMap)
      .map(([messageType, v]) => {
        const total = v.success + v.failed;
        const failurePct = total > 0 ? Math.round((v.failed / total) * 1000) / 10 : 0;
        return { messageType, success: v.success, failed: v.failed, total, failurePct };
      })
      .sort((a, b) => b.total - a.total);

    const pendingRows = pendingSmsRes.data ?? [];
    const queue = {
      pendingTotal: pendingRows.length,
      retryingCount: pendingRows.filter((r) => Number(r.attempts ?? 0) > 0).length,
      highAttemptCount: pendingRows.filter((r) => Number(r.attempts ?? 0) >= 2).length,
    };

    const alerts = {
      highPollingShare: pollingSharePct > RELIABILITY_ALERT_THRESHOLDS.highPollingSharePct,
      realtimeDisconnectSpike24h: reliabilityRows
        .filter((r) => r.metric_type === 'realtime_disconnect' && (r.created_at as string) >= since24h)
        .length > RELIABILITY_ALERT_THRESHOLDS.disconnectSpike24h,
      highSmsFailure24h:
        smsTotal24h >= RELIABILITY_ALERT_THRESHOLDS.smsMinSamples24h
        && smsFailurePct24h > RELIABILITY_ALERT_THRESHOLDS.smsFailurePct24h,
      highSmsFailure7d:
        smsTotal7d >= RELIABILITY_ALERT_THRESHOLDS.smsMinSamples7d
        && smsFailurePct7d > RELIABILITY_ALERT_THRESHOLDS.smsFailurePct7d,
      highRetryBacklog: queue.highAttemptCount > RELIABILITY_ALERT_THRESHOLDS.highRetryBacklogCount,
      highApiErrorRate24h:
        api.requests24h >= RELIABILITY_ALERT_THRESHOLDS.apiMinRequests24h
        && api.errorRate24h > RELIABILITY_ALERT_THRESHOLDS.apiErrorRatePct24h,
      highApiLatency24h:
        api.requests24h >= RELIABILITY_ALERT_THRESHOLDS.apiMinRequests24h
        && api.p95Latency24h > RELIABILITY_ALERT_THRESHOLDS.apiP95LatencyMs24h,
    };

    return NextResponse.json({
      vitals,
      errorCounts,
      totalErrors,
      totalVitals,
      since,
      reliability,
      api,
      sms,
      smsByType,
      queue,
      alerts,
    });
  } catch (err) {
    logger.error('[RELIABILITY] unexpected error:', err);
    return jsonError('Server error', 500);
  }
}
