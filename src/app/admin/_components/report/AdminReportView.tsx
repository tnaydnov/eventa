'use client';

import { useState, useEffect } from 'react';
import type { Event } from '@/lib/database.types';
import type { CuratedReportPayload } from '@/lib/report/curate';

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

export default function AdminReportView({ events, initialEventId }: AdminReportViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId ?? '');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [resending, setResending] = useState(false);
  const [togglingSendReport, setTogglingSendReport] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter to ended/archived events only
  const eligibleEvents = events.filter(
    (e) => e.status === 'ended' || e.status === 'archived'
  );

  useEffect(() => {
    if (!selectedEventId) {
      setReport(null);
      return;
    }
    fetchReport(selectedEventId);
  }, [selectedEventId]);

  async function fetchReport(eventId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) {
          setReport(null);
        } else {
          throw new Error('שגיאת שרת');
        }
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
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('שגיאה ביצירת הדוח');
      await fetchReport(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendNow(email?: string) {
    if (!selectedEventId) return;
    setSendingNow(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${selectedEventId}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה בשליחת הדוח');
      }
      await fetchReport(selectedEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setSendingNow(false);
    }
  }

  async function handleResendToOtherEmail() {
    if (!resendEmail.trim()) {
      setError('יש להזין אימייל לשליחה מחדש');
      return;
    }
    setResending(true);
    try {
      await handleSendNow(resendEmail.trim());
      setResendEmail('');
    } finally {
      setResending(false);
    }
  }

  async function handleToggleSendReportEmail(nextValue: boolean) {
    if (!selectedEventId) return;
    setTogglingSendReport(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_report_email: nextValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה בעדכון ההגדרה');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setTogglingSendReport(false);
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const sendReportEnabled = selectedEvent?.send_report_email ?? true;

  // When embedded in event detail for a non-ended event, show an informative message
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

      {/* Event picker — hidden when a specific event is pre-selected */}
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

      {error && (
        <div className="admin-alert admin-alert--error">{error}</div>
      )}

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
        <div>
          <div className="admin-card" style={{ marginBottom: '20px' }}>
            <h3 className="admin-card__title">בקרת דוח</h3>
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '13px', marginBottom: '10px' }}>
              עודכן: {new Date(report.generated_at).toLocaleString('he-IL')}
              {report.email_sent_at ? ` | נשלח: ${new Date(report.email_sent_at).toLocaleString('he-IL')}` : ' | טרם נשלח'}
              {report.email_sent_to ? ` | יעד: ${report.email_sent_to}` : ''}
            </p>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={sendReportEnabled}
                disabled={togglingSendReport}
                onChange={(e) => handleToggleSendReportEmail(e.target.checked)}
              />
              <span style={{ fontSize: '13px' }}>שליחת דוח אוטומטית במייל</span>
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <button
                className="admin-btn admin-btn--ghost"
                onClick={handleGenerate}
                disabled={generating}
                style={{ fontSize: '13px' }}
              >
                {generating ? 'מחדש...' : 'Regenerate AI summary'}
              </button>
              <button
                className="admin-btn admin-btn--primary"
                onClick={() => handleSendNow()}
                disabled={sendingNow}
                style={{ fontSize: '13px' }}
              >
                {sendingNow ? 'שולח...' : 'Send now'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '420px' }}>
              <input
                className="admin-input"
                style={{ flex: 1 }}
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="אימייל חלופי לשליחה מחדש"
              />
              <button
                className="admin-btn admin-btn--ghost"
                onClick={handleResendToOtherEmail}
                disabled={resending || !resendEmail.trim()}
                style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                {resending ? 'שולח...' : 'Resend to email'}
              </button>
            </div>
          </div>

          {/* AI Summary */}
          {report.ai_summary && (
            <div className="admin-card" style={{ marginBottom: '20px' }}>
              <h3 className="admin-card__title">סיכום AI</h3>
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                {report.ai_summary}
              </p>
            </div>
          )}

          {/* Key numbers */}
          <div className="admin-card" style={{ marginBottom: '20px' }}>
            <h3 className="admin-card__title">מדדים מרכזיים</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              <StatCard label="משתתפים" value={report.curated_payload.network.total_participants} />
              <StatCard label="לייקים" value={report.curated_payload.engagement.total_likes} />
              <StatCard label="התאמות" value={report.curated_payload.engagement.mutual_likes} />
              <StatCard
                label="אחוז התאמות"
                value={`${report.curated_payload.engagement.match_rate.toFixed(1)}%`}
              />
              <StatCard label="שיחות" value={report.curated_payload.engagement.total_conversations} />
              <StatCard label="הודעות" value={report.curated_payload.engagement.total_messages} />
              <StatCard label="מבודדים" value={report.curated_payload.network.isolated_participants} />
            </div>
          </div>

          {/* Funnel */}
          {report.curated_payload.funnel?.steps?.length > 0 && (
            <div className="admin-card">
              <h3 className="admin-card__title">משפך הצטרפות</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {report.curated_payload.funnel.steps.map((step) => {
                  const maxCount = report.curated_payload.funnel.steps[0]?.count ?? 1;
                  const pct = maxCount > 0 ? ((step.count / maxCount) * 100).toFixed(0) : 0;
                  return (
                    <div key={step.step}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--admin-text-muted)' }}>{step.step}</span>
                        <span style={{ fontWeight: 600 }}>{step.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--admin-border)', borderRadius: '3px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: 'var(--admin-accent)',
                            borderRadius: '3px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--admin-surface-2, var(--admin-surface))',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin-accent)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}
