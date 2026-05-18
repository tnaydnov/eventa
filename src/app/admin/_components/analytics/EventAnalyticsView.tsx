'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Event } from '@/lib/database.types';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/constants';
import { adminFetch, type EventAnalytics, type EventMessagingStatus, type GuestPhoneAdmin, type MessageLogEntry, type MessagingConfig } from '../shared';
import ParticipantsTable from '../participants/ParticipantsTable';
import EventServicesInfo from '../messaging/EventServicesInfo';
import ClientActionsPanel from '../messaging/ClientActionsPanel';

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false });
const MessagingTab = dynamic(() => import('../messaging/MessagingTab'), { ssr: false });
const FeedbackTab = dynamic(() => import('../feedback/FeedbackTab'), { ssr: false });
const AdminReportView = dynamic(() => import('../report/AdminReportView'), { ssr: false });

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
  messagingStatus: EventMessagingStatus | null;
  guestPhones: GuestPhoneAdmin[];
  messageLog: MessageLogEntry[];
  loadMessagingStatus: (eventId: string) => Promise<void>;
  updateMessagingConfig: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  triggerMessages: (eventId: string, type: 'pre_event' | 'feedback') => Promise<{ ok: boolean; sent?: number; error?: string }>;
  loadGuestPhones: (eventId: string) => Promise<void>;
  adminAddGuestPhone: (eventId: string, phone: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  adminRemoveGuestPhone: (eventId: string, phoneId: string) => Promise<{ ok: boolean; error?: string }>;
  adminUploadGuestFile: (eventId: string, file: File) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  regeneratePortalToken: (eventId: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  sendClientEmail: (eventId: string, type: string, opts?: { subject?: string; body?: string }) => Promise<{ ok: boolean; error?: string }>;
  sendQrPage: (eventId: string, files: File[], qrOnly?: boolean) => Promise<{ ok: boolean; error?: string }>;
  loadMessageLog: (eventId: string) => Promise<void>;
  updateEventDetails?: (eventId: string, updates: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

type DetailTab = 'overview' | 'analytics' | 'participants' | 'messaging' | 'feedback' | 'settings' | 'report';

const STATUS_BADGE: Record<string, string> = {
  active:   'admin-badge--active',
  draft:    'admin-badge--draft',
  paused:   'admin-badge--paused',
  ended:    'admin-badge--ended',
  archived: 'admin-badge--archived',
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const toLocalInput = (iso: string) => {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
};

const TABS: { key: DetailTab; label: string; endedOnly?: boolean }[] = [
  { key: 'overview',      label: 'סקירה' },
  { key: 'analytics',     label: 'אנליטיקס' },
  { key: 'participants',  label: 'משתתפים' },
  { key: 'messaging',     label: 'הודעות' },
  { key: 'feedback',      label: 'פידבק' },
  { key: 'settings',      label: 'הגדרות' },
  { key: 'report',        label: 'דוח לקוח', endedOnly: true },
];

export default function EventAnalyticsView({
  event, onBack,
  onGenerateQR, onCopyUrl, onUploadBg, onRemoveBg,
  onUpdateStatus, onDelete, onArchive,
  messagingStatus, guestPhones, messageLog,
  loadMessagingStatus, updateMessagingConfig, triggerMessages,
  loadGuestPhones, adminAddGuestPhone, adminRemoveGuestPhone, adminUploadGuestFile,
  regeneratePortalToken, sendClientEmail, sendQrPage, loadMessageLog,
  updateEventDetails,
}: EventAnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const [editingDates, setEditingDates] = useState(false);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt]     = useState('');
  const [savingDates, setSavingDates]   = useState(false);
  const [dateError, setDateError]       = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminFetch(`/api/admin/events/${event.id}/analytics`)
      .then(async res => {
        if (cancelled) return;
        if (res.ok) setAnalytics(await res.json());
        else setError('שגיאה בטעינת אנליטיקס');
      })
      .catch(() => { if (!cancelled) setError('שגיאת תקשורת'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [event.id]);

  const openDateEditor = () => {
    setEditStartsAt(toLocalInput(event.starts_at));
    setEditEndsAt(toLocalInput(event.ends_at));
    setDateError('');
    setEditingDates(true);
  };

  const saveDates = async () => {
    if (!updateEventDetails || !editStartsAt || !editEndsAt) { setDateError('יש למלא תאריך ושעה'); return; }
    const s = new Date(editStartsAt).toISOString();
    const e2 = new Date(editEndsAt).toISOString();
    if (e2 <= s) { setDateError('שעת סיום חייבת להיות אחרי ההתחלה'); return; }
    setSavingDates(true);
    setDateError('');
    const r = await updateEventDetails(event.id, { starts_at: s, ends_at: e2 });
    setSavingDates(false);
    if (r.ok) setEditingDates(false);
    else setDateError(r.error || 'שגיאה בעדכון');
  };

  const typeIcon   = EVENT_TYPE_ICONS[event.event_type]   || '?';
  const typeLabel  = EVENT_TYPE_LABELS[event.event_type]  || event.event_type;
  const statusLabel = EVENT_STATUS_LABELS[event.status]    || event.status;
  const isArchived = event.status === 'archived';

  return (
    <div className="ev-detail admin-animate-in">

      {/* ── Back bar ── */}
      <div className="ev-detail__back-bar">
        <button className="ev-detail__back-btn" onClick={onBack}>
          <span className="ev-detail__back-arrow">&#8592;</span> חזרה לאירועים
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="ev-detail__hero">
        <div className="ev-detail__hero-icon">{typeIcon}</div>
        <div className="ev-detail__hero-info">
          <h1 className="ev-detail__name">{event.name}</h1>
          <div className="ev-detail__meta">
            <span className="ev-detail__type">{typeLabel}</span>
            <span className="ev-detail__sep">·</span>
            <span className="ev-detail__slug" dir="ltr">/{event.slug}</span>
          </div>
        </div>
        <div className="ev-detail__hero-right">
          <span className={`admin-badge ${STATUS_BADGE[event.status] || 'admin-badge--draft'}`}>
            {statusLabel}
          </span>
          {!isArchived && (
            <div className="ev-detail__quick-btns">
              <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onGenerateQR(event)} title="צור QR">
                QR
              </button>
              <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onCopyUrl(event)} title="העתק קישור">
                Copy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat bar (loaded from analytics) ── */}
      {!loading && analytics && (
        <div className="ev-detail__stats">
          <div className="ev-detail__stat">
            <span className="ev-detail__stat-val">{analytics.totalParticipants}</span>
            <span className="ev-detail__stat-lbl">משתתפים</span>
          </div>
          <div className="ev-detail__stat">
            <span className="ev-detail__stat-val ev-detail__stat-val--red">{analytics.totalLikes}</span>
            <span className="ev-detail__stat-lbl">לייקים</span>
          </div>
          <div className="ev-detail__stat">
            <span className="ev-detail__stat-val ev-detail__stat-val--green">{analytics.totalMatches}</span>
            <span className="ev-detail__stat-lbl">התאמות</span>
          </div>
          <div className="ev-detail__stat">
            <span className="ev-detail__stat-val ev-detail__stat-val--blue">{analytics.totalConversations}</span>
            <span className="ev-detail__stat-lbl">שיחות</span>
          </div>
          <div className="ev-detail__stat">
            <span className="ev-detail__stat-val ev-detail__stat-val--purple">{analytics.totalMessages}</span>
            <span className="ev-detail__stat-lbl">הודעות</span>
          </div>
          {analytics.incompleteRegistrations > 0 && (
            <div className="ev-detail__stat ev-detail__stat--warn">
              <span className="ev-detail__stat-val ev-detail__stat-val--orange">{analytics.incompleteRegistrations}</span>
              <span className="ev-detail__stat-lbl">הרשמה חלקית</span>
            </div>
          )}
        </div>
      )}
      {loading && (
        <div className="ev-detail__stats ev-detail__stats--skeleton">
          {[1,2,3,4,5].map(i => <div key={i} className="admin-skeleton" style={{ height: 56, borderRadius: 10 }} />)}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="edt-tabs" role="tablist">
        {TABS.filter(tab => !tab.endedOnly || event.status === 'ended' || event.status === 'archived').map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`edt-tab ${activeTab === tab.key ? 'edt-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="ced-error" role="alert">{error}</div>}

      {/* ════ TAB: Overview ════ */}
      {activeTab === 'overview' && (
        <div className="ev-detail__tab-content">

          {/* Dates card */}
          <div className="ev-card">
            <div className="ev-card__header">
              <span className="ev-card__title">תאריכים</span>
              {updateEventDetails && !editingDates && (
                <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={openDateEditor}>
                  ערוך
                </button>
              )}
            </div>
            {editingDates ? (
              <div className="ev-card__body">
                <div className="ev-date-edit">
                  <div className="ev-date-edit__field">
                    <label htmlFor="ev-starts">תחילה</label>
                    <input id="ev-starts" type="datetime-local" className="admin-input" value={editStartsAt} onChange={e => setEditStartsAt(e.target.value)} />
                  </div>
                  <div className="ev-date-edit__field">
                    <label htmlFor="ev-ends">סיום</label>
                    <input id="ev-ends" type="datetime-local" className="admin-input" value={editEndsAt} onChange={e => setEditEndsAt(e.target.value)} />
                  </div>
                </div>
                {dateError && <p className="ev-date-edit__error">{dateError}</p>}
                <div className="ev-date-edit__actions">
                  <button className="admin-btn admin-btn--sm admin-btn--green" onClick={saveDates} disabled={savingDates}>
                    {savingDates ? '...' : 'שמור'}
                  </button>
                  <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setEditingDates(false)} disabled={savingDates}>
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div className="ev-card__body ev-dates-row">
                <div className="ev-date-item">
                  <span className="ev-date-item__label">התחלה</span>
                  <span className="ev-date-item__value">{fmtDate(event.starts_at)}</span>
                </div>
                <div className="ev-date-item__sep">&#8594;</div>
                <div className="ev-date-item">
                  <span className="ev-date-item__label">סיום</span>
                  <span className="ev-date-item__value">{fmtDate(event.ends_at)}</span>
                </div>
                <div className="ev-date-item ev-date-item--code">
                  <span className="ev-date-item__label">קוד כניסה</span>
                  <span className="ev-date-item__value ev-date-item__value--mono">{event.join_code}</span>
                </div>
              </div>
            )}
          </div>

          {/* Services + Contact (uses EventServicesInfo) */}
          <div className="ev-card ev-card--no-pad">
            <EventServicesInfo
              event={event}
              onUpdateDetails={updateEventDetails
                ? async (updates) => updateEventDetails(event.id, updates)
                : undefined
              }
            />
          </div>

          {/* Client actions */}
          <div className="ev-card ev-card--no-pad">
            <ClientActionsPanel
              eventId={event.id}
              eventName={event.name}
              eventDate={event.starts_at}
              onSendEmail={sendClientEmail}
              onSendQrPage={sendQrPage}
              isArchived={isArchived}
            />
          </div>

          {/* Incomplete warning */}
          {analytics && analytics.incompleteRegistrations > 0 && (
            <div className="ev-warn-banner">
              {analytics.incompleteRegistrations} משתמשים הצטרפו אך לא השלימו הרשמה
              <span className="ev-warn-banner__note">(לא נכללים בסטטיסטיקות)</span>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB: Analytics ════ */}
      {activeTab === 'analytics' && (
        <div className="ev-detail__tab-content">
          {loading && <div className="admin-skeleton" style={{ height: 300, borderRadius: 12 }} />}
          {!loading && !analytics && !error && <div className="admin-empty"><p className="admin-empty__text">אין נתוני אנליטיקס</p></div>}
          {analytics && <AnalyticsDashboard analytics={analytics} />}
        </div>
      )}

      {/* ════ TAB: Participants ════ */}
      {activeTab === 'participants' && (
        <div className="ev-detail__tab-content">
          <ParticipantsTable eventId={event.id} isArchived={isArchived} messagesEnabled={event.wa_messages_enabled} />
        </div>
      )}

      {/* ════ TAB: Messaging ════ */}
      {activeTab === 'messaging' && (
        <div className="ev-detail__tab-content">
          {event.wa_messages_enabled ? (
            <MessagingTab
              event={event}
              messagingStatus={messagingStatus}
              guestPhones={guestPhones}
              messageLog={messageLog}
              loadMessagingStatus={loadMessagingStatus}
              updateMessagingConfig={updateMessagingConfig}
              triggerMessages={triggerMessages}
              loadGuestPhones={loadGuestPhones}
              adminAddGuestPhone={adminAddGuestPhone}
              adminRemoveGuestPhone={adminRemoveGuestPhone}
              adminUploadGuestFile={adminUploadGuestFile}
              regeneratePortalToken={regeneratePortalToken}
              loadMessageLog={loadMessageLog}
            />
          ) : (
            <div className="ev-empty-tab">
              <div className="ev-empty-tab__icon">?</div>
              <h3 className="ev-empty-tab__title">הודעות כבויות</h3>
              <p className="ev-empty-tab__desc">שירות ההודעות לא פעיל עבור אירוע זה.</p>
              <button
                className="admin-btn admin-btn--primary"
                onClick={() => updateMessagingConfig(event.id, { messagesEnabled: true })}
              >
                הפעל הודעות
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB: Feedback ════ */}
      {activeTab === 'feedback' && (
        <div className="ev-detail__tab-content">
          <FeedbackTab eventId={event.id} eventSlug={event.slug} />
        </div>
      )}

      {/* ════ TAB: Report ════ */}
      {activeTab === 'report' && (
        <div className="ev-detail__tab-content">
          <AdminReportView events={[event]} initialEventId={event.id} />
        </div>
      )}

      {/* ════ TAB: Settings ════ */}
      {activeTab === 'settings' && (
        <div className="ev-detail__tab-content">

          {/* Status */}
          {!isArchived && (
            <div className="ev-card">
              <div className="ev-card__header">
                <span className="ev-card__title">סטטוס</span>
              </div>
              <div className="ev-card__body ev-settings-row">
                <div className="ev-settings-status">
                  <span className="ev-settings-status__label">סטטוס נוכחי</span>
                  <span className={`admin-badge ${STATUS_BADGE[event.status] || 'admin-badge--draft'}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="ev-settings-status__actions">
                  {event.status === 'active' && (
                    <button className="admin-btn admin-btn--warning" onClick={() => onUpdateStatus(event.id, 'paused')}>
                      השהה
                    </button>
                  )}
                  {(event.status === 'paused' || event.status === 'draft') && (
                    <button className="admin-btn admin-btn--green" onClick={() => onUpdateStatus(event.id, 'active')}>
                      הפעל
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Background */}
          {!isArchived && (
            <div className="ev-card">
              <div className="ev-card__header">
                <span className="ev-card__title">תמונת רקע</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => onUploadBg(event.id)}>
                    {event.background_image ? 'החלף רקע' : 'העלה רקע'}
                  </button>
                  {event.background_image && (
                    <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => onRemoveBg(event.id)}>
                      הסר
                    </button>
                  )}
                </div>
              </div>
              <div className="ev-card__body">
                {event.background_image ? (
                  <div className="ev-bg-preview">
                    <img src={event.background_image} alt="רקע האירוע" className="ev-bg-preview__img" />
                    <span className="ev-bg-preview__label">מוגדר</span>
                  </div>
                ) : (
                  <p className="ev-bg-empty">אין תמונת רקע — האירוע משתמש ברקע ברירת המחדל.</p>
                )}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="ev-card ev-card--danger">
            <div className="ev-card__header">
              <span className="ev-card__title ev-card__title--danger">אזור מסוכן</span>
            </div>
            <div className="ev-card__body">
              <div className="ev-danger-row">
                {!isArchived && event.status !== 'draft' && (
                  <div className="ev-danger-item">
                    <div>
                      <div className="ev-danger-item__title">ארכב אירוע</div>
                      <div className="ev-danger-item__desc">ישמור את האנליטיקס וימחק את נתוני המשתתפים.</div>
                    </div>
                    <button className="admin-btn admin-btn--warning admin-btn--sm" onClick={() => onArchive(event.id)}>
                      ארכב
                    </button>
                  </div>
                )}
                <div className="ev-danger-item">
                  <div>
                    <div className="ev-danger-item__title">מחק אירוע</div>
                    <div className="ev-danger-item__desc">מחיקה מוחלטת — לא ניתנת לביטול.</div>
                  </div>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => onDelete(event.id)}>
                    מחק
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}