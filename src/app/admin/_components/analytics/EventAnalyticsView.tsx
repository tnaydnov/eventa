'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Event } from '@/lib/database.types';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/constants';
import { adminFetch, type EventAnalytics } from '../shared';
import StatCard from './StatCard';
import ParticipantsTable from '../participants/ParticipantsTable';

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false });

interface EventAnalyticsViewProps {
  event: Event;
  onBack: () => void;
  onGenerateQR: (event: Event) => void;
  onCopyUrl: (event: Event) => void;
  onUploadBg: (eventId: string) => void;
  onRemoveBg: (eventId: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

type DetailTab = 'overview' | 'analytics' | 'participants' | 'settings';

const statusBadgeClass = (status: string): string => {
  const map: Record<string, string> = {
    active: 'admin-badge--active',
    draft: 'admin-badge--draft',
    paused: 'admin-badge--paused',
    ended: 'admin-badge--ended',
    archived: 'admin-badge--archived',
  };
  return map[status] || 'admin-badge--draft';
};

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'סקירה', icon: '📋' },
  { key: 'analytics', label: 'אנליטיקס', icon: '📊' },
  { key: 'participants', label: 'משתתפים', icon: '👥' },
  { key: 'settings', label: 'הגדרות', icon: '⚙️' },
];

export default function EventAnalyticsView({
  event, onBack,
  onGenerateQR, onCopyUrl,
  onUploadBg, onRemoveBg, onUpdateStatus, onDelete, onArchive,
}: EventAnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminFetch(`/api/admin/events/${event.id}/analytics`)
      .then(async res => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        } else {
          setError('שגיאה בטעינת אנליטיקס');
        }
      })
      .catch(() => { if (!cancelled) setError('שגיאת תקשורת'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [event.id]);

  const typeIcon = EVENT_TYPE_ICONS[event.event_type] || '📌';
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type;
  const statusLabel = EVENT_STATUS_LABELS[event.status] || event.status;
  const isArchived = event.status === 'archived';

  return (
    <div className="ea-root admin-animate-in">
      {/* ─── Header ─── */}
      <div className="admin-topbar">
        <div className="ea-header-flex">
          <button className="admin-btn admin-btn--ghost" onClick={onBack}>← חזרה</button>
          <div>
            <h2 className="admin-topbar__title">{typeIcon} {event.name}</h2>
            <p className="admin-topbar__subtitle">{typeLabel} · /{event.slug}</p>
          </div>
          <span className={`admin-badge ${statusBadgeClass(event.status)}`}>{statusLabel}</span>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="edt-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`edt-tab ${activeTab === tab.key ? 'edt-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Loading / Error ─── */}
      {loading && (activeTab === 'overview' || activeTab === 'analytics') && (
        <div className="ea-loading">
          <div className="admin-skeleton admin-skeleton--card" />
          <div className="stat-cards-grid">
            {[1, 2, 3, 4].map(i => <div key={i} className="admin-skeleton" style={{ height: 80 }} />)}
          </div>
        </div>
      )}

      {error && <div className="ced-error">{error}</div>}

      {/* ═══ TAB: Overview ═══ */}
      {activeTab === 'overview' && (
        <>
          <div className="ea-info-bar">
            <div className="ea-info-item">
              <span className="ea-info-label">תחילה</span>
              <span className="ea-info-value">{formatDateTime(event.starts_at)}</span>
            </div>
            <div className="ea-info-item">
              <span className="ea-info-label">סיום</span>
              <span className="ea-info-value">{formatDateTime(event.ends_at)}</span>
            </div>
            <div className="ea-info-item">
              <span className="ea-info-label">קוד כניסה</span>
              <span className="ea-info-value" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                {event.join_code}
              </span>
            </div>
          </div>

          {event.description && <p className="ea-description">{event.description}</p>}

          {!isArchived && (
            <div className="ea-quick-actions">
              <span className="ea-quick-actions__label">פעולות מהירות:</span>
              <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => onGenerateQR(event)}>
                📱 QR
              </button>
              <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onCopyUrl(event)}>
                📋 העתק קישור
              </button>
            </div>
          )}

          {analytics && (
            <div className="ea-section">
              <h3 className="ea-section__title">📊 סיכום מהיר</h3>
              <div className="stat-cards-grid">
                <StatCard icon="👥" label="משתתפים" value={analytics.totalParticipants} accent />
                <StatCard icon="❤️" label="לייקים" value={analytics.totalLikes} color="red" />
                <StatCard icon="💘" label="התאמות" value={analytics.totalMatches} color="green" />
                <StatCard icon="💬" label="שיחות" value={analytics.totalConversations} color="blue" />
                <StatCard icon="✉️" label="הודעות" value={analytics.totalMessages} color="purple" />
                <StatCard icon="🧭" label="מצפן" value={analytics.compassSessionsActivated} color="orange" />
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: Analytics ═══ */}
      {activeTab === 'analytics' && analytics && (
        <AnalyticsDashboard analytics={analytics} />
      )}

      {/* ═══ TAB: Participants ═══ */}
      {activeTab === 'participants' && (
        <ParticipantsTable eventId={event.id} isArchived={isArchived} />
      )}

      {/* ═══ TAB: Settings ═══ */}
      {activeTab === 'settings' && (
        <>
          {!isArchived && (
            <div className="ea-section">
              <h3 className="ea-section__title">📊 סטטוס</h3>
              <div className="ea-info-bar">
                <div className="ea-info-item">
                  <span className="ea-info-label">סטטוס נוכחי</span>
                  <span className={`admin-badge ${statusBadgeClass(event.status)}`}>{statusLabel}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {event.status === 'active' ? (
                    <button className="admin-btn admin-btn--sm admin-btn--orange" onClick={() => onUpdateStatus(event.id, 'paused')}>
                      ⏸ השהה
                    </button>
                  ) : (event.status === 'paused' || event.status === 'draft') ? (
                    <button className="admin-btn admin-btn--sm admin-btn--green" onClick={() => onUpdateStatus(event.id, 'active')}>
                      ▶ הפעל
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {!isArchived && (
            <div className="ea-section">
              <h3 className="ea-section__title">🖼 רקע</h3>
              <div className="ea-info-bar">
                <div className="ea-info-item">
                  <span className="ea-info-label">תמונת רקע</span>
                  <span className="ea-info-value">
                    {event.background_image ? '✅ מוגדר' : '❌ לא מוגדר'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onUploadBg(event.id)}>
                    🖼 {event.background_image ? 'החלף רקע' : 'העלה רקע'}
                  </button>
                  {event.background_image && (
                    <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onRemoveBg(event.id)}>
                      ✖ הסר רקע
                    </button>
                  )}
                </div>
              </div>
              {event.background_image && (
                <img
                  src={event.background_image}
                  alt="רקע האירוע"
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    maxWidth: 200,
                    border: '1px solid var(--admin-border)',
                  }}
                />
              )}
            </div>
          )}

          <div className="ea-section ea-danger-zone">
            <h3 className="ea-section__title">⚠️ אזור מסוכן</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!isArchived && event.status !== 'draft' && (
                <button className="admin-btn admin-btn--sm admin-btn--orange" onClick={() => onArchive(event.id)}>
                  🗄️ ארכב אירוע
                </button>
              )}
              <button className="admin-btn admin-btn--sm admin-btn--red" onClick={() => onDelete(event.id)}>
                🗑 מחק אירוע
              </button>
            </div>
            {!isArchived && event.status !== 'draft' && (
              <p className="ea-danger-hint">ארכוב ישמור תמונת מצב של האנליטיקס וימחק את כל נתוני המשתתפים.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
