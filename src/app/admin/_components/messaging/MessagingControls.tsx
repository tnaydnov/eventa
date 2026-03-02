'use client';

import type { MessagingConfig, EventMessagingStatus } from '../shared';

interface MessagingControlsProps {
  eventId: string;
  status: EventMessagingStatus;
  onToggleWA: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  onTrigger: (eventId: string, type: 'pre_event' | 'feedback') => Promise<{ ok: boolean; sent?: number; error?: string }>;
  onSendEmail: (eventId: string, type: string, opts?: { subject?: string; body?: string }) => Promise<{ ok: boolean; error?: string }>;
  onRegenerateToken: (eventId: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  onUpdateConfig: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  isArchived: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function MessagingControls({
  eventId,
  status,
  onToggleWA,
  onTrigger,
  onSendEmail,
  onRegenerateToken,
  onUpdateConfig,
  isArchived,
}: MessagingControlsProps) {

  const portalUrl = status.portalToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/guest-upload/${eventId}?token=${status.portalToken}`
    : null;

  const handleCopyPortalLink = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      alert('✅ הקישור הועתק');
    }
  };

  const handleToggleWA = async () => {
    const next = !status.waMessagesEnabled;
    if (!next && !confirm('לכבות את שירות ההודעות?')) return;
    const res = await onToggleWA(eventId, { waMessagesEnabled: next });
    if (res.ok) alert(next ? '✅ הודעות הופעלו' : '✅ הודעות כובו');
    else alert(res.error || 'שגיאה');
  };

  const handleTriggerPreEvent = async () => {
    if (!confirm('לשלוח הודעות WhatsApp לכל הרשימה עכשיו?')) return;
    const res = await onTrigger(eventId, 'pre_event');
    if (res.ok) alert(`✅ נשלחו ${res.sent ?? 0} הודעות`);
    else alert(res.error || 'שגיאה');
  };

  const handleTriggerFeedback = async () => {
    if (!confirm('לשלוח הודעות פידבק עכשיו?')) return;
    const res = await onTrigger(eventId, 'feedback');
    if (res.ok) alert(`✅ נשלחו ${res.sent ?? 0} הודעות`);
    else alert(res.error || 'שגיאה');
  };

  const handleSendInstructions = async () => {
    const res = await onSendEmail(eventId, 'upload_instructions');
    if (res.ok) alert('✅ הוראות נשלחו');
    else alert(res.error || 'שגיאה');
  };

  const handleSendReminder = async () => {
    const res = await onSendEmail(eventId, 'upload_reminder');
    if (res.ok) alert('✅ תזכורת נשלחה');
    else alert(res.error || 'שגיאה');
  };

  const handleSendInvoice = async () => {
    const res = await onSendEmail(eventId, 'invoice');
    if (res.ok) alert('✅ חשבונית נשלחה');
    else alert(res.error || 'שגיאה');
  };

  const handleSendSummary = async () => {
    const res = await onSendEmail(eventId, 'summary');
    if (res.ok) alert('✅ סיכום אירוע נשלח');
    else alert(res.error || 'שגיאה');
  };

  const handleRegenerateToken = async () => {
    if (!confirm('ליצור טוקן חדש? הטוקן הישן יפסיק לעבוד.')) return;
    const res = await onRegenerateToken(eventId);
    if (res.ok) alert('✅ טוקן חדש נוצר');
    else alert(res.error || 'שגיאה');
  };

  const handleCustomEmail = async () => {
    const subject = prompt('נושא המייל:');
    if (!subject) return;
    const body = prompt('תוכן המייל:');
    if (!body) return;
    const res = await onSendEmail(eventId, 'custom', { subject, body });
    if (res.ok) alert('✅ המייל נשלח');
    else alert(res.error || 'שגיאה');
  };

  return (
    <>
      {/* ── Service Status ── */}
      <div className="ea-section">
        <h3 className="ea-section__title">📊 סטטוס שירות</h3>
        <div className="msg-status-grid">
          <div className="msg-status-item">
            <span className="msg-status-label">WhatsApp</span>
            <span className={`admin-badge ${status.waMessagesEnabled ? 'admin-badge--active' : 'admin-badge--ended'}`}>
              {status.waMessagesEnabled ? '✅ פעיל' : '🔴 כבוי'}
            </span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">רשימת אורחים</span>
            <span className="msg-status-value">{status.totalGuestPhones} מספרים</span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">הודעות Pre-Event</span>
            <span className="msg-status-value">{status.preEventSentCount} נשלחו</span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">הודעות פידבק</span>
            <span className="msg-status-value">{status.feedbackSentCount} נשלחו</span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">שליחת Pre-Event</span>
            <span className="msg-status-value">{formatDate(status.preEventSendAt)}</span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">שליחת פידבק</span>
            <span className="msg-status-value">{formatDate(status.feedbackSendAt)}</span>
          </div>
        </div>
      </div>

      {/* ── Portal Management ── */}
      <div className="ea-section">
        <h3 className="ea-section__title">🔗 פורטל הלקוח</h3>
        <div className="msg-status-grid">
          <div className="msg-status-item">
            <span className="msg-status-label">סטטוס פורטל</span>
            <span className={`admin-badge ${status.portalTokenActive ? 'admin-badge--active' : 'admin-badge--ended'}`}>
              {status.portalTokenActive ? '✅ פעיל' : '🔴 לא פעיל'}
            </span>
          </div>
        </div>
        {portalUrl && (
          <div className="msg-portal-url">
            <input
              type="text"
              value={portalUrl}
              readOnly
              className="msg-portal-input"
              dir="ltr"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>
        )}
        {!isArchived && (
          <div className="msg-actions-row">
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleCopyPortalLink} disabled={!portalUrl}>
              📋 העתיקו לינק
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleRegenerateToken}>
              🔄 חדשו טוקן
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleSendInstructions}>
              📧 שלחו הוראות
            </button>
          </div>
        )}
      </div>

      {/* ── Manual Actions ── */}
      {!isArchived && (
        <div className="ea-section">
          <h3 className="ea-section__title">⚡ פעולות ידניות</h3>
          <div className="msg-actions-grid">
            <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={handleToggleWA}>
              {status.waMessagesEnabled ? '🔴 כבו WA' : '✅ הפעילו WA'}
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleSendReminder}>
              📧 תזכורת העלאה
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleSendInvoice}>
              📧 חשבונית ₪50
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleSendSummary}>
              📧 סיכום אירוע
            </button>
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleCustomEmail}>
              📧 מייל חופשי
            </button>
            <button
              className="admin-btn admin-btn--sm admin-btn--green"
              onClick={handleTriggerPreEvent}
              disabled={status.totalGuestPhones === 0}
            >
              📱 שלחו WA עכשיו
            </button>
            <button
              className="admin-btn admin-btn--sm admin-btn--orange"
              onClick={handleTriggerFeedback}
              disabled={status.preEventSentCount === 0}
            >
              📱 שלחו פידבק עכשיו
            </button>
          </div>
        </div>
      )}
    </>
  );
}
