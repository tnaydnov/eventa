'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CuratedReportPayload } from '@/lib/report/curate';

type ReportData = {
  curated_payload: CuratedReportPayload;
  ai_summary: string | null;
  generated_at: string;
};

type PortalResponse = {
  event: {
    id: string;
    name: string;
    slug: string;
    type: string;
    starts_at: string;
    ends_at: string;
    venue_name?: string;
  };
  report: ReportData | null;
  has_report: boolean;
};

/** A simple bar visualization (no external charting lib dependency). */
function StatBar({ value, max, color = '#D4A59A' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-white/10 rounded-full h-2 mt-1">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Stat card component. */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div className="text-2xl font-bold text-[#D4A59A]">{value}</div>
      <div className="text-sm text-white/60 mt-1">{label}</div>
      {sub && <div className="text-xs text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function PortalReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${token}/report`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'הקישור אינו תקף' : 'שגיאת שרת');
        return r.json();
      })
      .then((d: PortalResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A59A] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center px-6" dir="rtl">
        <p className="text-white text-xl">{error ?? 'הקישור אינו תקף'}</p>
      </div>
    );
  }

  const { event, report } = data;

  if (!report) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center px-6" dir="rtl">
        <div>
          <p className="text-white text-xl mb-2">הדוח עדיין לא מוכן</p>
          <p className="text-white/50 text-sm">הדוח יופק עד 12 שעות לאחר סיום האירוע</p>
        </div>
      </div>
    );
  }

  const payload = report.curated_payload;
  const { engagement, network, funnel, time_dynamics, crosstabs } = payload;

  const peakHour = time_dynamics?.peak_hour;
  const topDropOff = funnel?.top_drop_off;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{event.name}</h1>
          <p className="text-sm text-white/50">
            {new Date(event.starts_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </p>
        </div>
        <img src="/icons/Eventa_Logo.png" alt="Eventa" className="h-8 object-contain" />
      </div>

      {/* Tabs */}
      <nav className="flex border-b border-white/10 px-6">
        <Link href={`/portal/${token}`} className="px-4 py-3 text-sm font-medium text-white/50 hover:text-white transition-colors">
          סקירה כללית
        </Link>
        <Link href={`/portal/${token}/report`} className="px-4 py-3 text-sm font-medium text-[#D4A59A] border-b-2 border-[#D4A59A]">
          דוח מפורט
        </Link>
        <a
          href={`/api/portal/${token}/report/pdf`}
          className="me-auto px-4 py-3 text-sm font-medium text-white/60 hover:text-white transition-colors"
          download
        >
          הורדת PDF
        </a>
      </nav>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

        {/* AI Summary */}
        {report.ai_summary && (
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-3">סיכום האירוע</h2>
            <div className="bg-white/5 rounded-2xl p-5">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{report.ai_summary}</p>
            </div>
          </section>
        )}

        {/* Key stats */}
        <section>
          <h2 className="text-base font-semibold text-white/80 mb-3">מספרים מרכזיים</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="משתתפים" value={network.total_participants} />
            <StatCard label="לייקים" value={engagement.total_likes} />
            <StatCard label="התאמות הדדיות" value={engagement.mutual_likes} />
            <StatCard
              label="אחוז התאמות"
              value={`${engagement.match_rate.toFixed(0)}%`}
              sub={`מתוך ${network.total_participants} משתתפים`}
            />
            <StatCard label="שיחות" value={engagement.total_conversations} />
            <StatCard label="הודעות" value={engagement.total_messages} />
          </div>
        </section>

        {/* Funnel */}
        {funnel?.steps && funnel.steps.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-3">משפך הצטרפות</h2>
            <div className="bg-white/5 rounded-2xl p-4 space-y-3">
              {funnel.steps.map((step) => (
                <div key={step.step}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/50">{step.step}</span>
                    <span className="text-xs font-semibold text-white">{step.count}</span>
                  </div>
                  <StatBar value={step.count} max={funnel.steps[0]?.count ?? 1} />
                </div>
              ))}
              {topDropOff && (
                <p className="text-xs text-white/30 pt-2 border-t border-white/10">
                  נקודת הנשירה הגדולה ביותר: <span className="text-[#D4A59A]">{topDropOff}</span>
                </p>
              )}
            </div>
          </section>
        )}

        {/* Hourly activity */}
        {time_dynamics?.hourly_activity && time_dynamics.hourly_activity.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-3">
              פעילות לפי שעה
              {peakHour !== undefined && (
                <span className="text-xs text-white/40 font-normal mr-2">
                  (שיא בשעה {peakHour}:00)
                </span>
              )}
            </h2>
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-end gap-1 h-20">
                {time_dynamics.hourly_activity.map((item) => {
                  const maxCount = Math.max(...time_dynamics.hourly_activity.map((h) => h.count));
                  const heightPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={item.hour} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${Math.max(heightPct, 4)}%`,
                          background: item.hour === peakHour ? '#D4A59A' : 'rgba(255,255,255,0.2)',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-white/30">{time_dynamics.hourly_activity[0]?.hour}:00</span>
                <span className="text-xs text-white/30">
                  {time_dynamics.hourly_activity[time_dynamics.hourly_activity.length - 1]?.hour}:00
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Demographics */}
        {crosstabs && (
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-3">פילוח משתתפים</h2>
            <div className="bg-white/5 rounded-2xl p-4 space-y-4">
              {/* Gender distribution */}
              {crosstabs.gender_distribution && crosstabs.gender_distribution.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2">מגדר</p>
                  {crosstabs.gender_distribution.map((item) => (
                    <div key={item.label} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-white/60">{item.label}</span>
                        <span className="text-white/80">{item.count}</span>
                      </div>
                      <StatBar
                        value={item.count}
                        max={Math.max(...crosstabs.gender_distribution.map((g) => g.count))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {/* Age buckets */}
              {crosstabs.age_buckets && crosstabs.age_buckets.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2">קבוצות גיל</p>
                  {crosstabs.age_buckets.map((item) => (
                    <div key={item.label} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-white/60">{item.label}</span>
                        <span className="text-white/80">{item.count}</span>
                      </div>
                      <StatBar
                        value={item.count}
                        max={Math.max(...crosstabs.age_buckets.map((a) => a.count))}
                        color="#8b7ec8"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="text-xs text-white/20 text-center pb-8">
          הדוח הופק ב-{new Date(report.generated_at).toLocaleString('he-IL')}
        </p>
      </div>
    </div>
  );
}
