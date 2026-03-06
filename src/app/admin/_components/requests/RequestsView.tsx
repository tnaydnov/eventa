'use client';

import { useState, useMemo } from 'react';
import type { EventRequest } from '../shared';
import { PAYMENT_STATUS_DISPLAY, PAYMENT_METHOD_LABELS } from '../shared';
import { BASE_PRICE, MSG_ADDON } from '@/lib/config';

/* ─── Hebrew labels ─── */
const EVENT_TYPE_LABELS: Record<string, string> = {
  speed_dating: 'ספיד דייטינג',
  party: 'מסיבה',
  networking: 'נטוורקינג',
  singles_event: 'אירוע רווקים',
  other: 'אחר',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה',
  approved: 'אושרה',
  denied: 'נדחתה',
};

const CONTACT_LABELS: Record<string, string> = {
  'send-link': 'קישור לתשלום',
  'call-me': 'צור קשר טלפוני',
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'denied';

interface Props {
  requests: EventRequest[];
  onApprove: (requestId: string, adminNotes?: string) => Promise<{ ok: boolean; error?: string }>;
  onDeny: (requestId: string, adminNotes?: string) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onSendPaymentLink: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onReload: () => void;
}

export default function RequestsView({ requests, onApprove, onDeny, onDelete, onSendPaymentLink, onReload }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  /* ─── Counts ─── */
  const counts = useMemo(() => {
    const c = { all: requests.length, pending: 0, approved: 0, denied: 0 };
    for (const r of requests) {
      if (r.status in c) c[r.status as keyof typeof c]++;
    }
    return c;
  }, [requests]);

  /* ─── Filtered & sorted: pending first ─── */
  const filtered = useMemo(() => {
    const list = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    return [...list].sort((a, b) => {
      // Pending always first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests, filter]);

  /* ─── Action handlers ─── */
  const handleApprove = async (id: string) => {
    if (!confirm('לאשר את הבקשה? האירוע ייווצר אוטומטית.')) return;
    setProcessingId(id);
    const result = await onApprove(id, adminNotes[id]);
    setProcessingId(null);
    if (result.ok) {
      alert('✅ הבקשה אושרה והאירוע נוצר!');
    } else {
      alert(result.error || 'שגיאה באישור הבקשה');
    }
  };

  const handleDeny = async (id: string) => {
    if (!confirm('לדחות את הבקשה?')) return;
    setProcessingId(id);
    const result = await onDeny(id, adminNotes[id]);
    setProcessingId(null);
    if (result.ok) {
      alert('❌ הבקשה נדחתה');
    } else {
      alert(result.error || 'שגיאה בדחיית הבקשה');
    }
  };

  const handleDelete = async (req: EventRequest) => {
    const msg = req.status === 'pending'
      ? 'למחוק את הבקשה? הבקשה והאירוע המשויך יימחקו לצמיתות.'
      : 'למחוק את הבקשה? רק רשומת הבקשה תימחק, האירוע יישאר.';
    if (!confirm(msg)) return;
    setProcessingId(req.id);
    const result = await onDelete(req.id);
    setProcessingId(null);
    if (result.ok) {
      alert('🗑️ הבקשה נמחקה');
    } else {
      alert(result.error || 'שגיאה במחיקת הבקשה');
    }
  };

  const handleSendPaymentLink = async (id: string) => {
    if (!confirm('לשלוח קישור תשלום ללקוח?')) return;
    setProcessingId(id);
    const result = await onSendPaymentLink(id);
    setProcessingId(null);
    if (result.ok) {
      alert('📧 קישור תשלום נשלח ללקוח!');
    } else {
      alert(result.error || 'שגיאה בשליחת קישור תשלום');
    }
  };

  /* ─── Format date ─── */
  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    try {
      return new Intl.DateTimeFormat('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(d));
    } catch {
      return d;
    }
  };

  const fmtShortDate = (d: string | null) => {
    if (!d) return '-';
    try {
      return new Intl.DateTimeFormat('he-IL', {
        day: '2-digit', month: '2-digit', year: '2-digit',
      }).format(new Date(d));
    } catch {
      return d;
    }
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'pending', label: 'ממתינות' },
    { key: 'approved', label: 'אושרו' },
    { key: 'denied', label: 'נדחו' },
  ];

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="admin-topbar">
        <div>
          <h1 className="admin-topbar__title">📩 בקשות אירועים</h1>
          <p className="admin-topbar__subtitle">
            {counts.pending > 0
              ? `${counts.pending} בקשות ממתינות לאישור`
              : 'אין בקשות ממתינות'}
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={onReload}>
          🔄 רענון
        </button>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="req-tabs">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            className={`req-tab ${filter === tab.key ? 'req-tab--active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            <span className="req-tab__count">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* ─── Empty state ─── */}
      {filtered.length === 0 && (
        <div className="req-empty">
          <div className="req-empty__icon">📭</div>
          <div className="req-empty__text">
            {filter === 'all' ? 'אין בקשות עדיין' : `אין בקשות ${STATUS_LABELS[filter] || filter}`}
          </div>
        </div>
      )}

      {/* ─── Request cards ─── */}
      <div className="req-list">
        {filtered.map(req => {
          const isExpanded = expandedId === req.id;
          const isProcessing = processingId === req.id;

          return (
            <div
              key={req.id}
              className={`req-card req-card--${req.status}`}
            >
              {/* Card Header - always visible */}
              <div
                className="req-card__header"
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
              >
                <div className="req-card__main">
                  <span className={`admin-badge admin-badge--${req.status === 'pending' ? 'draft' : req.status === 'approved' ? 'active' : 'ended'}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                  <span className="req-card__type">
                    {EVENT_TYPE_LABELS[req.event_type] || req.event_type}
                  </span>
                  <span className="req-card__name">
                    {req.event_name || 'ללא שם'}
                  </span>
                </div>

                <div className="req-card__meta">
                  <span className="req-card__date">{fmtDate(req.created_at)}</span>
                  <span className="req-card__expand">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="req-card__body">
                  {/* Info Grid */}
                  <div className="req-info-grid">
                    <div className="req-info-item">
                      <span className="req-info-label">📅 תאריך התחלה</span>
                      <span className="req-info-value">{fmtDate(req.starts_at)}</span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">🏁 תאריך סיום</span>
                      <span className="req-info-value">{fmtDate(req.ends_at)}</span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">🎨 רקע מותאם</span>
                      <span className="req-info-value">{req.wants_custom_background ? '✅ כן' : '❌ לא'}</span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">🖼️ בחירת פוסטר</span>
                      <span className="req-info-value">{req.poster_choice || '-'}</span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">� חבילה</span>
                      <span className="req-info-value" style={{ fontWeight: 600 }}>
                        {req.wants_guest_messages
                          ? `בסיסית + הודעות = ₪${BASE_PRICE + MSG_ADDON}`
                          : `בסיסית = ₪${BASE_PRICE}`}
                      </span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">�💬 הודעות אורחים</span>
                      <span className="req-info-value">{req.wants_guest_messages ? '✅ כן' : '❌ לא'}</span>
                    </div>
                    <div className="req-info-item">
                      <span className="req-info-label">💳 העדפת קשר</span>
                      <span className="req-info-value">{CONTACT_LABELS[req.contact_preference || ''] || req.contact_preference || '-'}</span>
                    </div>
                  </div>

                  {/* Payment Status (read-only - manage in Payments tab) */}
                  {req.payment_status && req.payment_status !== 'not_applicable' && (
                    <div className="req-payment">
                      <div className="req-payment__status">
                        <span className="req-info-label">💰 סטטוס תשלום</span>
                        <span className={`admin-badge ${PAYMENT_STATUS_DISPLAY[req.payment_status]?.color || ''}`}>
                          {PAYMENT_STATUS_DISPLAY[req.payment_status]?.emoji}{' '}
                          {PAYMENT_STATUS_DISPLAY[req.payment_status]?.label || req.payment_status}
                        </span>
                        {req.total_price > 0 && (
                          <span className="req-info-value" style={{ marginRight: 8 }}>
                            ₪{Math.round(req.total_price / 100)}
                          </span>
                        )}
                      </div>

                      {/* Show payment method if paid */}
                      {req.payment_status === 'paid' && req.payment_method && (
                        <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#a0a0a0' }}>
                          שולם באמצעות: {PAYMENT_METHOD_LABELS[req.payment_method] || req.payment_method}
                        </div>
                      )}

                      {/* Hint to manage payments in dedicated tab */}
                      {req.payment_status !== 'paid' && req.payment_status !== 'waived' && (
                        <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#888' }}>
                          💡 ניהול תשלומים בלשונית &quot;תשלומים וחשבוניות&quot;
                        </div>
                      )}
                    </div>
                  )}

                  {/* Special Requests */}
                  {req.special_requests && (
                    <div className="req-special">
                      <div className="req-special__label">📝 בקשות מיוחדות</div>
                      <div className="req-special__text">{req.special_requests}</div>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="req-contact">
                    <div className="req-contact__label">📞 פרטי קשר</div>
                    <div className="req-contact__grid">
                      {req.contact_name && (
                        <div className="req-contact__item">
                          <span className="req-info-label">שם</span>
                          <span className="req-info-value">{req.contact_name}</span>
                        </div>
                      )}
                      {req.contact_phone && (
                        <div className="req-contact__item">
                          <span className="req-info-label">טלפון</span>
                          <a href={`tel:${req.contact_phone}`} className="req-contact__link">{req.contact_phone}</a>
                        </div>
                      )}
                      {req.contact_email && (
                        <div className="req-contact__item">
                          <span className="req-info-label">אימייל</span>
                          <a href={`mailto:${req.contact_email}`} className="req-contact__link">{req.contact_email}</a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Notes */}
                  {req.status === 'pending' && (
                    <div className="req-notes">
                      <label className="admin-label">הערות אדמין (אופציונלי)</label>
                      <textarea
                        className="admin-input req-notes__textarea"
                        placeholder="הערות פנימיות..."
                        value={adminNotes[req.id] || ''}
                        onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Show admin notes if already processed */}
                  {req.status !== 'pending' && req.admin_notes && (
                    <div className="req-special">
                      <div className="req-special__label">📋 הערות אדמין</div>
                      <div className="req-special__text">{req.admin_notes}</div>
                    </div>
                  )}

                  {/* Reviewed timestamp */}
                  {req.reviewed_at && (
                    <div className="req-reviewed">
                      טופל ב: {fmtDate(req.reviewed_at)}
                    </div>
                  )}

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="req-actions">
                      <button
                        className="admin-btn admin-btn--green"
                        onClick={() => handleApprove(req.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? '⏳ מעבד...' : '✅ אשר וצור אירוע'}
                      </button>
                      {req.payment_status !== 'paid' && req.payment_status !== 'waived' && req.contact_email && (
                        <button
                          className="admin-btn admin-btn--primary"
                          onClick={() => handleSendPaymentLink(req.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? '⏳ מעבד...' : '📧 שלח קישור תשלום'}
                        </button>
                      )}
                      <button
                        className="admin-btn admin-btn--red"
                        onClick={() => handleDeny(req.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? '⏳ מעבד...' : '❌ דחה'}
                      </button>
                      <button
                        className="admin-btn admin-btn--red"
                        onClick={() => handleDelete(req)}
                        disabled={isProcessing}
                        style={{ opacity: 0.75 }}
                      >
                        {isProcessing ? '⏳ מעבד...' : '🗑️ מחק הכל'}
                      </button>
                    </div>
                  )}

                  {/* Link to event if approved */}
                  {req.status === 'approved' && req.approved_event_id && (
                    <div className="req-approved-link">
                      ✅ אירוע נוצר - ניתן למצוא אותו בעמוד האירועים
                    </div>
                  )}

                  {/* Delete for processed requests */}
                  {req.status !== 'pending' && (
                    <div className="req-actions" style={{ marginTop: 8 }}>
                      <button
                        className="admin-btn admin-btn--red"
                        onClick={() => handleDelete(req)}
                        disabled={isProcessing}
                        style={{ opacity: 0.75, fontSize: '0.85rem' }}
                      >
                        {isProcessing ? '⏳ מעבד...' : '🗑️ מחק בקשה'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
