'use client';

import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { EventAnalytics } from '../shared';

/* ─── Color palette ─── */
const C = {
  indigo: '#6366f1',
  pink: '#ec4899',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#a855f7',
  cyan: '#06b6d4',
  red: '#ef4444',
  slate: '#64748b',
};

/* ─── Custom tooltip for dark theme ─── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ad-tooltip">
      {label && <div className="ad-tooltip__label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="ad-tooltip__row">
          <span className="ad-tooltip__dot" style={{ background: p.fill || p.color || p.payload?.color }} />
          <span className="ad-tooltip__name">{p.name || p.payload?.name}</span>
          <span className="ad-tooltip__val">
            {typeof p.value === 'number' ? p.value.toLocaleString('he-IL') : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('he-IL');

function formatDur(secs: number): string {
  if (secs < 60) return `${secs}ש׳`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}ד׳ ${s}ש׳` : `${m}ד׳`;
}

/* ─── Legend text renderer ─── */
const legendText = (v: string) => (
  <span style={{ color: '#e5e7eb', fontSize: 12 }}>{v}</span>
);

interface Props {
  analytics: EventAnalytics;
}

export default function AnalyticsDashboard({ analytics: a }: Props) {
  /* ── Derived metrics ── */
  const peakUsers = a.usageTimeline.length > 0
    ? Math.max(...a.usageTimeline.map(u => u.totalOnline)) : 0;
  const photoRate = a.totalParticipants > 0
    ? Math.round((a.participantsWithPhotos / a.totalParticipants) * 100) : 0;
  const compassConvRate = a.compassRequestsSent > 0
    ? Math.round((a.compassSessionsActivated / a.compassRequestsSent) * 100) : 0;
  const menPct = a.totalParticipants > 0
    ? Math.round((a.totalMen / a.totalParticipants) * 100) : 0;
  const womenPct = a.totalParticipants > 0
    ? Math.round((a.totalWomen / a.totalParticipants) * 100) : 0;
  const likeSeenPct = a.totalLikes > 0
    ? Math.round((a.likesSeenCount / a.totalLikes) * 100) : 0;
  const matchToConvoPct = a.totalMatches > 0
    ? Math.round((a.matchesToConversation / a.totalMatches) * 100) : 0;

  /* ── Chart data ── */
  const genderData = [
    { name: 'גברים', value: a.totalMen, color: C.blue },
    { name: 'נשים', value: a.totalWomen, color: C.pink },
  ].filter(d => d.value > 0);

  const attractionData = [
    { label: 'גברים ← נשים', value: a.menAttractedToWomen, fill: C.blue },
    { label: 'נשים ← גברים', value: a.womenAttractedToMen, fill: C.pink },
    { label: 'גברים ← גברים', value: a.menAttractedToMen, fill: C.purple },
    { label: 'נשים ← נשים', value: a.womenAttractedToWomen, fill: C.orange },
    { label: 'גברים ← הכל', value: a.menAttractedToAll, fill: C.green },
    { label: 'נשים ← הכל', value: a.womenAttractedToAll, fill: C.cyan },
  ].filter(d => d.value > 0);

  const timelineData = a.usageTimeline.map(u => ({
    time: new Date(u.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    כולם: u.totalOnline,
    גברים: u.menOnline,
    נשים: u.womenOnline,
  }));

  const ageData = a.ageDistribution.map(d => ({ range: d.range, count: d.count }));

  const firstLikeData = [
    { name: 'גברים', value: a.firstLikeByGender.men, color: C.blue },
    { name: 'נשים', value: a.firstLikeByGender.women, color: C.pink },
  ].filter(d => d.value > 0);

  const blockReasonsData = [
    { label: 'אחרי שיחה', value: a.blocksAfterConversation, fill: C.orange },
    { label: 'אחרי לייק', value: a.blocksAfterLike, fill: C.blue },
    { label: 'ללא אינטראקציה', value: a.blocksWithNoInteraction, fill: C.slate },
  ].filter(d => d.value > 0);

  const usageByGAData = a.usageByGenderAttraction.map(g => ({
    group: g.group,
    interactions: g.avgInteractions,
  }));

  const funnelData = [
    { step: 'הצטרפו', value: a.funnel.joined, color: C.indigo },
    { step: 'מילאו פרופיל', value: a.funnel.setupProfile, color: C.blue },
    { step: 'שלחו לייק', value: a.funnel.sentFirstLike, color: C.cyan },
    { step: 'קיבלו התאמה', value: a.funnel.gotMatch, color: C.green },
    { step: 'שלחו הודעה', value: a.funnel.sentFirstMessage, color: C.orange },
    { step: 'צ׳אטרים פעילים', value: a.funnel.activeChatter, color: C.pink },
  ];

  const msgTypeData = [
    { name: 'טקסט', value: a.textMessages, color: C.blue },
    { name: 'תמונה', value: a.imageMessages, color: C.green },
    { name: 'אודיו', value: a.audioMessages, color: C.orange },
  ].filter(d => d.value > 0);

  /* Engagement radar (normalized 0–100) */
  const engagementData = [
    { metric: 'לייקים', value: a.totalParticipants > 0 ? Math.min(Math.round(a.totalLikes / a.totalParticipants * 25), 100) : 0 },
    { metric: 'התאמות', value: a.matchRate },
    { metric: 'שיחות', value: a.totalParticipants > 0 ? Math.min(Math.round(a.totalConversations / a.totalParticipants * 50), 100) : 0 },
    { metric: 'מצפן', value: compassConvRate },
    { metric: 'תמונות', value: photoRate },
    { metric: 'הודעות', value: a.totalConversations > 0 ? Math.min(Math.round(a.avgMessagesPerConversation * 10), 100) : 0 },
  ];

  /* ── Empty state ── */
  if (a.totalParticipants === 0) {
    return (
      <div className="ad-root">
        <div className="ad-empty-state">
          <div className="ad-empty-state__icon">📊</div>
          <h3 className="ad-empty-state__title">אין נתונים עדיין</h3>
          <p className="ad-empty-state__text">כשמשתתפים יצטרפו לאירוע, האנליטיקס יתחילו להופיע כאן.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-root">
      {/* ════════════ KPI Row ════════════ */}
      <div className="ad-kpi-grid">
        <KPI icon="👥" value={fmt(a.totalParticipants)} label="משתתפים" sub={`♂ ${a.totalMen} (${menPct}%)  ·  ♀ ${a.totalWomen} (${womenPct}%)`} accent="accent" />
        <KPI icon="💘" value={fmt(a.totalMatches)} label="התאמות הדדיות" sub={`שיעור: ${a.matchRate}%`} accent="green" />
        <KPI icon="💬" value={fmt(a.totalConversations)} label="שיחות" sub={`${a.avgMessagesPerConversation} הודעות/שיחה`} accent="blue" />
        <KPI icon="✉️" value={fmt(a.totalMessages)} label="הודעות" accent="purple" />
        <KPI icon="❤️" value={fmt(a.totalLikes)} label="לייקים" sub={`♂ ${a.likeSentByMen}  ·  ♀ ${a.likeSentByWomen}`} accent="pink" />
        <KPI icon="📈" value={String(peakUsers)} label="שיא מחוברים" accent="orange" />
      </div>

      {/* ════════════ Gender & Attraction ════════════ */}
      <Section icon="👫" title="מגדר ומשיכה">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">חלוקה מגדרית</h4>
            {genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={58} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                    {genderData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={legendText} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">מפת משיכה</h4>
            {attractionData.length > 0 ? (
              <HBarList items={attractionData.map(d => ({ label: d.label, value: d.value, color: d.fill }))} max={Math.max(...attractionData.map(d => d.value))} />
            ) : <Empty />}
          </div>
        </div>
      </Section>

      {/* ════════════ Mutual Attraction Heatmap ════════════ */}
      {a.mutualAttractionMatrix.length > 0 && (
        <Section icon="🔥" title="מטריצת התאמות הדדיות">
          <div className="ad-chart-card">
            <HBarList
              items={a.mutualAttractionMatrix.map(d => ({
                label: d.fromGroup === d.toGroup ? d.fromGroup : `${d.fromGroup} ↔ ${d.toGroup}`,
                value: d.matches,
                color: C.indigo,
              }))}
              max={Math.max(...a.mutualAttractionMatrix.map(d => d.matches))}
            />
          </div>
        </Section>
      )}

      {/* ════════════ Usage Timeline ════════════ */}
      {timelineData.length > 1 && (
        <Section icon="📈" title="פעילות לאורך האירוע">
          <div className="ad-chart-card ad-chart-card--hero">
            <h4 className="ad-chart-card__title">משתמשים מחוברים לאורך זמן</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWomen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.pink} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.pink} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#8b92a5', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#8b92a5', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="כולם" stroke={C.indigo} fill="url(#gradTotal)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: C.indigo }} />
                <Area type="monotone" dataKey="גברים" stroke={C.blue} fill="url(#gradMen)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: C.blue }} />
                <Area type="monotone" dataKey="נשים" stroke={C.pink} fill="url(#gradWomen)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: C.pink }} />
                <Legend formatter={legendText} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ════════════ Engagement Radar ════════════ */}
      <Section icon="🎯" title="מדד מעורבות">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">רדאר אינטראקציה</h4>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={engagementData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke="#2d3348" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#8b92a5', fontSize: 12 }} />
                <Radar name="מעורבות %" dataKey="value" stroke={C.indigo} fill={C.indigo} fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: C.indigo }} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">מדדים מרכזיים</h4>
            <div className="ad-stat-list">
              <StatRow label="שיעור התאמה (מתוך זוגות)" value={`${a.matchRate}%`} bar={a.matchRate} barColor={C.green} />
              <StatRow label="ממוצע הודעות לשיחה" value={String(a.avgMessagesPerConversation)} />
              <StatRow label="שיעור העלאת תמונות" value={`${photoRate}%`} bar={photoRate} barColor={C.green} />
              <StatRow label="שיעור המרת מצפן" value={`${compassConvRate}%`} bar={compassConvRate} barColor={C.cyan} />
              <StatRow label="שיא מחוברים בו-זמנית" value={String(peakUsers)} />
              <StatRow label="לייקים שנצפו" value={`${likeSeenPct}%`} bar={likeSeenPct} barColor={C.orange} />
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════ Likes & Matches ════════════ */}
      <Section icon="❤️" title="לייקים והתאמות">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">מי שלח לייק ראשון</h4>
            {firstLikeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={firstLikeData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                    {firstLikeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={legendText} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">פירוט לייקים</h4>
            <div className="ad-stat-list">
              <StatRow label="סה״כ לייקים" value={fmt(a.totalLikes)} />
              <StatRow label="♂ לייקים מגברים" value={fmt(a.likeSentByMen)} valueColor={C.blue} />
              <StatRow label="♀ לייקים מנשים" value={fmt(a.likeSentByWomen)} valueColor={C.pink} />
              <StatRow label="💘 התאמות הדדיות" value={fmt(a.totalMatches)} valueColor={C.green} highlight />
              <StatRow label="ממוצע לייקים למשתתף" value={String(a.avgLikesPerParticipant)} />
              <StatRow label="👁 לייקים שנצפו" value={`${fmt(a.likesSeenCount)} (${likeSeenPct}%)`} />
              <StatRow label="🙈 לייקים שלא נצפו" value={fmt(a.likesUnseenCount)} />
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════ Most Popular ════════════ */}
      {a.mostPopular.length > 0 && (
        <Section icon="👑" title="הפופולריים ביותר">
          <div className="ad-chart-card">
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {a.mostPopular.map((p, i) => (
                <div key={i} style={{
                  textAlign: 'center', padding: '16px 24px', background: '#1e2235',
                  borderRadius: 12, minWidth: 150, flex: '1 1 0',
                }}>
                  <div style={{ fontSize: 32 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>משתתף/ת #{p.rank}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginTop: 8 }}>{p.likesReceived}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>לייקים התקבלו</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.green, marginTop: 4 }}>{p.matchCount}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>התאמות</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ════════════ Funnel ════════════ */}
      <Section icon="🔽" title="משפך המשתמש">
        <div className="ad-chart-card ad-chart-card--hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {funnelData.map((step, i) => {
              const pct = a.funnel.joined > 0 ? Math.round((step.value / a.funnel.joined) * 100) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 120, fontSize: 13, color: '#c7cad8', textAlign: 'right' }}>{step.step}</span>
                  <div style={{ flex: 1, height: 28, background: '#1e2235', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: step.color, borderRadius: 6, transition: 'width 0.6s ease', minWidth: step.value > 0 ? 24 : 0 }} />
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      {step.value} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ════════════ Funnel Timing ════════════ */}
      <Section icon="⏳" title="תזמון המשפך">
        <div className="ad-kpi-grid">
          <KPI value={`${a.funnelTiming.avgJoinToFirstLikeMinutes}ד׳`} label="הצטרפות ← לייק" sub="זמן ממוצע" accent="pink" />
          <KPI value={`${a.funnelTiming.avgFirstLikeToMatchMinutes}ד׳`} label="לייק ← התאמה" sub="זמן ממוצע" accent="green" />
          <KPI value={`${a.funnelTiming.avgMatchToFirstMessageMinutes}ד׳`} label="התאמה ← הודעה" sub="זמן ממוצע" accent="blue" />
        </div>
      </Section>

      {/* ════════════ Match Quality ════════════ */}
      <Section icon="💎" title="איכות התאמות">
        <div className="ad-kpi-grid ad-kpi-grid--4">
          <KPI value={`${a.matchRate}%`} label="שיעור התאמה" sub="מתוך זוגות לייקים" accent="green" />
          <KPI value={fmt(a.matchesToConversation)} label="התאמות ← שיחה" sub={`${matchToConvoPct}%`} accent="blue" />
          <KPI value={fmt(a.deadMatches)} label="התאמות מתות" sub="ללא שיחה" accent="red" />
          <KPI value={`${a.avgTimeToFirstMessageMinutes}ד׳`} label="זמן לראשונה" sub="מהתאמה להודעה" accent="purple" />
        </div>
      </Section>

      {/* ════════════ Conversations & Messages ════════════ */}
      <Section icon="💬" title="שיחות והודעות">
        <div className="ad-grid-2">
          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">סטטיסטיקות שיחה</h4>
            <div className="ad-stat-list">
              <StatRow label="סה״כ שיחות" value={fmt(a.totalConversations)} />
              <StatRow label="שיחות פעילות (2+ הודעות)" value={fmt(a.activeConversations)} valueColor={C.green} />
              <StatRow label="שיחות חד-הודעה" value={fmt(a.oneMessageConversations)} valueColor={C.orange} />
              <StatRow label="ממוצע הודעות לשיחה" value={String(a.avgMessagesPerConversation)} />
              <StatRow label="♂ פתחו שיחה ראשונים" value={fmt(a.firstMessageByMen)} valueColor={C.blue} />
              <StatRow label="♀ פתחו שיחה ראשונות" value={fmt(a.firstMessageByWomen)} valueColor={C.pink} />
              <StatRow label="📊 שיעור תגובה" value={`${a.responseRate}%`} bar={a.responseRate} barColor={C.green} />
              <StatRow label="👻 שיעור גוסטינג" value={`${a.ghostRate}% (${fmt(a.ghostedConversations)})`} valueColor={C.red} />
            </div>
          </div>

          <div className="ad-chart-card">
            <h4 className="ad-chart-card__title">סוגי הודעות</h4>
            {msgTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={msgTypeData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                    {msgTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={legendText} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
            <div className="ad-stat-list" style={{ marginTop: 8 }}>
              <StatRow label="סה״כ הודעות" value={fmt(a.totalMessages)} highlight />
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════ Timing ════════════ */}
      <Section icon="⏱" title="מדדי זמן">
        <div className="ad-kpi-grid">
          <KPI value={a.peakActivityHour} label="שעת שיא" sub={`${fmt(a.peakActivityCount)} פעולות`} accent="accent" />
          <KPI value={`${a.avgTimeToFirstLikeMinutes}ד׳`} label="זמן ללייק ראשון" sub="מהצטרפות" accent="pink" />
          <KPI value={`${a.avgTimeToFirstMessageMinutes}ד׳`} label="זמן להודעה ראשונה" sub="מהתאמה" accent="blue" />
          <KPI value={`${a.avgResponseTimeMinutes}ד׳`} label="זמן תגובה ממוצע" sub="בין הודעות" accent="green" />
          <KPI value={formatDur(a.avgCompassDurationSeconds)} label="זמן מצפן ממוצע" accent="cyan" />
          <KPI value={String(peakUsers)} label="שיא מחוברים" accent="orange" />
        </div>
      </Section>

      {/* ════════════ Age Distribution ════════════ */}
      {ageData.some(d => d.count > 0) && (
        <Section icon="📊" title="התפלגות גיל">
          <div className="ad-chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradAge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={1} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: '#8b92a5', fontSize: 12 }} />
                <YAxis tick={{ fill: '#8b92a5', fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="משתתפים" fill="url(#barGradAge)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ════════════ Secondary: Compass · Photos · Blocks ════════════ */}
      <div className="ad-grid-3">
        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">🧭 מצפן</h4>
          <div className="ad-stat-list">
            <StatRow label="בקשות שנשלחו" value={fmt(a.compassRequestsSent)} />
            <StatRow label="סשנים פעילים" value={fmt(a.compassSessionsActivated)} valueColor={C.green} />
            <StatRow label="שיעור המרה" value={`${compassConvRate}%`} bar={compassConvRate} barColor={C.cyan} />
            <StatRow label="זמן ממוצע" value={formatDur(a.avgCompassDurationSeconds)} />
          </div>
        </div>

        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">📸 תמונות</h4>
          <div className="ad-stat-list">
            <StatRow label="משתתפים עם תמונות" value={fmt(a.participantsWithPhotos)} />
            <StatRow label="שיעור העלאה" value={`${photoRate}%`} bar={photoRate} barColor={C.green} />
            <StatRow label="סה״כ תמונות" value={fmt(a.totalPhotosUploaded)} />
            <StatRow label="ממוצע למשתתף" value={String(a.avgPhotosPerParticipant)} />
            <StatRow label="📈 לייקים עם תמונה" value={String(a.photoImpact.avgLikesWithPhoto)} valueColor={C.green} />
            <StatRow label="📉 לייקים בלי תמונה" value={String(a.photoImpact.avgLikesWithoutPhoto)} valueColor={C.slate} />
          </div>
        </div>

        <div className="ad-chart-card">
          <h4 className="ad-chart-card__title">🚫 חסימות</h4>
          <div className="ad-stat-list">
            <StatRow label="סה״כ חסימות" value={fmt(a.totalBlocks)} valueColor={C.red} />
            <StatRow label="♂ חסימות מגברים" value={fmt(a.blocksByMen)} />
            <StatRow label="♀ חסימות מנשים" value={fmt(a.blocksByWomen)} />
            <StatRow label="💔 אחרי התאמה" value={`${fmt(a.blockAfterMatchCount)} (${a.blockAfterMatchRate}%)`} valueColor={C.orange} />
          </div>
        </div>
      </div>

      {/* ════════════ Block Reasons ════════════ */}
      {blockReasonsData.length > 0 && a.totalBlocks > 0 && (
        <Section icon="🔍" title="סיבת חסימה">
          <div className="ad-chart-card">
            <HBarList items={blockReasonsData.map(d => ({ label: d.label, value: d.value, color: d.fill }))} max={Math.max(...blockReasonsData.map(d => d.value))} />
          </div>
        </Section>
      )}

      {/* ════════════ Usage by Gender + Attraction ════════════ */}
      {usageByGAData.length > 0 && (
        <Section icon="⚡" title="ממוצע אינטראקציות לפי קבוצה">
          <div className="ad-chart-card">
            <HBarList items={usageByGAData.map(d => ({ label: d.group, value: d.interactions, color: C.green }))} max={Math.max(...usageByGAData.map(d => d.interactions))} />
          </div>
        </Section>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   Tiny helper components
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
      <h3 className="ad-section__title">
        <span className="ad-section__icon">{icon}</span>
        {title}
      </h3>
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
            <span style={{ minWidth: 130, fontSize: 14, fontWeight: 500, color: '#e2e8f0', textAlign: 'right', flexShrink: 0 }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: 22, background: '#1e2235', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 6, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ minWidth: 28, fontSize: 13, color: '#94a3b8', textAlign: 'left', flexShrink: 0 }}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
