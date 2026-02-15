'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/constants';
import { adminFetch, type GlobalAnalytics, type EventComparisonRow, type EventRankItem } from '../shared';

/* ─── Color palette (same as per-event dashboard) ─── */
const C = {
  indigo: '#6366f1', pink: '#ec4899', blue: '#3b82f6', green: '#22c55e',
  orange: '#f59e0b', purple: '#a855f7', cyan: '#06b6d4', red: '#ef4444', slate: '#64748b',
};

/* ─── Helpers ─── */
const fmt = (n: number) => n.toLocaleString('he-IL');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ad-tooltip">
      {label && <div className="ad-tooltip__label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="ad-tooltip__row">
          <span className="ad-tooltip__dot" style={{ background: p.fill || p.color || p.payload?.color }} />
          <span className="ad-tooltip__name">{p.name || p.payload?.name}</span>
          <span className="ad-tooltip__val">{typeof p.value === 'number' ? p.value.toLocaleString('he-IL') : p.value}</span>
        </div>
      ))}
    </div>
  );
}
const legendText = (v: string) => <span style={{ color: '#e5e7eb', fontSize: 12 }}>{v}</span>;

function formatMonth(ym: string): string {
  try {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
  } catch { return ym; }
}

function formatDur(mins: number): string {
  if (mins < 1) return '< 1ד׳';
  if (mins < 60) return `${mins}ד׳`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}ש׳ ${m}ד׳` : `${h}ש׳`;
}

function statusColor(s: string): string {
  return s === 'active' ? C.green : s === 'paused' ? C.orange : s === 'ended' ? C.red : s === 'archived' ? C.slate : s === 'draft' ? C.blue : '#8892b0';
}

function typeColor(t: string): string {
  return t === 'wedding' ? C.pink : t === 'party' ? C.orange : t === 'brit' ? C.blue : t === 'bar_mitzvah' ? C.purple : t === 'corporate' ? C.green : t === 'meetup' ? C.cyan : C.slate;
}

/* ═══════════════════════════════════════
   Main component
   ═══════════════════════════════════════ */
export default function GlobalAnalyticsView() {
  const [data, setData] = useState<GlobalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    adminFetch('/api/admin/global-analytics')
      .then(async res => { if (res.ok) setData(await res.json()); else setError('שגיאה בטעינת אנליטיקס'); })
      .catch(() => setError('שגיאת תקשורת'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="ad-root admin-animate-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ─── Header ─── */}
      <div className="admin-topbar" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="admin-topbar__title">📊 אנליטיקס כללי</h2>
          <p className="admin-topbar__subtitle">סטטיסטיקות חוצות אירועים</p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={loadData} disabled={loading}>🔄 רענון</button>
      </div>

      {loading && <div className="ad-empty-state"><div className="ad-empty-state__icon">⏳</div><p className="ad-empty-state__text">טוען אנליטיקס…</p></div>}
      {error && !loading && <div className="ad-empty-state"><div className="ad-empty-state__icon">⚠️</div><p className="ad-empty-state__text">{error}</p><button className="admin-btn admin-btn--primary" onClick={loadData}>נסה שוב</button></div>}

      {data && !loading && <AnalyticsContent d={data} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   Content (extracted to keep main lean)
   ═══════════════════════════════════════ */
function AnalyticsContent({ d }: { d: GlobalAnalytics }) {
  /* ── Derived chart data ── */
  const statusData = Object.entries(d.eventsByStatus).map(([key, value]) => ({
    name: EVENT_STATUS_LABELS[key] || key, value, color: statusColor(key),
  }));

  const typeData = Object.entries(d.eventsByType)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      label: `${EVENT_TYPE_ICONS[key] || '📌'} ${EVENT_TYPE_LABELS[key] || key}`, value, fill: typeColor(key),
    }));

  const genderData = [
    { name: 'גברים', value: d.totalMen, color: C.blue },
    { name: 'נשים', value: d.totalWomen, color: C.pink },
  ].filter(x => x.value > 0);

  const msgTypeData = d.messageTypes.filter(x => x.count > 0).map(x => ({
    name: x.type, value: x.count,
    color: x.type === 'טקסט' ? C.blue : x.type === 'תמונה' ? C.green : C.orange,
  }));

  const funnelData = [
    { step: 'הצטרפו', value: d.funnel.joined, color: C.indigo },
    { step: 'מילאו פרופיל', value: d.funnel.setupProfile, color: C.blue },
    { step: 'שלחו לייק', value: d.funnel.sentFirstLike, color: C.cyan },
    { step: 'קיבלו התאמה', value: d.funnel.gotMatch, color: C.green },
    { step: 'שלחו הודעה', value: d.funnel.sentFirstMessage, color: C.orange },
    { step: 'צ׳אטרים פעילים', value: d.funnel.activeChatter, color: C.pink },
  ];

  const eventsMonthData = d.eventsCreatedByMonth.map(m => ({ month: formatMonth(m.month), count: m.count }));
  const participantsMonthData = d.participantsJoinedByMonth.map(m => ({ month: formatMonth(m.month), count: m.count }));
  const engMonthData = d.engagementByMonth.map(m => ({ month: formatMonth(m.month), לייקים: m.likes, הודעות: m.messages }));
  const peakData = d.peakHours.filter(h => h.count > 0);
  const ageData = d.ageDistribution.filter(a => a.count > 0);

  const engRadar = [
    { metric: 'התאמות', value: d.overallMatchRate },
    { metric: 'תגובות', value: d.overallResponseRate },
    { metric: 'תמונות', value: d.overallPhotoRate },
    { metric: 'צפייה בלייקים', value: d.overallLikeSeenRate },
    { metric: 'חסימות(הפוך)', value: Math.max(0, 100 - d.overallBlockRate) },
    { metric: 'גוסטינג(הפוך)', value: Math.max(0, 100 - d.overallGhostRate) },
  ];

  return (
    <>
      {/* ════════════ KPI Row ════════════ */}
      <div className="ad-kpi-grid">
        <KPI icon="📋" value={fmt(d.totalEvents)} label="אירועים" sub={`${d.activeEvents} פעילים · ${d.archivedEvents} בארכיון`} accent="accent" />
        <KPI icon="👥" value={fmt(d.totalParticipants)} label="משתתפים" sub={`♂ ${d.avgMenPct}%  ·  ♀ ${d.avgWomenPct}%`} accent="blue" />
        <KPI icon="💘" value={fmt(d.totalMatches)} label="התאמות" sub={`שיעור: ${d.overallMatchRate}%`} accent="green" />
        <KPI icon="✉️" value={fmt(d.totalMessages)} label="הודעות" sub={`${d.avgMessagesPerEvent} ממוצע/אירוע`} accent="purple" />
        <KPI icon="❤️" value={fmt(d.totalLikes)} label="לייקים" sub={`${d.avgLikesPerEvent} ממוצע/אירוע`} accent="pink" />
        <KPI icon="📸" value={`${d.overallPhotoRate}%`} label="שיעור תמונות" sub={`${fmt(d.totalPhotos)} תמונות`} accent="orange" />
      </div>

      {/* ════════════ Events Distribution ════════════ */}
      <Section icon="📊" title="פילוח אירועים">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">לפי סטטוס</h4>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                    {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={legendText} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">לפי סוג</h4>
            {typeData.length > 0 ? (
              <HBarList items={typeData.map(t => ({ label: t.label, value: t.value, color: t.fill }))} max={Math.max(...typeData.map(t => t.value))} />
            ) : <Empty />}
          </div>
        </div>
      </Section>

      {/* ════════════ Gender & Attraction ════════════ */}
      <Section icon="👫" title="מגדר ומשיכה">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">חלוקה מגדרית</h4>
            {genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                    {genderData.map((g, i) => <Cell key={i} fill={g.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={legendText} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">מפת משיכה</h4>
            {d.attractionBreakdown.length > 0 ? (
              <HBarList
                items={d.attractionBreakdown.map((a, i) => ({
                  label: a.label, value: a.count,
                  color: [C.blue, C.pink, C.purple, C.orange, C.green, C.cyan][i % 6],
                }))}
                max={Math.max(...d.attractionBreakdown.map(a => a.count))}
              />
            ) : <Empty />}
          </div>
        </div>
      </Section>

      {/* ════════════ Engagement Radar ════════════ */}
      <Section icon="🎯" title="מדד מעורבות כולל">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">רדאר בריאות הפלטפורמה</h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={engRadar} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke="#2d3348" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#8b92a5', fontSize: 12 }} />
                <Radar name="%" dataKey="value" stroke={C.indigo} fill={C.indigo} fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: C.indigo }} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">מדדים מרכזיים</h4>
            <div className="ad-stat-list">
              <StatRow label="שיעור התאמה" value={`${d.overallMatchRate}%`} bar={d.overallMatchRate} barColor={C.green} />
              <StatRow label="שיעור תגובה" value={`${d.overallResponseRate}%`} bar={d.overallResponseRate} barColor={C.blue} />
              <StatRow label="שיעור גוסטינג" value={`${d.overallGhostRate}%`} bar={d.overallGhostRate} barColor={C.orange} />
              <StatRow label="לייקים נצפו" value={`${d.overallLikeSeenRate}%`} bar={d.overallLikeSeenRate} barColor={C.cyan} />
              <StatRow label="שיעור חסימות" value={`${d.overallBlockRate}%`} bar={d.overallBlockRate} barColor={C.red} />
              <StatRow label="שיעור תמונות" value={`${d.overallPhotoRate}%`} bar={d.overallPhotoRate} barColor={C.green} />
              {d.photoImpactDelta > 0 && (
                <StatRow label="📸 השפעת תמונה" value={`+${d.photoImpactDelta} לייקים`} valueColor={C.green} />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════ User Funnel ════════════ */}
      <Section icon="🔽" title="משפך המשתמש (כלל-אירועים)">
        <div className="ad-chart-card ad-chart-card--hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {funnelData.map((step, i) => {
              const pct = d.funnel.joined > 0 ? Math.round((step.value / d.funnel.joined) * 100) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 130, fontSize: 13, color: '#c7cad8', textAlign: 'right' }}>{step.step}</span>
                  <div style={{ flex: 1, height: 28, background: '#1e2235', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: step.color, borderRadius: 6, transition: 'width 0.6s ease', minWidth: step.value > 0 ? 24 : 0 }} />
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      {fmt(step.value)} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ════════════ Timing KPIs ════════════ */}
      <Section icon="⏱" title="מדדי זמן">
        <div className="ad-kpi-grid ad-kpi-grid--4">
          <KPI value={formatDur(d.avgTimeToFirstLikeMinutes)} label="זמן ללייק ראשון" sub="מהצטרפות" accent="pink" />
          <KPI value={formatDur(d.avgTimeToFirstMessageMinutes)} label="זמן להודעה ראשונה" sub="מהתאמה" accent="blue" />
          <KPI value={`${d.avgResponseTimeMinutes}ד׳`} label="זמן תגובה ממוצע" sub="בין הודעות" accent="green" />
        </div>
      </Section>

      {/* ════════════ Per-Event Averages ════════════ */}
      <Section icon="📈" title="ממוצעים לאירוע">
        <div className="ad-kpi-grid">
          <KPI icon="👥" value={String(d.avgParticipantsPerEvent)} label="משתתפים" accent="blue" />
          <KPI icon="❤️" value={String(d.avgLikesPerEvent)} label="לייקים" accent="pink" />
          <KPI icon="💘" value={String(d.avgMatchesPerEvent)} label="התאמות" accent="green" />
          <KPI icon="💬" value={String(d.avgConversationsPerEvent)} label="שיחות" accent="purple" />
          <KPI icon="✉️" value={String(d.avgMessagesPerEvent)} label="הודעות" accent="blue" />
          <KPI icon="🚫" value={String(d.avgBlocksPerEvent)} label="חסימות" accent="red" />
        </div>
      </Section>

      {/* ════════════ Growth Timeline ════════════ */}
      {(eventsMonthData.length > 1 || participantsMonthData.length > 1) && (
        <Section icon="📅" title="צמיחה לאורך זמן">
          <div className="ad-grid-2">
            {eventsMonthData.length > 1 && (
              <div className="ad-chart-card">
                <h4 className="ad-chart-card__title">אירועים חדשים לפי חודש</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={eventsMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGradEv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.indigo} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.indigo} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: '#8b92a5', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b92a5', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="אירועים" stroke={C.indigo} fill="url(#gGradEv)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: C.indigo }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {participantsMonthData.length > 1 && (
              <div className="ad-chart-card">
                <h4 className="ad-chart-card__title">משתתפים חדשים לפי חודש</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={participantsMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGradPart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: '#8b92a5', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b92a5', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="משתתפים" stroke={C.blue} fill="url(#gGradPart)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: C.blue }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ════════════ Engagement Over Time ════════════ */}
      {engMonthData.length > 1 && (
        <Section icon="📈" title="מעורבות לאורך זמן">
          <div className="ad-chart-card ad-chart-card--hero">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={engMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gGradLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.pink} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={C.pink} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGradMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#8b92a5', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8b92a5', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="לייקים" stroke={C.pink} fill="url(#gGradLikes)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="הודעות" stroke={C.blue} fill="url(#gGradMsgs)" strokeWidth={2} dot={false} />
                <Legend formatter={legendText} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ════════════ Age Distribution ════════════ */}
      {ageData.length > 0 && (
        <Section icon="🎂" title="התפלגות גיל">
          <div className="ad-chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBarAge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={1} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: '#8b92a5', fontSize: 12 }} />
                <YAxis tick={{ fill: '#8b92a5', fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="משתתפים" fill="url(#gBarAge)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ════════════ Peak Hours ════════════ */}
      {peakData.length > 0 && (
        <Section icon="🕐" title="שעות שיא (ישראל)">
          <div className="ad-chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#8b92a5', fontSize: 11 }} interval={1} />
                <YAxis tick={{ fill: '#8b92a5', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="פעולות" fill={C.orange} radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ════════════ Messages & Blocks ════════════ */}
      <div className="ad-grid-3">
        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">✉️ סוגי הודעות</h4>
          {msgTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={msgTypeData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                  {msgTypeData.map((m, i) => <Cell key={i} fill={m.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={legendText} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
          <div className="ad-stat-list" style={{ marginTop: 8 }}>
            <StatRow label="סה״כ הודעות" value={fmt(d.totalMessages)} highlight />
          </div>
        </div>

        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">🚫 חסימות</h4>
          {d.blockReasons.length > 0 ? (
            <HBarList
              items={d.blockReasons.map(b => ({
                label: b.reason, value: b.count,
                color: b.reason.includes('שיחה') ? C.orange : b.reason.includes('לייק') ? C.blue : C.slate,
              }))}
              max={Math.max(...d.blockReasons.map(b => b.count))}
            />
          ) : <Empty />}
          <div className="ad-stat-list" style={{ marginTop: 8 }}>
            <StatRow label="סה״כ חסימות" value={fmt(d.totalBlocks)} valueColor={C.red} />
          </div>
        </div>

        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">📸 תמונות</h4>
          <div className="ad-stat-list">
            <StatRow label="תמונות" value={fmt(d.totalPhotos)} />
            <StatRow label="שיעור תמונות" value={`${d.overallPhotoRate}%`} bar={d.overallPhotoRate} barColor={C.green} />
            {d.photoImpactDelta > 0 && <StatRow label="השפעת תמונה" value={`+${d.photoImpactDelta} לייקים`} valueColor={C.green} />}
          </div>
        </div>
      </div>

      {/* ════════════ Top Events ════════════ */}
      <Section icon="🏆" title="אירועים מובילים">
        <div className="ad-grid-3">
          <LeaderboardCard title="👥 משתתפים" items={d.topEventsByParticipants} />
          <LeaderboardCard title="❤️ לייקים" items={d.topEventsByLikes} />
          <LeaderboardCard title="✉️ הודעות" items={d.topEventsByMessages} />
        </div>
        <div className="ad-grid-2" style={{ marginTop: 12 }}>
          <LeaderboardCard title="💘 שיעור התאמה (%)" items={d.topEventsByMatchRate} suffix="%" />
          <LeaderboardCard title="⚡ מעורבות" items={d.topEventsByEngagement} />
        </div>
      </Section>

      {/* ════════════ Event Comparison Table ════════════ */}
      {d.eventComparison.length > 0 && (
        <Section icon="📋" title="טבלת השוואת אירועים">
          <div className="ad-chart-card" style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>אירוע</th>
                  <th>סטטוס</th>
                  <th>משתתפים</th>
                  <th>לייקים</th>
                  <th>התאמות</th>
                  <th>% התאמה</th>
                  <th>שיחות</th>
                  <th>הודעות</th>
                  <th>חסימות</th>
                </tr>
              </thead>
              <tbody>
                {d.eventComparison.map(e => (
                  <tr key={e.eventId}>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {EVENT_TYPE_ICONS[e.eventType] || '📌'} {e.name}
                    </td>
                    <td><span style={{ color: statusColor(e.status), fontWeight: 600 }}>{EVENT_STATUS_LABELS[e.status] || e.status}</span></td>
                    <td>{fmt(e.participants)}</td>
                    <td>{fmt(e.likes)}</td>
                    <td>{fmt(e.matches)}</td>
                    <td>{e.matchRate}%</td>
                    <td>{fmt(e.conversations)}</td>
                    <td>{fmt(e.messages)}</td>
                    <td>{fmt(e.blocks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

/* ═══════════════════════════════
   Tiny helper components
   (same pattern as AnalyticsDashboard)
   ═══════════════════════════════ */

function KPI({ icon, value, label, sub, accent }: {
  icon?: string; value: string; label: string; sub?: string;
  accent?: 'accent' | 'green' | 'blue' | 'purple' | 'pink' | 'orange' | 'red' | 'cyan';
}) {
  return (
    <div className={`ad-kpi${accent ? ` ad-kpi--${accent}` : ''}`}>
      {icon && <div className="ad-kpi__icon">{icon}</div>}
      <div className="ad-kpi__value">{value}</div>
      <div className="ad-kpi__label">{label}</div>
      {sub && <div className="ad-kpi__sub">{sub}</div>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="ad-section">
      <h3 className="ad-section__title"><span className="ad-section__icon">{icon}</span>{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value, valueColor, highlight, bar, barColor }: {
  label: string; value: string; valueColor?: string; highlight?: boolean;
  bar?: number; barColor?: string;
}) {
  return (
    <div className={`ad-stat-row${highlight ? ' ad-stat-row--highlight' : ''}`}>
      <span className="ad-stat-row__label">{label}</span>
      <span className="ad-stat-row__value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
      {typeof bar === 'number' && (
        <div className="ad-progress">
          <div className="ad-progress__track">
            <div className="ad-progress__fill" style={{ width: `${Math.min(bar, 100)}%`, background: barColor || C.indigo }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <div className="ad-empty">אין נתונים</div>;
}

function HBarList({ items, max }: { items: { label: string; value: number; color: string }[]; max: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {items.map((item, i) => {
        const pct = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0) : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ minWidth: 130, fontSize: 14, fontWeight: 500, color: '#e2e8f0', textAlign: 'right', flexShrink: 0 }}>{item.label}</span>
            <div style={{ flex: 1, height: 22, background: '#1e2235', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ minWidth: 28, fontSize: 13, color: '#94a3b8', textAlign: 'left', flexShrink: 0 }}>{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardCard({ title, items, suffix }: { title: string; items: EventRankItem[]; suffix?: string }) {
  if (items.length === 0) return (
    <div className="ad-chart-card">
      <h4 className="ad-chart-card__title">{title}</h4>
      <Empty />
    </div>
  );

  const maxVal = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="ad-chart-card">
      <h4 className="ad-chart-card__title">{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {items.map((item, i) => {
          const icon = EVENT_TYPE_ICONS[item.eventType] || '📌';
          const pct = Math.round((item.value / maxVal) * 100);
          return (
            <div key={item.eventId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, fontSize: 13, color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>#{i + 1}</span>
              <span style={{ minWidth: 100, maxWidth: 140, fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                {icon} {item.name}
              </span>
              <div style={{ flex: 1, height: 18, background: '#1e2235', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: C.indigo, borderRadius: 5, transition: 'width 0.5s ease', minWidth: item.value > 0 ? 12 : 0 }} />
              </div>
              <span style={{ minWidth: 36, fontSize: 12, color: '#94a3b8', textAlign: 'left', fontWeight: 600 }}>
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}{suffix || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
