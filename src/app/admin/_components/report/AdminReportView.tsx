'use client';

import { useRef, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList, AreaChart, Area, ReferenceLine,
} from 'recharts';
import type { Event } from '@/lib/database.types';
import type { CuratedReportPayload } from '@/lib/report/curate';

// Types
type ReportData = {
  curated_payload: CuratedReportPayload;
  ai_summary: string | null;
  generated_at: string;
  schema_version: number;
  email_sent_at?: string | null;
  email_sent_to?: string | null;
};

interface AdminReportViewProps {
  events: Event[];
  initialEventId?: string;
}

// Warm palette
const P = {
  rose:    '#f43f5e',
  fuchsia: '#c026d3',
  amber:   '#f59e0b',
  emerald: '#10b981',
  violet:  '#8b5cf6',
  orange:  '#f97316',
  pink:    '#ec4899',
  teal:    '#14b8a6',
  blue:    '#3b82f6',
};
const MULTI = [P.rose, P.fuchsia, P.amber, P.emerald, P.violet, P.orange, P.pink, P.teal];

// Hebrew label maps
const FUNNEL_HE: Record<string, string> = {
  qr_scan:          'סריקת QR',
  join_page_view:   'צפיית דף הצטרפות',
  otp_requested:    'ביקש קוד SMS',
  otp_verified:     'אימת קוד',
  setup_started:    'התחיל פרופיל',
  profile_complete: 'השלים פרופיל',
};

const GENDER_HE: Record<string, string> = {
  male: 'גברים', female: 'נשים', other: 'אחר', unknown: 'לא ידוע',
};

const ATTRACTION_HE: Record<string, string> = {
  men:    'נמשכים לגברים',
  women:  'נמשכות לנשים',
  all:    'נמשכים לכולם',
  both:   'נמשכים לשני המינים',
  male:   'נמשכים לגברים',
  female: 'נמשכות לנשים',
};

// Tooltip
function Tip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const p = payload as { fill?: string; color?: string; name?: string; value?: unknown }[];
  return (
    <div className="ad-tooltip">
      {label != null && <div className="ad-tooltip__label">{String(label)}</div>}
      {p.map((item, i) => (
        <div key={i} className="ad-tooltip__row">
          <span className="ad-tooltip__dot" style={{ background: item.fill || item.color }} />
          <span className="ad-tooltip__name">{item.name ?? ''}</span>
          <span className="ad-tooltip__val">
            {typeof item.value === 'number' ? item.value.toLocaleString('he-IL') : String(item.value ?? '')}
          </span>
        </div>
      ))}
    </div>
  );
}

// Big KPI card
function BigKpi({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{
      background: `${color}14`,
      border: `1px solid ${color}38`,
      borderRadius: '12px',
      padding: '14px 10px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />
      <div style={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1.0 }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: `${color}cc`, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// Section card
function Card({ title, children, style }: {
  title?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '14px',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: '13px', fontWeight: 700, color: '#f1f5f9',
          marginBottom: '12px',
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// Stat row with optional progress bar
function StatLine({ label, value, valueColor, bar, barColor }: {
  label: string; value: string | number; valueColor?: string; bar?: number; barColor?: string;
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: valueColor ?? '#f1f5f9', flexShrink: 0 }}>
          {value}
        </span>
      </div>
      {bar !== undefined && (
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '4px' }}>
          <div style={{
            height: '100%', width: `${Math.min(Math.max(bar, 0), 100)}%`,
            background: barColor ?? P.rose, borderRadius: '2px',
          }} />
        </div>
      )}
    </div>
  );
}

// Horizontal bar (funnel/attraction)
function HBar({ label, value, max, color, badge }: {
  label: string; value: number; max: number; color: string; badge?: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  const pctDisplay = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ minWidth: '148px', fontSize: '12px', color: '#cbd5e1', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: '20px', background: 'rgba(255,255,255,0.06)',
        borderRadius: '6px', overflow: 'hidden', direction: 'ltr',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '6px',
        }}>
          {value > 0 && <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>{value}</span>}
        </div>
      </div>
      <span style={{ minWidth: '36px', fontSize: '11px', color: '#64748b', textAlign: 'left', flexShrink: 0 }}>
        {badge ?? `${pctDisplay}%`}
      </span>
    </div>
  );
}

// Pie label
function PieLabel({
  cx, cy, midAngle, outerRadius, name, value, percent,
}: {
  cx: number; cy: number; midAngle: number; outerRadius: number;
  name: string; value: number; percent: number;
}) {
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 24;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  if (percent < 0.04) return null;
  return (
    <text
      x={x} y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: '11px', fill: '#e2e8f0', fontWeight: 600 }}
    >
      {name}: {value} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// Ring progress gauge
function RingMetric({ label, value, sub, color }: {
  label: string; value: number; sub?: string; color: string;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '4px 0' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 800, color,
        }}>
          {Math.round(value)}%
        </div>
      </div>
      <div style={{ fontSize: '11px', color: '#f1f5f9', marginTop: '6px', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// Main component
export default function AdminReportView({ events, initialEventId }: AdminReportViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId ?? '');
  const [report, setReport]                   = useState<ReportData | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [exportingPdf, setExportingPdf]       = useState(false);
  const [sendingReport, setSendingReport]     = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const eligibleEvents = events.filter(e => e.status === 'ended' || e.status === 'archived');

  useEffect(() => {
    if (!selectedEventId) { setReport(null); return; }
    fetchReport(selectedEventId);
  }, [selectedEventId]);

  async function fetchReport(eventId: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${eventId}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status !== 404) throw new Error('שגיאת שרת');
        setReport(null);
      } else {
        const data = await res.json();
        setReport(data.report ?? null);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'שגיאה'); }
    finally { setLoading(false); }
  }

  async function handleGenerate() {
    if (!selectedEventId) return;
    setGenerating(true); setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${selectedEventId}/generate`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error('שגיאה ביצירת הדוח');
      await fetchReport(selectedEventId);
    } catch (err) { setError(err instanceof Error ? err.message : 'שגיאה'); }
    finally { setGenerating(false); }
  }

  async function handleSendReport() {
    if (!selectedEventId) return;
    setSendingReport(true); setError(null);
    try {
      // Call the server endpoint — it generates the same dark-themed PDF as the
      // scheduled cron email, so both paths are always identical.
      const res = await fetch(`/api/admin/reports/${selectedEventId}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'שגיאה בשליחת הדוח');
      alert(`✅ הדוח נשלח ל: ${data.email}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'שגיאה'); }
    finally { setSendingReport(false); }
  }

  async function handleDownloadPdf() {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }, { calcSinglePage }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
        import('@/lib/report/pdf-layout'),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0e0d18',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Content-sized page: page width = 210 mm (A4 width), page height = derived
      // from canvas aspect. Page dims == image dims → overflow is structurally impossible.
      const { pageW, pageH } = calcSinglePage(canvas.width, canvas.height);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);

      const eventName = events.find(e => e.id === selectedEventId)?.name ?? 'event';
      pdf.save(`דוח-${eventName}.pdf`);
    } catch { setError('שגיאה ביצוא PDF'); }
    finally { setExportingPdf(false); }
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (initialEventId && eligibleEvents.length === 0) {
    return (
      <div className="admin-section" dir="rtl">
        <div className="ad-empty"><p>הדוח זמין רק לאחר סיום האירוע.</p></div>
      </div>
    );
  }

  // Derived data
  const d  = report?.curated_payload;
  const N  = d?.network.total_participants ?? 0;

  const deepPct      = d && d.engagement.total_conversations > 0
    ? Math.round((d.engagement.conversations_with_3plus_messages / d.engagement.total_conversations) * 100) : 0;
  const shallowConvs = d ? d.engagement.total_conversations - d.engagement.conversations_with_3plus_messages : 0;
  const matchedPct   = d && N > 0 ? Math.round((d.network.participants_with_matches  / N) * 100) : 0;
  const messagedPct  = d && N > 0 ? Math.round((d.network.participants_with_messages / N) * 100) : 0;
  const isolatedPct  = d && N > 0 ? Math.round((d.network.isolated_participants      / N) * 100) : 0;

  const funnelSteps = d?.funnel?.steps ?? [];
  const funnelMax   = funnelSteps.length > 0 ? (funnelSteps[0]?.count ?? 1) : 1;

  const deletedPct       = d && N > 0 ? Math.round(((d.safety.deleted_participants ?? 0) / N) * 100) : 0;
  const convFromMatchPct = d && d.engagement.mutual_likes > 0
    ? Math.min(Math.round((d.engagement.total_conversations / d.engagement.mutual_likes) * 100), 100) : 0;
  const chatFromMatchPct = d && d.network.participants_with_matches > 0
    ? Math.min(Math.round((d.network.participants_with_messages / d.network.participants_with_matches) * 100), 100) : 0;

  const genderData = (d?.crosstabs?.gender_distribution ?? [])
    .map((g, i) => ({ name: GENDER_HE[g.label] ?? g.label, value: g.count, color: MULTI[i % MULTI.length] }))
    .filter(g => g.value > 0);

  const ageData = (d?.crosstabs?.age_buckets ?? [])
    .filter(b => b.count > 0)
    .map(b => ({ name: b.label, count: b.count }));

  const attractionData = (d?.crosstabs?.attraction_distribution ?? [])
    .filter(a => a.count > 0)
    .map((a, i) => ({
      label: ATTRACTION_HE[a.label] ?? a.label,
      value: a.count,
      color: MULTI[(i + 2) % MULTI.length],
    }));
  const attractionMax = attractionData.length > 0 ? Math.max(...attractionData.map(a => a.value)) : 1;

  const hourlyData = (() => {
    const raw = d?.time_dynamics?.hourly_activity ?? [];
    if (raw.length === 0) return [];
    // Support new format (timestamp: ISO string) and legacy (hour: integer 0-23)
    const normalized = (raw as Array<{ timestamp?: string; hour?: number; count: number }>)
      .map(h => ({
        ts: h.timestamp
          ? new Date(h.timestamp).getTime()
          : (h.hour ?? 0) * 3_600_000,
        label: h.timestamp
          ? new Date(h.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
          : `${String(h.hour ?? 0).padStart(2, '0')}:00`,
        count: h.count,
      }))
      .sort((a, b) => a.ts - b.ts);
    // Trim leading/trailing zero-count buckets
    let s = 0, e = normalized.length - 1;
    while (s < e && normalized[s].count === 0) s++;
    while (e > s && normalized[e].count === 0) e--;
    return normalized.slice(s, e + 1).map(h => ({ hour: h.label, count: h.count }));
  })();
  // Peak derived from processed (local-time) data
  const peakHourStr = hourlyData.length > 0
    ? hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]).hour
    : null;

  return (
    <div className="admin-section" dir="rtl">
      <div className="admin-section__header">
        <h2 className="admin-section__title">דוחות אירוע</h2>
      </div>

      {!initialEventId && (
        <div style={{ marginBottom: '24px' }}>
          <label className="admin-label">בחר אירוע שהסתיים</label>
          <select
            className="admin-input"
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            style={{ marginTop: '8px' }}
          >
            <option value="">-- בחר אירוע --</option>
            {eligibleEvents.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({new Date(ev.starts_at).toLocaleDateString('he-IL')})
              </option>
            ))}
          </select>
          {eligibleEvents.length === 0 && (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '14px', marginTop: '8px' }}>
              אין אירועים שהסתיימו עדיין
            </p>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div className="admin-spinner" />
          <p style={{ color: 'var(--admin-text-muted)', marginTop: '12px' }}>טוען דוח...</p>
        </div>
      )}

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {!loading && selectedEventId && !report && !error && (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--admin-surface)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px' }}>
            הדוח עבור <strong>{selectedEvent?.name}</strong> עדיין לא נוצר.
          </p>
          <button className="admin-btn admin-btn--primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'מייצר דוח...' : 'צור דוח עכשיו'}
          </button>
        </div>
      )}

      {!loading && report && d && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              className="admin-btn admin-btn--ghost"
              onClick={handleGenerate}
              disabled={generating}
              style={{ fontSize: '13px' }}
            >
              {generating ? 'מחשב...' : '↻ עדכן דוח'}
            </button>
            <button
              className="admin-btn admin-btn--primary"
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              style={{ fontSize: '13px' }}
            >
              {exportingPdf ? 'מייצא PDF...' : '⬇ הורד PDF'}
            </button>
            <button
              className="admin-btn admin-btn--ghost"
              onClick={handleSendReport}
              disabled={sendingReport}
              style={{ fontSize: '13px' }}
            >
              {sendingReport ? 'שולח...' : '📧 שלח דוח ללקוח'}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginRight: 'auto' }}>
              עודכן: {new Date(report.generated_at).toLocaleString('he-IL')}
              {report.email_sent_at && (
                <span style={{ marginRight: '8px', color: 'var(--admin-text-muted)' }}>
                  · נשלח: {new Date(report.email_sent_at).toLocaleString('he-IL')}
                </span>
              )}
            </span>
          </div>

          {/* REPORT CANVAS */}
          <div
            ref={reportRef}
            style={{
              background: '#0e0d18',
              borderRadius: '16px',
              padding: '18px',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
              color: '#e2e8f0',
              maxWidth: '860px',
              margin: '0 auto',
              direction: 'rtl',
            }}
          >
            {/* HEADER */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '20px', paddingBottom: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {selectedEvent?.name ?? 'דוח אירוע'}
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '3px' }}>
                  {selectedEvent
                    ? new Date(selectedEvent.starts_at).toLocaleDateString('he-IL', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })
                    : ''}
                </div>
              </div>
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/Eventa_Logo.png"
                  alt="Eventa"
                  style={{ height: '34px', width: 'auto', display: 'block' }}
                />
              </div>
            </div>

            {/* KPI ROW 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
              <BigKpi label="משתתפים"           value={N}                                 color={P.rose} />
              <BigKpi label="לייקים שנשלחו"     value={d.engagement.total_likes}          color={P.fuchsia} />
              <BigKpi
                label="התאמות הדדיות"
                value={d.engagement.mutual_likes}
                color={P.emerald}
                sub={`שיעור: ${d.engagement.match_rate.toFixed(1)}%`}
              />
              <BigKpi label="שיחות"             value={d.engagement.total_conversations}  color={P.violet} />
            </div>

            {/* KPI ROW 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
              <BigKpi label="הודעות"            value={d.engagement.total_messages}                        color={P.orange} />
              <BigKpi label="ממוצע הודעות לשיחה" value={d.engagement.avg_messages_per_conversation}       color={P.amber} />
              <BigKpi
                label="שיחות עמוקות (3+)"
                value={d.engagement.conversations_with_3plus_messages}
                color={P.pink}
                sub={`${deepPct}% מהשיחות`}
              />
              <BigKpi
                label="ממוצע לייקים שנשלחו"
                value={d.network.avg_likes_sent}
                color={P.teal}
                sub={`שהתקבלו: ${d.network.avg_likes_received}`}
              />
            </div>

            {/* GENDER + AGE side by side */}
            {(genderData.length > 0 || ageData.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: genderData.length > 0 && ageData.length > 0 ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '10px' }}>
                {genderData.length > 0 && (
                  <Card title="חלוקה מגדרית">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Donut - no SVG text so html2canvas captures correctly */}
                      <div style={{ flexShrink: 0, width: 120, height: 120 }}>
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie
                              data={genderData}
                              cx="50%" cy="50%"
                              outerRadius={54}
                              innerRadius={28}
                              dataKey="value"
                              paddingAngle={4}
                              isAnimationActive={false}
                            >
                              {genderData.map((g, i) => <Cell key={i} fill={g.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* DOM-based legend - always captured by html2canvas */}
                      <div style={{ flex: 1 }}>
                        {genderData.map((g, i) => {
                          const total = genderData.reduce((s, x) => s + x.value, 0);
                          const pct   = total > 0 ? Math.round((g.value / total) * 100) : 0;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: '#cbd5e1', flex: 1 }}>{g.name}</span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: g.color }}>{g.value}</span>
                              <span style={{ fontSize: '11px', color: '#64748b', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                )}
                {ageData.length > 0 && (
                  <Card title="התפלגות גיל">
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={ageData} margin={{ top: 16, right: 8, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <RechartsTip content={<Tip />} />
                        <Bar dataKey="count" name="משתתפים" radius={[6, 6, 0, 0]} barSize={44}>
                          {ageData.map((_, i) => <Cell key={i} fill={MULTI[(i + 3) % MULTI.length]} />)}
                          <LabelList dataKey="count" position="top" style={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 700 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </div>
            )}

            {/* HOURLY ACTIVITY */}
            {hourlyData.length > 1 && (
              <Card title="פעילות לאורך האירוע" style={{ marginBottom: '12px' }}>
                {peakHourStr && (
                  <div style={{ fontSize: '11px', color: P.amber, marginBottom: '8px', fontWeight: 600 }}>
                    שיא פעילות: {peakHourStr}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={P.rose} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={P.rose} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      interval={Math.max(Math.floor(hourlyData.length / 10) - 1, 0)}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      label={{ value: 'פעולות', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, dx: 14 }}
                    />
                    <RechartsTip content={<Tip />} />
                    {peakHourStr && (
                      <ReferenceLine
                        x={peakHourStr}
                        stroke={P.amber}
                        strokeDasharray="4 3"
                        label={{ value: 'שיא', fill: P.amber, fontSize: 10, fontWeight: 700, position: 'insideTopRight' }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="פעולות"
                      stroke={P.rose}
                      fill="url(#hrGrad)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: P.rose }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* CONVERSATIONS + NETWORK */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <Card title="שיחות ומעורבות">
                <StatLine label="סה״כ שיחות"              value={d.engagement.total_conversations}                    valueColor={P.violet} />
                <StatLine label="שיחות קצרות (1-2 הודעות)"  value={shallowConvs}                                       valueColor="#94a3b8" />
                <StatLine label="שיחות עמוקות (3+ הודעות)"  value={d.engagement.conversations_with_3plus_messages}    valueColor={P.emerald} bar={deepPct} barColor={P.emerald} />
                <StatLine label="ממוצע הודעות לשיחה"       value={d.engagement.avg_messages_per_conversation}         valueColor={P.amber} />
                <StatLine label="סה״כ הודעות"              value={d.engagement.total_messages}                        valueColor={P.orange} />
              </Card>

              <Card title="חיבורי רשת משתתפים">
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                  מתוך {N} המשתתפים
                </div>
                <StatLine
                  label="קיבלו התאמה לפחות אחת"
                  value={`${d.network.participants_with_matches} (${matchedPct}%)`}
                  valueColor={P.emerald} bar={matchedPct} barColor={P.emerald}
                />
                <StatLine
                  label="שלחו או קיבלו הודעות"
                  value={`${d.network.participants_with_messages} (${messagedPct}%)`}
                  valueColor={P.violet} bar={messagedPct} barColor={P.violet}
                />
                <StatLine
                  label="ללא אינטראקציה כלל"
                  value={`${d.network.isolated_participants} (${isolatedPct}%)`}
                  valueColor="#64748b" bar={isolatedPct} barColor="#475569"
                />
                <StatLine label="ממוצע לייקים שנשלחו"   value={d.network.avg_likes_sent} />
                <StatLine label="ממוצע לייקים שהתקבלו" value={d.network.avg_likes_received} />
              </Card>
            </div>



            {/* GENDER INITIATIVE - who opened first + ghosting */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <Card title="מי פתח שיחה ראשון">
                <StatLine label="גברים" value={d.engagement.first_message_by_men   ?? 0} valueColor={P.blue}   />
                <StatLine label="נשים"  value={d.engagement.first_message_by_women ?? 0} valueColor={P.rose}   />
              </Card>
              <Card title="לייק ראשון">
                <StatLine label="גברים" value={d.engagement.first_like_by_men   ?? 0} valueColor={P.blue}   />
                <StatLine label="נשים"  value={d.engagement.first_like_by_women ?? 0} valueColor={P.rose}   />
              </Card>
              <Card title="גוסטינג">
                <StatLine label="שיחות ללא מענה" value={d.engagement.ghosted_conversations ?? 0} valueColor="#64748b" />
              </Card>
            </div>

            {/* FOOTER */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: '11px', color: '#475569', direction: 'ltr' }}>
                © Eventa {new Date().getFullYear()} · כל הזכויות שמורות
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
