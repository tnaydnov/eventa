'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminFetch } from '../shared';

/* ─── Types ─── */
interface VitalRow {
  name: string;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

interface ErrorDay {
  date: string;
  count: number;
}

interface ReliabilityData {
  vitals: VitalRow[];
  errorCounts: ErrorDay[];
  totalErrors: number;
  totalVitals: number;
  since: string;
  reliability?: {
    disconnects: number;
    recoveries: number;
    wsDeliveries: number;
    pollDeliveries: number;
    deliveryTotal: number;
    pollingSharePct: number;
  };
  api?: {
    requests24h: number;
    errors24h: number;
    requests7d: number;
    errors7d: number;
    errorRate24h: number;
    errorRate7d: number;
    p50Latency24h: number;
    p95Latency24h: number;
    p50Latency7d: number;
    p95Latency7d: number;
    topErrorEndpoints: Array<{ endpoint: string; count: number }>;
  };
  sms?: {
    success24h: number;
    failed24h: number;
    total24h: number;
    failurePct24h: number;
    success7d: number;
    failed7d: number;
    total7d: number;
    failurePct7d: number;
  };
  smsByType?: Array<{
    messageType: string;
    success: number;
    failed: number;
    total: number;
    failurePct: number;
  }>;
  queue?: {
    pendingTotal: number;
    retryingCount: number;
    highAttemptCount: number;
  };
  alerts?: {
    highPollingShare: boolean;
    realtimeDisconnectSpike24h: boolean;
    highSmsFailure24h: boolean;
    highSmsFailure7d: boolean;
    highRetryBacklog: boolean;
    highApiErrorRate24h: boolean;
    highApiLatency24h: boolean;
  };
}

/* ─── Helpers ─── */
const METRIC_UNITS: Record<string, string> = {
  CLS: '',
  FCP: 'ms',
  FID: 'ms',
  INP: 'ms',
  LCP: 'ms',
  TTFB: 'ms',
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  LCP: 'Largest Contentful Paint',
  FCP: 'First Contentful Paint',
  CLS: 'Cumulative Layout Shift',
  INP: 'Interaction to Next Paint',
  TTFB: 'Time to First Byte',
  FID: 'First Input Delay',
};

function fmtVal(name: string, val: number): string {
  const unit = METRIC_UNITS[name] ?? 'ms';
  if (!unit) return val.toFixed(3);
  return `${val.toFixed(0)}${unit}`;
}

function ratingColor(good: number, ni: number, poor: number): string {
  const total = good + ni + poor;
  if (total === 0) return '#64748b';
  const goodPct = good / total;
  if (goodPct >= 0.75) return '#22c55e';
  if (goodPct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function overallRating(good: number, ni: number, poor: number): string {
  const total = good + ni + poor;
  if (total === 0) return '–';
  const goodPct = good / total;
  if (goodPct >= 0.75) return 'Good';
  if (goodPct >= 0.5) return 'Needs work';
  return 'Poor';
}

function formatDate(dateStr: string): string {
  try {
    const [, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  } catch {
    return dateStr;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ad-tooltip">
      {label && <div className="ad-tooltip__label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="ad-tooltip__row">
          <span className="ad-tooltip__dot" style={{ background: p.fill || p.color }} />
          <span className="ad-tooltip__name">{p.name || 'שגיאות'}</span>
          <span className="ad-tooltip__val">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── RatingBar ─── */
function RatingBar({ good, ni, poor }: { good: number; ni: number; poor: number }) {
  const total = good + ni + poor;
  if (total === 0) return <span style={{ color: '#64748b', fontSize: 12 }}>אין נתונים</span>;
  const gPct = Math.round((good / total) * 100);
  const niPct = Math.round((ni / total) * 100);
  const pPct = 100 - gPct - niPct;
  return (
    <div style={{ display: 'flex', height: 12, width: 120, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
      {gPct > 0 && (
        <div
          style={{ width: `${gPct}%`, background: '#22c55e' }}
          title={`Good: ${gPct}%`}
        />
      )}
      {niPct > 0 && (
        <div
          style={{ width: `${niPct}%`, background: '#f59e0b' }}
          title={`Needs improvement: ${niPct}%`}
        />
      )}
      {pPct > 0 && (
        <div
          style={{ width: `${pPct}%`, background: '#ef4444' }}
          title={`Poor: ${pPct}%`}
        />
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function AdminReliabilityView() {
  const [data, setData] = useState<ReliabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setError('');
    adminFetch('/api/admin/reliability')
      .then(async (res) => {
        if (res.ok) setData(await res.json());
        else setError('שגיאה בטעינת נתוני אמינות');
      })
      .catch(() => setError('שגיאת תקשורת'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="ad-section">
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem' }}>
          טוען נתוני אמינות...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ad-section">
        <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
          {error || 'שגיאה לא ידועה'}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button className="admin-btn admin-btn--primary" onClick={loadData}>
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  const sinceDate = new Date(data.since).toLocaleDateString('he-IL');
  const runtime = data.reliability;
  const api = data.api;
  const sms = data.sms;
  const smsByType = data.smsByType ?? [];
  const queue = data.queue;
  const alerts = data.alerts;

  return (
    <div className="ad-section" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            📡 אמינות - 7 ימים אחרונים
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: 13 }}>
            מאז {sinceDate} &nbsp;·&nbsp; {data.totalVitals.toLocaleString('he-IL')} מדידות &nbsp;·&nbsp; {data.totalErrors.toLocaleString('he-IL')} שגיאות
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={loadData} style={{ fontSize: 13 }}>
          ↻ רענן
        </button>
      </div>

      {/* ─── Realtime Runtime Health ─── */}
      <div className="ad-card">
        <div className="ad-card__title">Realtime Runtime Health</div>
        {!runtime ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני runtime reliability עדיין.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Realtime disconnects</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#ef4444' }}>{runtime.disconnects.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Realtime recoveries</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#22c55e' }}>{runtime.recoveries.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Delivered via WebSocket</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#22c55e' }}>{runtime.wsDeliveries.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Delivered via polling</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#f59e0b' }}>{runtime.pollDeliveries.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Polling share</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: runtime.pollingSharePct > 5 ? '#f59e0b' : '#22c55e' }}>
                {runtime.pollingSharePct.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Target: &lt; 5%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── SMS Delivery Health ─── */}
      <div className="ad-card">
        <div className="ad-card__title">SMS Delivery Health</div>
        {!sms ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני SMS reliability עדיין.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>SMS failure (24h)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: sms.failurePct24h > 10 ? '#ef4444' : '#22c55e' }}>
                {sms.failurePct24h.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{sms.failed24h} / {sms.total24h}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>SMS failure (7d)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: sms.failurePct7d > 8 ? '#f59e0b' : '#22c55e' }}>
                {sms.failurePct7d.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{sms.failed7d} / {sms.total7d}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Sent SMS (24h)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#22c55e' }}>{sms.success24h.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Sent SMS (7d)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#22c55e' }}>{sms.success7d.toLocaleString('he-IL')}</div>
            </div>
          </div>
        )}
      </div>

      {/* ─── API Health ─── */}
      <div className="ad-card">
        <div className="ad-card__title">Client API Health</div>
        {!api ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני API telemetry עדיין.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Error rate (24h)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: api.errorRate24h > 5 ? '#ef4444' : '#22c55e' }}>
                {api.errorRate24h.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{api.errors24h} / {api.requests24h}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Error rate (7d)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: api.errorRate7d > 5 ? '#f59e0b' : '#22c55e' }}>
                {api.errorRate7d.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{api.errors7d} / {api.requests7d}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>p95 latency (24h)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: api.p95Latency24h > 1500 ? '#ef4444' : '#22c55e' }}>
                {api.p95Latency24h.toFixed(0)}ms
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>p50 latency (24h)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#94a3b8' }}>
                {api.p50Latency24h.toFixed(0)}ms
              </div>
            </div>
          </div>
        )}
        {api && api.topErrorEndpoints.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Top failing endpoints (7d)</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {api.topErrorEndpoints.map((row) => (
                <div key={row.endpoint} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#e5e7eb', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ color: '#94a3b8' }}>{row.endpoint}</span>
                  <strong style={{ color: '#ef4444' }}>{row.count.toLocaleString('he-IL')}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── SMS by Message Type ─── */}
      <div className="ad-card">
        <div className="ad-card__title">SMS by Message Type (7d)</div>
        {smsByType.length === 0 ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין פירוט לפי סוג הודעה עדיין.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>סוג הודעה</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>נשלחו</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>נכשלו</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>סה&quot;כ</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>אחוז כשל</th>
                </tr>
              </thead>
              <tbody>
                {smsByType.map((row) => (
                  <tr key={row.messageType} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '10px 12px', color: '#e5e7eb', fontWeight: 600 }}>{row.messageType}</td>
                    <td style={{ padding: '10px 12px', color: '#22c55e' }}>{row.success.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444' }}>{row.failed.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.total.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '10px 12px', color: row.failurePct > 10 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                      {row.failurePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── SMS Queue Backlog ─── */}
      <div className="ad-card">
        <div className="ad-card__title">SMS Queue Backlog</div>
        {!queue ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני תור SMS.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Pending total</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#e5e7eb' }}>{queue.pendingTotal.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Retrying (&gt;0 attempts)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#f59e0b' }}>{queue.retryingCount.toLocaleString('he-IL')}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>High attempts (&ge;2)</div>
              <div style={{ fontWeight: 700, fontSize: 22, color: queue.highAttemptCount > 20 ? '#ef4444' : '#22c55e' }}>
                {queue.highAttemptCount.toLocaleString('he-IL')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Reliability Alerts ─── */}
      <div className="ad-card">
        <div className="ad-card__title">Alert Thresholds</div>
        {!alerts ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני alerts עדיין.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highPollingShare ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highPollingShare ? '#ef4444' : '#22c55e' }}>
              {alerts.highPollingShare ? '⚠ Polling share above 5%' : '✓ Polling share within target'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.realtimeDisconnectSpike24h ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.realtimeDisconnectSpike24h ? '#ef4444' : '#22c55e' }}>
              {alerts.realtimeDisconnectSpike24h ? '⚠ Realtime disconnect spike (24h)' : '✓ Realtime disconnects stable (24h)'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highSmsFailure24h ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highSmsFailure24h ? '#ef4444' : '#22c55e' }}>
              {alerts.highSmsFailure24h ? '⚠ SMS failure high (24h)' : '✓ SMS failure normal (24h)'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highSmsFailure7d ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highSmsFailure7d ? '#f59e0b' : '#22c55e' }}>
              {alerts.highSmsFailure7d ? '⚠ SMS failure elevated (7d)' : '✓ SMS failure normal (7d)'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highRetryBacklog ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highRetryBacklog ? '#ef4444' : '#22c55e' }}>
              {alerts.highRetryBacklog ? '⚠ High retry backlog in SMS queue' : '✓ SMS retry backlog healthy'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highApiErrorRate24h ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highApiErrorRate24h ? '#ef4444' : '#22c55e' }}>
              {alerts.highApiErrorRate24h ? '⚠ API client error rate high (24h)' : '✓ API client error rate normal (24h)'}
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: alerts.highApiLatency24h ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', color: alerts.highApiLatency24h ? '#f59e0b' : '#22c55e' }}>
              {alerts.highApiLatency24h ? '⚠ API p95 latency elevated (24h)' : '✓ API p95 latency normal (24h)'}
            </div>
          </div>
        )}
      </div>

      {/* ─── Web Vitals Table ─── */}
      <div className="ad-card">
        <div className="ad-card__title">Core Web Vitals</div>
        {data.vitals.length === 0 ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין נתוני Web Vitals עדיין.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>מדד</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>מדידות</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>p50</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>p75</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>p95</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>דירוג</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>התפלגות</th>
                </tr>
              </thead>
              <tbody>
                {data.vitals.map((v) => {
                  const color = ratingColor(v.good, v.needsImprovement, v.poor);
                  const rating = overallRating(v.good, v.needsImprovement, v.poor);
                  const desc = METRIC_DESCRIPTIONS[v.name] ?? v.name;
                  return (
                    <tr
                      key={v.name}
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#e5e7eb' }}>{v.name}</div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{desc}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                        {v.count.toLocaleString('he-IL')}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#e5e7eb', fontFamily: 'monospace' }}>
                        {fmtVal(v.name, v.p50)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#e5e7eb', fontFamily: 'monospace' }}>
                        {fmtVal(v.name, v.p75)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#e5e7eb', fontFamily: 'monospace' }}>
                        {fmtVal(v.name, v.p95)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${color}22`,
                            color,
                          }}
                        >
                          {rating}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <RatingBar good={v.good} ni={v.needsImprovement} poor={v.poor} />
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                          <span style={{ color: '#22c55e' }}>{v.good}</span>
                          {' / '}
                          <span style={{ color: '#f59e0b' }}>{v.needsImprovement}</span>
                          {' / '}
                          <span style={{ color: '#ef4444' }}>{v.poor}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Client Errors Bar Chart ─── */}
      <div className="ad-card">
        <div className="ad-card__title">שגיאות JavaScript - לפי יום</div>
        {data.errorCounts.length === 0 ? (
          <p style={{ color: '#64748b', margin: '1rem 0' }}>אין שגיאות שנרשמו ב-7 ימים האחרונים.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.errorCounts.map((d) => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="שגיאות" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Legend / Info ─── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> Good</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Needs improvement</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Poor</span>
        <span style={{ marginRight: 'auto' }}>נתונים נאספים דרך navigator.sendBeacon ← /api/telemetry/vitals</span>
      </div>

    </div>
  );
}
