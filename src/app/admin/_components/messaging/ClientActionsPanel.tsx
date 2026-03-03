'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ClientActionsPanelProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  onSendEmail: (eventId: string, type: string, opts?: { subject?: string; body?: string }) => Promise<{ ok: boolean; error?: string }>;
  onSendQrPage: (eventId: string, files: File[], qrOnly?: boolean) => Promise<{ ok: boolean; error?: string }>;
  isArchived: boolean;
}

/* ── Action definitions ── */

interface ActionDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  preview: string[];
  confirmLabel: string;
}

const CLIENT_ACTIONS: ActionDef[] = [
  {
    id: 'upload_reminder',
    label: 'תזכורת העלאה',
    icon: '⏰',
    description: 'שולח ללקוח תזכורת שעדיין לא העלה רשימת אורחים (תזכורת 7 ימים).',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "תזכורת - העלו רשימת אורחים"',
      '📎 כולל: קישור לפורטל, כמה ימים נותרו, מועד שליחת הודעות',
    ],
    confirmLabel: 'שלח תזכורת',
  },
  {
    id: 'summary',
    label: 'סיכום אירוע',
    icon: '📊',
    description: 'שולח ללקוח דו"ח סיכום אחרי האירוע - סטטיסטיקות, התאמות, הודעות.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: "סיכום האירוע שלך"',
      '📎 כולל: מספר משתתפים, לייקים, התאמות, שיחות, הודעות WA שנשלחו',
    ],
    confirmLabel: 'שלח סיכום',
  },
  {
    id: 'custom',
    label: 'מייל חופשי',
    icon: '✏️',
    description: 'שולח ללקוח מייל עם נושא ותוכן שאתה כותב. לתקשורת אישית.',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📝 נושא: אתה בוחר',
      '📎 תוכן: אתה כותב - טקסט חופשי',
    ],
    confirmLabel: 'כתוב ושלח',
  },
  {
    id: 'qr_page',
    label: 'שלח דף QR',
    icon: '📎',
    description: 'שולח ללקוח את דף ה-A4 עם קוד QR להדפסה, כולל גרסאות שונות (PDF, תמונה, ברקוד בלבד).',
    preview: [
      '📧 מייל אל: הלקוח שהזמין את השירות',
      '📎 צרופות: PDF, PDF עם שוליים, תמונה, ברקוד בלבד',
      '📝 הסבר: הדפיסו ופזרו באירוע',
    ],
    confirmLabel: 'שלח עם קבצים',
  },
];

/* ── Helpers ── */

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

function generateEmailPreview(actionId: string, eventName: string, eventDate: string, customSubject?: string, customBody?: string, qrOnly?: boolean): string | null {
  const safeName = eventName.replace(/</g, '&lt;');
  const date = fmtDateHe(eventDate);
  const time = fmtTimeHe(eventDate);
  const uploadLink = '#';

  switch (actionId) {
    case 'upload_reminder': return emailShell('תזכורת העלאה', `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px 4px;border-bottom:1px solid ${PE.border};background:${PE.card};">
        <div style="font-size:15px;font-weight:500;">שלום [שם הלקוח],</div>
        <div style="font-size:13px;color:${PE.muted};margin-top:6px;line-height:1.6;">האירוע <strong>${safeName}</strong> בעוד <strong>7</strong> ימים ועדיין לא העליתם את רשימת האורחים.</div>
        <div style="font-size:13px;color:${PE.muted};line-height:1.6;padding-bottom:16px;">כדי שנוכל לשלוח הודעות <span dir="ltr">WhatsApp</span> לאורחים, אנחנו צריכים את רשימת המספרים.</div>
      </td></tr>
      <tr><td style="padding:20px 24px;text-align:center;background:${PE.card};">
        <a href="${uploadLink}" style="display:inline-block;background:${PE.accent};border-radius:10px;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">העלו את הרשימה עכשיו</a>
        <div style="font-size:11px;color:${PE.dim};margin-top:10px;">ההודעות נשלחות 2-3 שעות לפני האירוע. ככל שתעלו מוקדם יותר, כך יותר טוב!</div>
      </td></tr>`, 'תזכורת מוקדמת');

    case 'summary': return emailShell('סיכום אירוע', `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px 4px;border-bottom:1px solid ${PE.border};background:${PE.card};">
        <div style="font-size:15px;font-weight:500;">שלום [שם הלקוח],</div>
        <div style="font-size:13px;color:${PE.muted};margin-top:6px;line-height:1.6;padding-bottom:16px;">האירוע <strong>${safeName}</strong> הסתיים! הנה סיכום קצר:</div>
      </td></tr>
      <tr><td dir="rtl" style="text-align:right;padding:16px 24px 0;background:${PE.card};">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${PE.accent};margin-bottom:10px;">נתוני האירוע</div>
        <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${peRow('משתתפים', '[XX]')}
          ${peRow('הגיעו מ-WhatsApp', '[XX]')}
          ${peRow('הגיעו מ-QR', '[XX]')}
          ${peRow('התאמות (Matches)', '[XX]')}
          ${peRow('הודעות שנשלחו', '[XX/XX]')}
          ${peRow('פידבקים שנשלחו', '[XX]', true)}
        </table>
      </td></tr>
      <tr><td style="padding:20px 24px;text-align:center;background:${PE.card};">
        <div style="font-size:13px;color:${PE.muted};line-height:1.7;">תודה שבחרתם ב-Eventa!<br/>נשמח לארח אתכם שוב.</div>
      </td></tr>`, 'סיכום אירוע');

    case 'custom': {
      const subj = customSubject || 'נושא שתבחרו';
      const body = customBody || 'התוכן שתכתבו יופיע כאן...';
      return emailShell('תזכורת מ-Eventa', `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px 4px;border-bottom:1px solid ${PE.border};background:${PE.card};">
        <div style="font-size:15px;font-weight:500;">שלום [שם הלקוח],</div>
        <div style="font-size:13px;color:${PE.muted};margin-top:6px;line-height:1.6;padding-bottom:16px;">בנוגע לאירוע <strong>${safeName}</strong>:</div>
      </td></tr>
      <tr><td dir="rtl" style="text-align:right;padding:16px 24px;background:${PE.card};">
        <div style="font-size:10px;font-weight:700;color:${PE.accent};margin-bottom:8px;">נושא: ${subj.replace(/</g, '&lt;')}</div>
        <div style="background:${PE.accentBg};border-right:3px solid ${PE.accent};border-radius:6px;padding:14px 16px;font-size:13px;color:${PE.text};line-height:1.8;white-space:pre-line;">${body.replace(/</g, '&lt;')}</div>
      </td></tr>`, 'תזכורת');
    }

    case 'qr_page': {
      const greetingLine = qrOnly
        ? `הדפיסו את הקוד ופזרו אותו באירוע - האורחים סורקים את הקוד ונכנסים ישירות לאפליקציה.`
        : `הדפיסו את הדף ופזרו אותו באירוע - האורחים סורקים את הקוד ונכנסים ישירות לאפליקציה.`;
      const subjectLine = qrOnly
        ? `קוד ה-QR לאירוע <strong>${safeName}</strong> מוכן!`
        : `דף ה-QR לאירוע <strong>${safeName}</strong> מוכן!`;
      const attachRows = qrOnly
        ? `${peRow('1', 'קוד QR - תמונת הקוד לשימוש חופשי, לשיתוף או להדפסה', true)}`
        : `${peRow('1', 'PDF A4 להדפסה רגילה')}
          ${peRow('2', 'PDF A4 עם שוליים לחיתוך')}
          ${peRow('3', 'תמונה (PNG/JPG)')}
          ${peRow('4', 'קוד QR בלבד', true)}`;
      const tipText = qrOnly
        ? `הדפיסו את הקוד ופזרו אותו באירוע - בכניסה, על הברים, על השולחנות, על תאי השירותים - בכל מקום נגיש לאורחים.<br/><br/>ככל שיהיו יותר עותקים, כך יותר אורחים יצטרפו!`
        : `ממליצים להדפיס עותקים מהדף ולפזר באירוע - בכניסה, על הברים, על השולחנות, על תאי השירותים - בכל מקום נגיש לאורחים.<br/><br/>ככל שיהיו יותר עותקים, כך יותר אורחים יצטרפו!<br/><br/>כאשר מדפיסים, כדאי להדפיס את הגרסה עם השוליים - רוב המדפסות לא תומכות בהדפסה ללא שוליים בכלל, וחלק מהדף עלול להיחתך.`;
      return emailShell(qrOnly ? 'קוד QR' : 'דף QR להדפסה', `
      <tr><td dir="rtl" style="text-align:right;padding:20px 24px 4px;border-bottom:1px solid ${PE.border};background:${PE.card};">
        <div style="font-size:15px;font-weight:500;">שלום [שם הלקוח],</div>
        <div style="font-size:13px;color:${PE.muted};margin-top:6px;line-height:1.6;">${subjectLine}</div>
        <div style="font-size:13px;color:${PE.muted};line-height:1.6;padding-bottom:16px;">${greetingLine}</div>
      </td></tr>
      <tr><td dir="rtl" style="text-align:right;padding:16px 24px;background:${PE.card};">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${PE.accent};margin-bottom:10px;">מה מצורף?</div>
        <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${attachRows}
        </table>
      </td></tr>
      <tr><td style="padding:16px 24px 20px;background:${PE.card};">
        <div style="background:${PE.accentBg};border-right:3px solid ${PE.accent};border-radius:6px;padding:12px 16px;font-size:12px;color:${PE.muted};line-height:1.7;direction:rtl;text-align:right;">${tipText}</div>
      </td></tr>`, qrOnly ? 'קוד QR מוכן' : 'דף QR מוכן');
    }

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

/* ── Action Dialog ── */

function ActionDialog({ action, onConfirm, onCancel, loading, previewHtml, customFields }: {
  action: ActionDef;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  previewHtml: string | null;
  customFields?: React.ReactNode;
}) {
  return (
    <div className="act-dialog-overlay" onClick={onCancel}>
      <div className="act-dialog" onClick={e => e.stopPropagation()}>
        <div className="act-dialog__header">
          <span className="act-dialog__icon">{action.icon}</span>
          <h3 className="act-dialog__title">{action.label}</h3>
          <button className="act-dialog__close" onClick={onCancel} aria-label="סגור">✕</button>
        </div>

        <div className="act-dialog__meta">
          <span className="act-chip act-chip--target">👤 ללקוח</span>
          <span className="act-chip act-chip--channel">📧 אימייל</span>
        </div>

        <p className="act-dialog__desc">{action.description}</p>

        {customFields}

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

        <div className="act-dialog__actions">
          <button className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={loading}>
            ביטול
          </button>
          <button className="admin-btn admin-btn--primary" onClick={onConfirm} disabled={loading}>
            {loading ? '⏳ שולח…' : `${action.icon} ${action.confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function ClientActionsPanel({
  eventId,
  eventName,
  eventDate,
  onSendEmail,
  onSendQrPage,
  isArchived,
}: ClientActionsPanelProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [qrFiles, setQrFiles] = useState<File[]>([]);
  const [qrOnly, setQrOnly] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleAction = useCallback(async (actionId: string) => {
    setLoading(true);
    try {
      let result: { ok: boolean; error?: string };

      switch (actionId) {
        case 'upload_reminder':
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

        case 'qr_page': {
          if (qrFiles.length === 0) {
            alert('נא להעלות לפחות קובץ אחד');
            setLoading(false);
            return;
          }
          result = await onSendQrPage(eventId, qrFiles, qrOnly);
          if (result.ok) {
            alert('✅ דף ה-QR נשלח ללקוח');
            setQrFiles([]);
            setQrOnly(false);
          } else {
            alert(result.error || 'שגיאה');
          }
          break;
        }

        default:
          break;
      }
    } finally {
      setLoading(false);
      setActiveDialog(null);
    }
  }, [eventId, onSendEmail, onSendQrPage, customSubject, customBody, qrFiles, qrOnly]);

  const openAction = (actionId: string) => {
    setActiveDialog(actionId);
    if (actionId === 'custom') {
      setCustomSubject('');
      setCustomBody('');
    }
    if (actionId === 'qr_page') {
      setQrFiles([]);
    }
  };

  const currentAction = activeDialog
    ? CLIENT_ACTIONS.find(a => a.id === activeDialog) || null
    : null;

  if (isArchived) return null;

  return (
    <>
      <div className="ea-section">
        <h3 className="ea-section__title">📧 פעולות מול הלקוח</h3>
        <p style={{ fontSize: 13, color: 'var(--admin-muted)', marginBottom: 12 }}>אימייל ללקוח שהזמין את השירות</p>
        <div className="act-grid">
          {CLIENT_ACTIONS.map(a => (
            <button
              key={a.id}
              className="act-card"
              onClick={() => openAction(a.id)}
            >
              <span className="act-card__icon">{a.icon}</span>
              <span className="act-card__label">{a.label}</span>
              <span className="act-card__channel">📧</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action dialog */}
      {currentAction && (
        <ActionDialog
          action={currentAction}
          onConfirm={() => handleAction(activeDialog!)}
          onCancel={() => setActiveDialog(null)}
          loading={loading}
          previewHtml={activeDialog ? generateEmailPreview(activeDialog, eventName, eventDate, customSubject, customBody, qrOnly) : null}
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
          ) : activeDialog === 'qr_page' ? (
            <div className="act-dialog__custom">
              <label className="act-dialog__field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={qrOnly}
                  onChange={(e) => setQrOnly(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#b08d7e' }}
                />
                <span>QR בלבד (ללא דף A4 מעוצב)</span>
              </label>
              <label className="act-dialog__field-label">העלו קבצים לצירוף {qrOnly ? '(תמונת QR)' : '(PDF, תמונה, ברקוד)'}</label>
              <div className="act-qr-upload">
                <input
                  ref={qrInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setQrFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--ghost"
                  onClick={() => qrInputRef.current?.click()}
                >
                  📎 הוסיפו קבצים
                </button>
                {qrFiles.length > 0 && (
                  <div className="act-qr-files">
                    {qrFiles.map((f, i) => (
                      <div key={i} className="act-qr-file">
                        <span className="act-qr-file__name">
                          {f.type.startsWith('image/') ? '🖼' : '📄'} {f.name}
                        </span>
                        <span className="act-qr-file__size">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          className="act-qr-file__remove"
                          onClick={() => setQrFiles(prev => prev.filter((_, j) => j !== i))}
                          title="הסר"
                        >✕</button>
                      </div>
                    ))}
                    <div className="act-qr-files__total">
                      סה&quot;כ: {qrFiles.length} קבצים ({(qrFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : undefined}
        />
      )}
    </>
  );
}
