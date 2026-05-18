'use client';

import { useMemo, useState } from 'react';
import type { Event } from '@/lib/database.types';
import type { EventRequest } from '../shared';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/constants';
import type { AdminView } from '../Sidebar';

interface DashboardViewProps {
  events: Event[];
  requests: EventRequest[];
  onNavigate: (view: AdminView) => void;
  onViewEvent: (event: Event) => void;
  onApprove: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onDeny: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
}

const EVENT_STATUS_BADGE: Record<string, string> = {
  active: 'admin-badge--active',
  draft: 'admin-badge--draft',
  paused: 'admin-badge--paused',
  ended: 'admin-badge--ended',
  archived: 'admin-badge--archived',
};

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function shortDateOnly(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

const EVENT_TYPE_LABELS_LOCAL: Record<string, string> = {
  wedding: 'חתונה',
  party: 'מסיבה',
  meetup: 'מיטאפ',
  other: 'אחר',
  speed_dating: 'ספיד דייטינג',
  networking: 'נטוורקינג',
  singles_event: 'אירוע רווקים',
};

export default function DashboardView({
  events, requests, onNavigate, onViewEvent, onApprove, onDeny,
}: DashboardViewProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});

  /* ─── Derived stats ─── */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    return {
      total: events.length,
      active: events.filter(e => e.status === 'active').length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      todayEvents: events.filter(e => {
        const start = new Date(e.starts_at);
        return start >= todayStart && start < todayEnd;
      }).length,
      thisWeek: events.filter(e => {
        const start = new Date(e.starts_at);
        return start >= todayStart && start < weekEnd;
      }).length,
    };
  }, [events, requests]);

  /* ─── Pending requests (top 5) ─── */
  const pendingRequests = useMemo(() =>
    requests
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [requests]
  );

  /* ─── Active & upcoming events (today + this week) ─── */
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => e.status === 'active' || e.status === 'draft')
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 6);
  }, [events]);

  /* ─── Recent events (any status, by created_at desc) ─── */
  const recentEvents = useMemo(() =>
    [...events]
      .sort((a, b) => new Date(b.created_at || b.starts_at).getTime() - new Date(a.created_at || a.starts_at).getTime())
      .slice(0, 5),
    [events]
  );

  /* ─── Handlers ─── */
  const handleApprove = async (req: EventRequest) => {
    if (!confirm(`לאשר את הבקשה של ${req.contact_name}?`)) return;
    setProcessingId(req.id);
    const result = await onApprove(req.id);
    setProcessingId(null);
    if (result.ok) {
      setActionFeedback(prev => ({ ...prev, [req.id]: '✅ אושר' }));
    } else {
      setActionFeedback(prev => ({ ...prev, [req.id]: result.error || 'שגיאה' }));
    }
  };

  const handleDeny = async (req: EventRequest) => {
    if (!confirm(`לדחות את הבקשה של ${req.contact_name}?`)) return;
    setProcessingId(req.id);
    const result = await onDeny(req.id);
    setProcessingId(null);
    if (result.ok) {
      setActionFeedback(prev => ({ ...prev, [req.id]: '❌ נדחה' }));
    } else {
      setActionFeedback(prev => ({ ...prev, [req.id]: result.error || 'שגיאה' }));
    }
  };

  return (
    <div className="admin-animate-in">
      {/* Page header */}
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar__title">לוח בקרה</h2>
          <p className="admin-topbar__subtitle">סקירה כללית של המערכת</p>
        </div>
      </div>

      {/* ─── Stats row ─── */}
      <div className="dash-stats">
        <div className={`dash-stat ${stats.pendingRequests > 0 ? 'dash-stat--alert' : ''}`}>
          <div className="dash-stat__icon">📩</div>
          <div className="dash-stat__value">{stats.pendingRequests}</div>
          <div className="dash-stat__label">בקשות ממתינות</div>
        </div>

        <div className="dash-stat">
          <div className="dash-stat__icon">🟢</div>
          <div className="dash-stat__value">{stats.active}</div>
          <div className="dash-stat__label">אירועים פעילים</div>
        </div>

        <div className="dash-stat">
          <div className="dash-stat__icon">📅</div>
          <div className="dash-stat__value">{stats.thisWeek}</div>
          <div className="dash-stat__label">אירועים השבוע</div>
        </div>

        <div className="dash-stat">
          <div className="dash-stat__icon">🎉</div>
          <div className="dash-stat__value">{stats.total}</div>
          <div className="dash-stat__label">סה״כ אירועים</div>
        </div>
      </div>

      {/* ─── Two-column grid ─── */}
      <div className="dash-grid">
        {/* Pending requests */}
        <div className="dash-section">
          <div className="dash-section__head">
            <h3 className="dash-section__title">
              📩 בקשות ממתינות
              {stats.pendingRequests > 0 && (
                <span style={{
                  background: 'var(--admin-orange-dim)',
                  color: 'var(--admin-orange)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                }}>{stats.pendingRequests}</span>
              )}
            </h3>
            <button className="dash-section__link" onClick={() => onNavigate('requests')}>
              כל הבקשות →
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="dash-empty">אין בקשות ממתינות 🎉</div>
          ) : (
            pendingRequests.map(req => (
              <div key={req.id} className="dash-row">
                <div className="dash-row__icon">👤</div>
                <div className="dash-row__info">
                  <div className="dash-row__name">{req.contact_name || '-'}</div>
                  <div className="dash-row__meta">
                    {EVENT_TYPE_LABELS_LOCAL[req.event_type] || req.event_type}
                    {req.event_name && ` · ${req.event_name}`}
                    {req.starts_at && ` · ${shortDateOnly(req.starts_at)}`}
                  </div>
                </div>
                <div className="dash-row__actions">
                  {actionFeedback[req.id] ? (
                    <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{actionFeedback[req.id]}</span>
                  ) : (
                    <>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--green"
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.id}
                        title="אשר בקשה"
                      >
                        ✓
                      </button>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        onClick={() => handleDeny(req)}
                        disabled={processingId === req.id}
                        title="דחה בקשה"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming events */}
        <div className="dash-section">
          <div className="dash-section__head">
            <h3 className="dash-section__title">🎉 אירועים קרובים</h3>
            <button className="dash-section__link" onClick={() => onNavigate('events')}>
              כל האירועים →
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="dash-empty">אין אירועים קרובים</div>
          ) : (
            upcomingEvents.map(event => (
              <div
                key={event.id}
                className="dash-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onViewEvent(event)}
              >
                <div className="dash-row__icon">
                  {EVENT_TYPE_ICONS[event.event_type] || '📌'}
                </div>
                <div className="dash-row__info">
                  <div className="dash-row__name">{event.name}</div>
                  <div className="dash-row__meta">{shortDate(event.starts_at)}</div>
                </div>
                <div>
                  <span className={`admin-badge ${EVENT_STATUS_BADGE[event.status] || 'admin-badge--draft'}`}>
                    {EVENT_STATUS_LABELS[event.status] || event.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent events */}
        <div className="dash-section" style={{ gridColumn: '1 / -1' }}>
          <div className="dash-section__head">
            <h3 className="dash-section__title">🕐 אירועים אחרונים</h3>
          </div>

          {recentEvents.length === 0 ? (
            <div className="dash-empty">אין אירועים עדיין</div>
          ) : (
            recentEvents.map(event => (
              <div
                key={event.id}
                className="dash-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onViewEvent(event)}
              >
                <div className="dash-row__icon">
                  {EVENT_TYPE_ICONS[event.event_type] || '📌'}
                </div>
                <div className="dash-row__info">
                  <div className="dash-row__name">{event.name}</div>
                  <div className="dash-row__meta">
                    /{event.slug}
                    {event.starts_at && ` · ${shortDate(event.starts_at)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 12,
                    color: event.payment_status === 'paid' ? 'var(--admin-green)' : event.payment_status === 'waived' ? 'var(--admin-blue)' : 'var(--admin-text-muted)',
                  }}>
                    {event.payment_status === 'paid' ? '✅ שולם' : event.payment_status === 'waived' ? '🎁 הנחה' : '⏳ לא שולם'}
                  </span>
                  <span className={`admin-badge ${EVENT_STATUS_BADGE[event.status] || 'admin-badge--draft'}`}>
                    {EVENT_STATUS_LABELS[event.status] || event.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
