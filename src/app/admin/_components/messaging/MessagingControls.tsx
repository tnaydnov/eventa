'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { MessagingConfig, EventMessagingStatus } from '../shared';

interface MessagingControlsProps {
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  status: EventMessagingStatus;
  onToggleWA: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  onTrigger: (eventId: string, type: 'pre_event' | 'feedback') => Promise<{ ok: boolean; sent?: number; error?: string }>;
  onRegenerateToken: (eventId: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  onUpdateConfig: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  isArchived: boolean;
}

/* ── Action definitions ── */

type ActionTarget = 'client' | 'guests';
type ActionChannel = 'email' | 'sms' | 'system';

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

const GUEST_ACTIONS: ActionDef[] = [
  {
    id: 'send_pre_event',
    label: 'שלח הודעות עכשיו',
    icon: '📱',
    target: 'guests',
    channel: 'sms',
    description: 'שולח הודעת SMS לכל האורחים ברשימה שעדיין לא קיבלו הודעה. כולל קישור הצטרפות לאירוע.',
    preview: [
      '📱 SMS אל: כל האורחים ברשימה שטרם קיבלו',
      '📝 תבנית: הזמנה לאירוע עם קישור הצטרפות',
      '⚡ שליחה: מיידית, עד 50 הודעות בבת אחת',
    ],
    confirmLabel: 'שלח הודעות',
    dangerLevel: 'danger',
    disabled: (s) => s.totalGuestPhones === 0,
    disabledReason: 'אין אורחים ברשימה',
  },
  {
    id: 'send_feedback',
    label: 'שלח פידבק עכשיו',
    icon: '💬',
    target: 'guests',
    channel: 'sms',
    description: 'שולח הודעת פידבק לכל המשתתפים שנתנו הסכמה ועדיין לא קיבלו.',
    preview: [
      '📱 SMS אל: משתתפים שנתנו הסכמה וטרם קיבלו פידבק',
      '📝 תבנית: בקשת פידבק + קישור למשוב',
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
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtDateHe(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtTimeHe(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/* ── Email Preview HTML Generator ── */

const PE = {
  bg: '#f5f3f0', card: '#fff', text: '#1a1a1a', muted: '#6b6b6b',
  accent: '#b08d7e', accentBg: '#faf6f4', border: '#e8e4df', dim: '#999',
  paybox: '#004aad', bit: '#1aab4a', warn: '#c27816', warnBg: '#fef9f0',
} as const;

function emailShell(title: string, inner: string, subtitle?: string): string {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{margin:0;padding:0;background:${PE.bg};font-family:Arial,sans-serif;direction:rtl;text-align:right;color:${PE.text}}</style></head><body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PE.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${PE.card};border-radius:12px;border:1px solid ${PE.border};overflow:hidden;">
<tr><td style="background:${PE.text};padding:20px 24px;text-align:center;"><img src="https://www.eventa.productions/icons/Eventa_Logo.png" alt="Eventa" width="120" style="max-width:120px;height:auto;"/>${subtitle ? `<div style="text-align:center;font-size:11px;color:${PE.dim};margin-top:6px;">${subtitle}</div>` : ''}</td></tr>
${inner}
</table>
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;"><tr><td style="padding:12px 0;text-align:center;font-size:10px;color:${PE.dim};">&copy; ${new Date().getFullYear()} Eventa</td></tr></table>
</td></tr></table></body></html>`;
}

function peRow(label: string, value: string, last = false): string {
  const bb = last ? '' : `border-bottom:1px solid ${PE.border};`;
  return `<tr><td dir="rtl" style="text-align:right;padding:8px 0 8px 10px;${bb}color:${PE.muted};font-size:12px;width:80px;">${label}</td><td dir="rtl" style="text-align:right;padding:8px 10px 8px 0;${bb}color:${PE.text};font-size:13px;">${value}</td></tr>`;
}

function generateEmailPreview(actionId: string, eventName: string, eventDate: string): string | null {
  const safeName = eventName.replace(/</g, '&lt;');
  const date = fmtDateHe(eventDate);
  const time = fmtTimeHe(eventDate);

  switch (actionId) {
    case 'send_pre_event': return emailShell('הזמנה ל-' + safeName, `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px;background:${PE.card};border-bottom:1px solid ${PE.border};">
        <div style="text-align:center;margin-bottom:12px;"><span style="font-size:28px;">📱</span></div>
        <div style="text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#22c55e;margin-bottom:12px;">SMS Message Preview</div>
        <div style="background:#0b3d2e;border-radius:12px;padding:16px;color:#e0e0e0;font-size:13px;line-height:1.7;direction:rtl;">
          <div>מגיע/ה ל${safeName}? 💍</div>
          <div style="margin-top:8px;">כנסו לאפליקציית ההיכרויות של האירוע וגלו מי עוד יהיה שם 😏</div>
          <div style="margin-top:8px;">נתראה באירוע! 🎉</div>
          <div style="margin-top:6px;"><a href="#" style="color:#60a5fa;text-decoration:underline;">🔗 קישור הצטרפות</a></div>
        </div>
        <div style="text-align:center;font-size:11px;color:${PE.dim};margin-top:10px;">* נשלח לכל האורחים ברשימה שטרם קיבלו הודעה</div>
      </td></tr>`, '');

    case 'send_feedback': return emailShell('פידבק - ' + safeName, `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px;background:${PE.card};border-bottom:1px solid ${PE.border};">
        <div style="text-align:center;margin-bottom:12px;"><span style="font-size:28px;">💬</span></div>
        <div style="text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#22c55e;margin-bottom:12px;">SMS Message Preview</div>
        <div style="background:#0b3d2e;border-radius:12px;padding:16px;color:#e0e0e0;font-size:13px;line-height:1.7;direction:rtl;">
          <div>תודה שהשתתפתם ב${safeName}! 🎉</div>
          <div style="margin-top:8px;">נשמח לשמוע איך הייתה החוויה:</div>
          <div style="margin-top:6px;"><a href="#" style="color:#60a5fa;text-decoration:underline;">🔗 קישור למשוב</a></div>
        </div>
        <div style="text-align:center;font-size:11px;color:${PE.dim};margin-top:10px;">* נשלח למשתתפים שנתנו הסכמה לקבלת הודעות</div>
      </td></tr>`, '');

    default: return null;
  }
}

/* ── Email Preview Iframe ── */

function EmailPreviewFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Auto-resize
    const tryResize = () => {
      try {
        const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 360;
        setHeight(Math.min(h + 10, 500));
      } catch { /* cross-origin safety */ }
    };
    setTimeout(tryResize, 100);
    setTimeout(tryResize, 300);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="act-dialog__iframe"
      sandbox="allow-same-origin"
      title="תצוגה מקדימה של המייל"
      style={{ width: '100%', height, border: 'none', borderRadius: 8, background: '#f5f3f0' }}
    />
  );
}

/* ── Action Preview Dialog ── */

interface ActionDialogProps {
  action: ActionDef;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  previewHtml: string | null;
  customFields?: React.ReactNode;
}

function ActionDialog({ action, onConfirm, onCancel, loading, previewHtml, customFields }: ActionDialogProps) {
  const containerRef = useFocusTrap(true, onCancel);
  const targetLabel = action.target === 'client' ? '👤 ללקוח' : '👥 לאורחים';
  const channelLabel =
    action.channel === 'email' ? '📧 אימייל' :
    action.channel === 'sms' ? '📱 SMS' : '🔧 מערכת';
  const dangerClass =
    action.dangerLevel === 'danger' ? 'act-dialog--danger' :
    action.dangerLevel === 'warning' ? 'act-dialog--warning' : '';

  return (
    <div className="act-dialog-overlay" onClick={onCancel}>
      <div ref={containerRef} className={`act-dialog ${dangerClass}`} role="dialog" aria-modal="true" aria-label={action.label} onClick={e => e.stopPropagation()}>
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

        {/* Custom fields (for custom email) - placed BEFORE preview */}
        {customFields}

        {/* Real email / SMS preview */}
        {previewHtml ? (
          <div className="act-dialog__preview">
            <div className="act-dialog__preview-header">
              <span className="act-dialog__preview-icon">👁</span>
              <span>תצוגה מקדימה - כך ייראה</span>
            </div>
            <div className="act-dialog__preview-body">
              <EmailPreviewFrame html={previewHtml} />
            </div>
          </div>
        ) : (
          /* Fallback for system actions */
          <div className="act-dialog__preview">
            <div className="act-dialog__preview-header">
              <span className="act-dialog__preview-icon">👁</span>
              <span>תצוגה מקדימה</span>
            </div>
            {action.preview.map((line, i) => (
              <div key={i} className="act-dialog__preview-line">{line}</div>
            ))}
          </div>
        )}

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
  eventSlug,
  eventName,
  eventDate,
  status,
  onToggleWA,
  onTrigger,
  onRegenerateToken,
  isArchived,
}: MessagingControlsProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const portalUrl = status.portalToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/guest-upload/${eventSlug}?k=${status.portalToken}`
    : null;

  const handleAction = useCallback(async (actionId: string) => {
    setLoading(true);
    try {
      let result: { ok: boolean; error?: string; sent?: number; token?: string };

      switch (actionId) {
        case 'send_pre_event':
          result = await onTrigger(eventId, 'pre_event');
          if (result.ok) alert(`✅ נשלחו ${result.sent ?? 0} הודעות`);
          else alert(result.error || 'שגיאה');
          break;

        case 'send_feedback':
          result = await onTrigger(eventId, 'feedback');
          if (result.ok) alert(`✅ נשלחו ${result.sent ?? 0} הודעות פידבק`);
          else alert(result.error || 'שגיאה');
          break;

        case 'toggle_wa': {
          const next = !status.messagesEnabled;
          result = await onToggleWA(eventId, { messagesEnabled: next });
          if (result.ok) alert(next ? '✅ הודעות הופעלו' : '✅ הודעות כובו');
          else alert(result.error || 'שגיאה');
          break;
        }

        case 'regenerate_token':
          result = await onRegenerateToken(eventId);
          if (result.ok) alert('✅ טוקן חדש נוצר - שלח ללקוח את הלינק החדש');
          else alert(result.error || 'שגיאה');
          break;

        default:
          break;
      }
    } finally {
      setLoading(false);
      setActiveDialog(null);
    }
  }, [eventId, onTrigger, onToggleWA, onRegenerateToken, status.messagesEnabled]);

  const openAction = (actionId: string) => {
    setActiveDialog(actionId);
  };

  const getActionDef = (id: string): ActionDef | undefined => {
    if (id === 'toggle_wa') {
      return {
        id: 'toggle_wa',
        label: status.messagesEnabled ? 'כבה הודעות' : 'הפעל הודעות',
        icon: status.messagesEnabled ? '🔴' : '✅',
        target: 'guests',
        channel: 'system',
        description: status.messagesEnabled
          ? 'מכבה את שירות ההודעות - לא יישלחו הודעות לאורחים.'
          : 'מפעיל את שירות ההודעות - יאפשר שליחת הזמנות ופידבק לאורחים.',
        preview: status.messagesEnabled
          ? ['⚠️ הודעות עתידיות (Pre-Event, פידבק) לא יישלחו', '🔧 ניתן להפעיל מחדש בכל עת']
          : ['✅ יפעיל שליחת הודעות לאורחים ברשימה', '📱 הודעות Pre-Event ופידבק יישלחו לפי לוח הזמנים'],
        confirmLabel: status.messagesEnabled ? 'כבה הודעות' : 'הפעל הודעות',
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
        description: 'מייצר טוקן פורטל חדש. הטוקן הישן יפסיק לעבוד - הלקוח יצטרך לינק חדש.',
        preview: [
          '🔧 פעולת מערכת',
          '⚠️ הטוקן הישן של הפורטל יפסיק לעבוד מיד',
          '📋 תצטרך לשלוח ללקוח את הלינק החדש',
        ],
        confirmLabel: 'צור טוקן חדש',
        dangerLevel: 'warning',
      };
    }
    return [...GUEST_ACTIONS].find(a => a.id === id);
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
            <span className="msg-status-label">הודעות</span>
            <span className={`admin-badge ${status.messagesEnabled ? 'admin-badge--active' : 'admin-badge--ended'}`}>
              {status.messagesEnabled ? '✅ פעיל' : '🔴 כבוי'}
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
              aria-label="קישור פורטל העלאת אורחים"
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
          <h3 className="ea-section__title">⚡ פעולות הודעות</h3>

          {/* Guest actions */}
          <div className="act-group">
            <div className="act-group__header">
              <span className="act-group__badge act-group__badge--guests">👥 פעולות מול האורחים</span>
              <span className="act-group__hint">הודעות לרשימת הטלפונים</span>
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
                className={`act-card ${status.messagesEnabled ? 'act-card--danger' : 'act-card--success'}`}
                onClick={() => openAction('toggle_wa')}
              >
                <span className="act-card__icon">{status.messagesEnabled ? '🔴' : '✅'}</span>
                <span className="act-card__label">{status.messagesEnabled ? 'כבה הודעות' : 'הפעל הודעות'}</span>
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
          previewHtml={activeDialog ? generateEmailPreview(activeDialog, eventName, eventDate) : null}
        />
      )}
    </>
  );
}
