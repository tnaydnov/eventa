'use client';

import { useRef, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList,
} from 'recharts';
import type { Event } from '@/lib/database.types';
import type { CuratedReportPayload } from '@/lib/report/curate';

// ─── Types ───────────────────────────────────────────────────────────────────
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
  /** Pre-select a specific event on mount (e.g. when embedded in event detail view) */
  initialEventId?: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C = ['#6366f1', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#f97316'];

// ─── Label maps ──────────────────────────────────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  qr_scan:          'סריקת QR',
  join_page_view:   'צפייה בדף',
  otp_requested:    'בקשת קוד',
  otp_verified:     'אימות קוד',
  setup_started:    'התחלת פרופיל',
  profile_complete: 'פרופיל הושלם',
};

const GENDER_LABELS: Record<string, string> = {
  male:   'גברים',
  female: 'נשים',
  other:  'אחר',
};

// ─── Custom tooltip (dark theme) ─────────────────────────────────────────────
function ChartTip({ active, payload, label }: Record<string, unknown>) {
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

// ─── KPI stat card ────────────────────────────────────────────────────────────
function KpiCard({
  label, value, color = '#6366f1', sub,
}: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '12px',
      padding: '16px 10px',
      textAlign: 'center',
      border: `1px solid ${color}44`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: color, borderRadius: '12px 12px 0 0',
      }} />
      <div style={{ fontSize: '26px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: `${color}99`, marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

// ─── Network stat progress row ────────────────────────────────────────────────
function NetworkRow({
  label, value, total, color,
}: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>
          {value} <span style={{ color: '#64748b' }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: '2px', transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Safety badge ─────────────────────────────────────────────────────────────
function SafetyBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center',
      background: `${color}22`, borderRadius: '8px', padding: '10px 4px',
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminReportView({ events, initialEventId }: AdminReportViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId ?? '');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const eligibleEvents = events.filter(
    (e) => e.status === 'ended' || e.status === 'archived'
  );

  useEffect(() => {
    if (!selectedEventId) { setReport(null); return; }
    fetchReport(selectedEventId);
  }, [selectedEventId]);

  async function fetchReport(eventId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${eventId}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status !== 404) throw new Error('שגיאת שרת');
        setReport(null);
      } else {
        const data = await res.json();
        setReport(data.report ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedEventId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${selectedEventId}/generate`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error('שגיאה ביצירת הדוח');
      await fetchReport(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0f172a',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const imgW = pdfW;
      const imgH = imgW / ratio;
      const yOff = imgH <= pdfH ? (pdfH - imgH) / 2 : 0;

      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.93),
        'JPEG',
        0, yOff, imgW, Math.min(imgH, pdfH)
      );

      const eventName = events.find((e) => e.id === selectedEventId)?.name ?? 'event';
      pdf.save(`דוח-${eventName}.pdf`);
    } catch {
      setError('שגיאה ביצוא PDF');
    } finally {
      setExportingPdf(false);
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // When embedded in event detail for a non-ended event
  if (initialEventId && eligibleEvents.length === 0) {
    return (
      <div className="admin-section" dir="rtl">
        <div className="ad-empty">
          <p>הדוח זמין רק לאחר סיום האירוע.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section" dir="rtl">
      <div className="admin-section__header">
        <h2 className="admin-section__title">דוחות אירוע</h2>
      </div>

      {/* Event picker — hidden when embedded */}
      {!initialEventId && (
        <div style={{ marginBottom: '24px' }}>
          <label className="admin-label">בחר אירוע שהסתיים</label>
          <select
            className="admin-input"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ marginTop: '8px' }}
          >
            <option value="">-- בחר אירוע --</option>
            {eligibleEvents.map((ev) => (
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
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--admin-surface)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px' }}>
            הדוח עבור <strong>{selectedEvent?.name}</strong> עדיין לא נוצר.
          </p>
          <button
            className="admin-btn admin-btn--primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'מייצר דוח...' : 'צור דוח עכשיו'}
          </button>
        </div>
      )}

      {!loading && report && (
        <>
          {/* ── Action toolbar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '20px', flexWrap: 'wrap',
          }}>
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
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginRight: 'auto' }}>
              עודכן: {new Date(report.generated_at).toLocaleString('he-IL')}
            </span>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              REPORT CANVAS — captured by html2canvas for PDF export
          ═══════════════════════════════════════════════════════════════ */}
          <div
            ref={reportRef}
            style={{
              background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
              borderRadius: '16px',
              padding: '28px 28px 24px',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            }}
          >
            {/* ── Report header ── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: '22px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>✦</div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    {selectedEvent?.name ?? 'דוח אירוע'}
                  </h2>
                </div>
                <p style={{ color: '#a5b4fc', fontSize: '13px', margin: 0, paddingRight: '42px' }}>
                  {selectedEvent
                    ? new Date(selectedEvent.starts_at).toLocaleDateString('he-IL', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })
                    : ''}
                </p>
              </div>
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <div style={{ color: '#6366f1', fontSize: '13px', fontWeight: 600 }}>Eventa</div>
                <div style={{ color: '#64748b', fontSize: '11px' }}>
                  {new Date(report.generated_at).toLocaleDateString('he-IL')}
                </div>
              </div>
            </div>

            {/* ── KPI strip ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '10px',
              marginBottom: '18px',
            }}>
              <KpiCard label="משתתפים"      value={report.curated_payload.network.total_participants}                                 color="#6366f1" />
              <KpiCard label="לייקים"        value={report.curated_payload.engagement.total_likes}                                     color="#ec4899" />
              <KpiCard label="התאמות"        value={report.curated_payload.engagement.mutual_likes}                                    color="#22c55e" />
              <KpiCard label="אחוז התאמות"   value={`${report.curated_payload.engagement.match_rate.toFixed(1)}%`}                    color="#f59e0b" />
              <KpiCard label="שיחות"         value={report.curated_payload.engagement.total_conversations}                             color="#3b82f6" />
              <KpiCard label="הודעות"        value={report.curated_payload.engagement.total_messages}                                  color="#a855f7" />
              <KpiCard label="ממוצע הודעות"  value={report.curated_payload.engagement.avg_messages_per_conversation} color="#06b6d4" sub="לשיחה" />
              <KpiCard label="שיחות עמוקות"  value={report.curated_payload.engagement.conversations_with_3plus_messages} color="#f97316" sub="3+ הודעות" />
            </div>

            {/* ── Row 1: Funnel + Gender donut + Age bars ── */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>

              {/* Funnel */}
              {(report.curated_payload.funnel?.steps?.length ?? 0) > 0 && (
                <div style={{
                  flex: '1 1 52%', background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    משפך הצטרפות
                    {report.curated_payload.funnel.top_drop_off && (
                      <span style={{ color: '#ef4444', fontWeight: 400, fontSize: '11px', marginRight: '8px' }}>
                        · עצירה עיקרית: {STEP_LABELS[report.curated_payload.funnel.top_drop_off] ?? report.curated_payload.funnel.top_drop_off}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={186}>
                    <BarChart
                      data={report.curated_payload.funnel.steps.map((s) => ({
                        name: STEP_LABELS[s.step] ?? s.step,
                        count: s.count,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 42, bottom: 0, left: 90 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="count" name="כניסות" radius={[0, 4, 4, 0]}>
                        {report.curated_payload.funnel.steps.map((_, i) => (
                          <Cell key={i} fill={C[i % C.length]} fillOpacity={0.9} />
                        ))}
                        <LabelList dataKey="count" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Gender donut */}
              {(report.curated_payload.crosstabs?.gender_distribution?.length ?? 0) > 0 && (
                <div style={{
                  flex: '1 1 22%', background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>מגדר</div>
                  <ResponsiveContainer width="100%" height={186}>
                    <PieChart>
                      <Pie
                        data={report.curated_payload.crosstabs.gender_distribution.map((g) => ({
                          name: GENDER_LABELS[g.label] ?? g.label,
                          value: g.count,
                        }))}
                        cx="50%" cy="46%"
                        innerRadius={42} outerRadius={66}
                        dataKey="value" paddingAngle={3}
                      >
                        {report.curated_payload.crosstabs.gender_distribution.map((_, i) => (
                          <Cell key={i} fill={C[i % C.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend formatter={(v) => <span style={{ color: '#e2e8f0', fontSize: 11 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Age distribution */}
              {(report.curated_payload.crosstabs?.age_buckets?.filter((b) => b.count > 0).length ?? 0) > 0 && (
                <div style={{
                  flex: '1 1 22%', background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>גיל</div>
                  <ResponsiveContainer width="100%" height={186}>
                    <BarChart
                      data={report.curated_payload.crosstabs.age_buckets
                        .filter((b) => b.count > 0)
                        .map((b) => ({ name: b.label, count: b.count }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="count" name="משתתפים" radius={[4, 4, 0, 0]}>
                        {report.curated_payload.crosstabs.age_buckets.map((_, i) => (
                          <Cell key={i} fill={C[(i + 2) % C.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── Row 2: Hourly activity + Network & Safety ── */}
            <div style={{ display: 'flex', gap: '14px' }}>

              {/* Hourly area chart */}
              {(report.curated_payload.time_dynamics?.hourly_activity?.length ?? 0) > 0 && (
                <div style={{
                  flex: '1 1 58%', background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                    פעילות לפי שעה
                    {report.curated_payload.time_dynamics.peak_hour != null && (
                      <span style={{ color: '#6366f1', fontWeight: 400, fontSize: '11px', marginRight: '8px' }}>
                        · שיא ב-{report.curated_payload.time_dynamics.peak_hour}:00
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart
                      data={report.curated_payload.time_dynamics.hourly_activity.map((h) => ({
                        hour: `${h.hour}:00`, count: h.count,
                      }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: -4 }}
                    >
                      <defs>
                        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="count" name="פעולות" stroke="#6366f1" fill="url(#actGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Network + Safety panel */}
              <div style={{
                flex: '1 1 40%', background: 'rgba(255,255,255,0.04)',
                borderRadius: '12px', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>רשת & בטיחות</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <NetworkRow
                    label="עם התאמה לפחות אחת"
                    value={report.curated_payload.network.participants_with_matches}
                    total={report.curated_payload.network.total_participants}
                    color="#22c55e"
                  />
                  <NetworkRow
                    label="ניהלו שיחה"
                    value={report.curated_payload.network.participants_with_messages}
                    total={report.curated_payload.network.total_participants}
                    color="#3b82f6"
                  />
                  <NetworkRow
                    label="ללא אינטראקציה"
                    value={report.curated_payload.network.isolated_participants}
                    total={report.curated_payload.network.total_participants}
                    color="#64748b"
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{
                    flex: 1, textAlign: 'center',
                    background: '#f59e0b22', borderRadius: '8px', padding: '10px 4px',
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                      {report.curated_payload.network.avg_likes_sent.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>ממוצע לייקים</div>
                  </div>
                  <SafetyBadge label="חסימות"  value={report.curated_payload.safety.total_blocks}        color="#f59e0b" />
                  <SafetyBadge label="דיווחים" value={report.curated_payload.safety.total_reports}       color="#ef4444" />
                  <SafetyBadge label="חסומים"  value={report.curated_payload.safety.banned_participants}  color="#6b7280" />
                </div>
              </div>
            </div>

          </div>{/* end reportRef */}
        </>
      )}
    </div>
  );
}
