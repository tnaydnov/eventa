'use client';

import { useState, useCallback } from 'react';
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

/* ── Action definitions ── */

type ActionTarget = 'client' | 'guests';
type ActionChannel = 'email' | 'whatsapp' | 'system';

interface ActionDef {
  id: string;
  label: string;
  icon: string;
  target: ActionTarget;
  channel: ActionChannel;
  description: string;
  preview: string[];
  confirmLabel: string;
  dangerLevel: 'safe' | 'warning' | 'danger';
  disabled?: (s: EventMessagingStatus) => boolean;
  disabledReason?: string;
}

const CLIENT_ACTIONS: ActionDef[] = [
  {
    id: 'upload_instructions',
    label: 'הוראות העלאה',
    icon: '📋',
    target: 'client',
    channel: 'email',
    description: 'שולח ללקוח מייל עם הסבר איך להעלות רשימת אורחים דרך הפורטל.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "האירוע שלך אושר — העלו רשימת אורחים"',
      '📎 כולל: קישור לפורטל העלאה, הסבר שלב-אחר-שלב, פורמט הקובץ הנדרש',
    ],
    confirmLabel: 'שלח הוראות',
    dangerLevel: 'safe',
  },
  {
    id: 'upload_reminder',
    label: 'תזכורת העלאה',
    icon: '⏰',
    target: 'client',
    channel: 'email',
    description: 'שולח ללקוח תזכורת ידידותית שעדיין לא העלה רשימת אורחים.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "תזכורת — העלו את רשימת האורחים"',
      '📎 כולל: קישור לפורטל, תאריך האירוע, כמה ימים נותרו',
    ],
    confirmLabel: 'שלח תזכורת',
    dangerLevel: 'safe',
  },
  {
    id: 'invoice',
    label: 'חשבונית ₪50',
    icon: '🧾',
    target: 'client',
    channel: 'email',
    description: 'שולח ללקוח חשבונית עבור תוסף הודעות WhatsApp (₪50).',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "חשבונית — שירות הודעות WhatsApp"',
      '📎 כולל: פירוט השירות, סכום ₪50, קישורי תשלום (Bit / PayBox)',
    ],
    confirmLabel: 'שלח חשבונית',
    dangerLevel: 'warning',
  },
  {
    id: 'summary',
    label: 'סיכום אירוע',
    icon: '📊',
    target: 'client',
    channel: 'email',
    description: 'שולח ללקוח דו"ח סיכום אחרי האירוע — סטטיסטיקות, התאמות, הודעות.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "סיכום האירוע שלך"',
      '📎 כולל: מספר משתתפים, לייקים, התאמות, שיחות, הודעות WA שנשלחו',
    ],
    confirmLabel: 'שלח סיכום',
    dangerLevel: 'safe',
  },
  {
    id: 'custom',
    label: 'מייל חופשי',
    icon: '✏️',
    target: 'client',
    channel: 'email',
    description: 'שולח ללקוח מייל עם נושא ותוכן שאתה כותב. לתקשורת אישית.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: אתה בוחר',
      '📎 תוכן: אתה כותב — טקסט חופשי',
    ],
    confirmLabel: 'כתוב ושלח',
    dangerLevel: 'safe',
  },
];

const GUEST_ACTIONS: ActionDef[] = [
  {
    id: 'send_pre_event',
    label: 'שלח WA עכשיו',
    icon: '📱',
    target: 'guests',
    channel: 'whatsapp',
    description: 'שולח הודעת WhatsApp לכל האורחים ברשימה שעדיין לא קיבלו הודעה. כולל קישור הצטרפות לאירוע.',
    preview: [
      '📱 WhatsApp אל: כל האורחים ברשימה שטרם קיבלו',
      '📝 תבנית: הזמנה לאירוע עם קישור הצטרפות',
      '⚡ שליחה: מיידית, עד 50 הודעות בבת אחת',
      '💰 עלות: ~₪0.15 לכל שיחה (חלון 24 שעות)',
    ],
    confirmLabel: 'שלח הודעות WA',
    dangerLevel: 'danger',
    disabled: (s) => s.totalGuestPhones === 0,
    disabledReason: 'אין אורחים ברשימה',
  },
  {
    id: 'send_feedback',
    label: 'שלח פידבק עכשיו',
    icon: '💬',
    target: 'guests',
    channel: 'whatsapp',
    description: 'שולח הודעת פידבק לכל המשתתפים שנתנו הסכמה ועדיין לא קיבלו.',
    preview: [
      '📱 WhatsApp אל: משתתפים שנתנו הסכמה וטרם קיבלו פידבק',
      '📝 תבנית: בקשת פידבק + קוד הנחה לאירוע הבא',
      '⚡ שליחה: מיידית, עד 50 הודעות בבת אחת',
    ],
    confirmLabel: 'שלח פידבק',
    dangerLevel: 'danger',
    disabled: (s) => s.preEventSentCount === 0,
    disabledReason: 'טרם נשלחו הודעות Pre-Event',
  },
];

/* ── Helpers ── */

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/* ── Action Preview Dialog ── */

interface ActionDialogProps {
  action: ActionDef;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  customFields?: React.ReactNode;
}

function ActionDialog({ action, onConfirm, onCancel, loading, customFields }: ActionDialogProps) {
  const targetLabel = action.target === 'client' ? '👤 ללקוח' : '👥 לאורחים';
  const channelLabel =
    action.channel === 'email' ? '📧 אימייל' :
    action.channel === 'whatsapp' ? '📱 WhatsApp' : '🔧 מערכת';
  const dangerClass =
    action.dangerLevel === 'danger' ? 'act-dialog--danger' :
    action.dangerLevel === 'warning' ? 'act-dialog--warning' : '';

  return (
    <div className="act-dialog-overlay" onClick={onCancel}>
      <div className={`act-dialog ${dangerClass}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="act-dialog__header">
          <span className="act-dialog__icon">{action.icon}</span>
          <h3 className="act-dialog__title">{action.label}</h3>
          <button className="act-dialog__close" onClick={onCancel} aria-label="סגור">✕</button>
        </div>

        {/* Meta chips */}
        <div className="act-dialog__meta">
          <span className="act-chip act-chip--target">{targetLabel}</span>
          <span className="act-chip act-chip--channel">{channelLabel}</span>
        </div>

        {/* Description */}
        <p className="act-dialog__desc">{action.description}</p>

        {/* Preview */}
        <div className="act-dialog__preview">
          <div className="act-dialog__preview-header">
            <span className="act-dialog__preview-icon">👁</span>
            <span>תצוגה מקדימה</span>
          </div>
          {action.preview.map((line, i) => (
            <div key={i} className="act-dialog__preview-line">{line}</div>
          ))}
        </div>

        {/* Custom fields (for custom email) */}
        {customFields}

        {/* Actions */}
        <div className="act-dialog__actions">
          <button
            className="admin-btn admin-btn--ghost"
            onClick={onCancel}
            disabled={loading}
          >
            ביטול
          </button>
          <button
            className={`admin-btn ${action.dangerLevel === 'danger' ? 'admin-btn--red' : action.dangerLevel === 'warning' ? 'admin-btn--orange' : 'admin-btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '⏳ שולח…' : `${action.icon} ${action.confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function MessagingControls({
  eventId,
  status,
  onToggleWA,
  onTrigger,
  onSendEmail,
  onRegenerateToken,
  isArchived,
}: MessagingControlsProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');

  const portalUrl = status.portalToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/guest-upload/${eventId}?token=${status.portalToken}`
    : null;

  const handleAction = useCallback(async (actionId: string) => {
    setLoading(true);
    try {
      let result: { ok: boolean; error?: string; sent?: number; token?: string };

      switch (actionId) {
        case 'upload_instructions':
        case 'upload_reminder':
        case 'invoice':
        case 'summary':
          result = await onSendEmail(eventId, actionId);
          if (result.ok) alert('✅ נשלח בהצלחה');
          else alert(result.error || 'שגיאה');
          break;

        case 'custom': {
          if (!customSubject.trim() || !customBody.trim()) {
            alert('נא למלא נושא ותוכן');
            setLoading(false);
            return;
          }
          result = await onSendEmail(eventId, 'custom', {
            subject: customSubject.trim(),
            body: customBody.trim(),
          });
          if (result.ok) {
            alert('✅ המייל נשלח');
            setCustomSubject('');
            setCustomBody('');
          } else {
            alert(result.error || 'שגיאה');
          }
          break;
        }

        case 'send_pre_event':
          result = await onTrigger(eventId, 'pre_event');
          if (result.ok) alert(`✅ נשלחו ${result.sent ?? 0} הודעות WhatsApp`);
          else alert(result.error || 'שגיאה');
          break;

        case 'send_feedback':
          result = await onTrigger(eventId, 'feedback');
          if (result.ok) alert(`✅ נשלחו ${result.sent ?? 0} הודעות פידבק`);
          else alert(result.error || 'שגיאה');
          break;

        case 'toggle_wa': {
          const next = !status.waMessagesEnabled;
          result = await onToggleWA(eventId, { waMessagesEnabled: next });
          if (result.ok) alert(next ? '✅ הודעות WhatsApp הופעלו' : '✅ הודעות WhatsApp כובו');
          else alert(result.error || 'שגיאה');
          break;
        }

        case 'regenerate_token':
          result = await onRegenerateToken(eventId);
          if (result.ok) alert('✅ טוקן חדש נוצר — שלח ללקוח את הלינק החדש');
          else alert(result.error || 'שגיאה');
          break;

        default:
          break;
      }
    } finally {
      setLoading(false);
      setActiveDialog(null);
    }
  }, [eventId, onSendEmail, onTrigger, onToggleWA, onRegenerateToken, customSubject, customBody, status.waMessagesEnabled]);

  const openAction = (actionId: string) => {
    setActiveDialog(actionId);
    if (actionId === 'custom') {
      setCustomSubject('');
      setCustomBody('');
    }
  };

  const getActionDef = (id: string): ActionDef | undefined => {
    if (id === 'toggle_wa') {
      return {
        id: 'toggle_wa',
        label: status.waMessagesEnabled ? 'כבה WA' : 'הפעל WA',
        icon: status.waMessagesEnabled ? '🔴' : '✅',
        target: 'guests',
        channel: 'system',
        description: status.waMessagesEnabled
          ? 'מכבה את שירות ההודעות WhatsApp — לא יישלחו הודעות לאורחים.'
          : 'מפעיל את שירות ההודעות WhatsApp — יאפשר שליחת הזמנות ופידבק לאורחים.',
        preview: status.waMessagesEnabled
          ? ['⚠️ הודעות עתידיות (Pre-Event, פידבק) לא יישלחו', '🔧 ניתן להפעיל מחדש בכל עת']
          : ['✅ יפעיל שליחת הודעות לאורחים ברשימה', '📱 הודעות Pre-Event ופידבק יישלחו לפי לוח הזמנים'],
        confirmLabel: status.waMessagesEnabled ? 'כבה הודעות' : 'הפעל הודעות',
        dangerLevel: 'warning',
      };
    }
    if (id === 'regenerate_token') {
      return {
        id: 'regenerate_token',
        label: 'חדש טוקן פורטל',
        icon: '🔄',
        target: 'client',
        channel: 'system',
        description: 'מייצר טוקן פורטל חדש. הטוקן הישן יפסיק לעבוד — הלקוח יצטרך לינק חדש.',
        preview: [
          '🔧 פעולת מערכת',
          '⚠️ הטוקן הישן של הפורטל יפסיק לעבוד מיד',
          '📋 תצטרך לשלוח ללקוח את הלינק החדש',
        ],
        confirmLabel: 'צור טוקן חדש',
        dangerLevel: 'warning',
      };
    }
    return [...CLIENT_ACTIONS, ...GUEST_ACTIONS].find(a => a.id === id);
  };

  const handleCopyPortalLink = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      alert('✅ הקישור הועתק');
    }
  };

  const currentAction = activeDialog ? getActionDef(activeDialog) : null;

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
        <div className="msg-actions-row">
          <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={handleCopyPortalLink} disabled={!portalUrl}>
            📋 העתיקו לינק
          </button>
          {!isArchived && (
            <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => openAction('regenerate_token')}>
              🔄 חדשו טוקן
            </button>
          )}
        </div>
      </div>

      {/* ── Action Center ── */}
      {!isArchived && (
        <div className="ea-section">
          <h3 className="ea-section__title">⚡ מרכז פעולות</h3>

          {/* Client actions */}
          <div className="act-group">
            <div className="act-group__header">
              <span className="act-group__badge act-group__badge--client">👤 פעולות מול הלקוח</span>
              <span className="act-group__hint">אימייל ללקוח שהזמין את השירות</span>
            </div>
            <div className="act-grid">
              {CLIENT_ACTIONS.map(a => (
                <button
                  key={a.id}
                  className="act-card"
                  onClick={() => openAction(a.id)}
                  disabled={a.disabled?.(status)}
                >
                  <span className="act-card__icon">{a.icon}</span>
                  <span className="act-card__label">{a.label}</span>
                  <span className="act-card__channel">📧</span>
                </button>
              ))}
            </div>
          </div>

          {/* Guest actions */}
          <div className="act-group">
            <div className="act-group__header">
              <span className="act-group__badge act-group__badge--guests">👥 פעולות מול האורחים</span>
              <span className="act-group__hint">WhatsApp לרשימת הטלפונים</span>
            </div>
            <div className="act-grid">
              {GUEST_ACTIONS.map(a => {
                const isDisabled = a.disabled?.(status) ?? false;
                return (
                  <button
                    key={a.id}
                    className={`act-card act-card--wa ${isDisabled ? 'act-card--disabled' : ''}`}
                    onClick={() => !isDisabled && openAction(a.id)}
                    disabled={isDisabled}
                    title={isDisabled ? a.disabledReason : undefined}
                  >
                    <span className="act-card__icon">{a.icon}</span>
                    <span className="act-card__label">{a.label}</span>
                    <span className="act-card__channel">📱</span>
                    {isDisabled && <span className="act-card__reason">{a.disabledReason}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* System actions */}
          <div className="act-group">
            <div className="act-group__header">
              <span className="act-group__badge act-group__badge--system">🔧 מערכת</span>
            </div>
            <div className="act-grid">
              <button
                className={`act-card ${status.waMessagesEnabled ? 'act-card--danger' : 'act-card--success'}`}
                onClick={() => openAction('toggle_wa')}
              >
                <span className="act-card__icon">{status.waMessagesEnabled ? '🔴' : '✅'}</span>
                <span className="act-card__label">{status.waMessagesEnabled ? 'כבה WA' : 'הפעל WA'}</span>
                <span className="act-card__channel">🔧</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Preview Dialog ── */}
      {currentAction && (
        <ActionDialog
          action={currentAction}
          onConfirm={() => handleAction(activeDialog!)}
          onCancel={() => setActiveDialog(null)}
          loading={loading}
          customFields={activeDialog === 'custom' ? (
            <div className="act-dialog__custom">
              <label className="act-dialog__field-label">נושא המייל</label>
              <input
                className="act-dialog__input"
                type="text"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="לדוגמה: עדכון חשוב לגבי האירוע"
                dir="rtl"
              />
              <label className="act-dialog__field-label">תוכן המייל</label>
              <textarea
                className="act-dialog__textarea"
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                placeholder="כתבו כאן את תוכן ההודעה…"
                rows={4}
                dir="rtl"
              />
            </div>
          ) : undefined}
        />
      )}
    </>
  );
}
