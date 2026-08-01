'use client';

import { useState, useMemo } from 'react';
import type { EventRequest } from '../shared';

const EVENT_TYPE_LABELS: Record<string, string> = {
  speed_dating: 'ספיד דייטינג',
  party: 'מסיבה',
  networking: 'נטוורקינג',
  singles_event: 'אירוע רווקים',
  wedding: 'חתונה',
  meetup: 'מיטאפ',
  other: 'אחר',
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

const fmtDate = (d: string | null) => {
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));
  } catch { return d; }
};

export default function RequestsView({ requests, onApprove, onDeny, onDelete, onSendPaymentLink, onReload }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const c = { all: requests.length, pending: 0, approved: 0, denied: 0 };
    for (const r of requests) { if (r.status in c) c[r.status as keyof typeof c]++; }
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    const list = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    return [...list].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests, filter]);

  const handleApprove = async (id: string) => {
    if (!confirm('לאשר את הבקשה? האירוע ייווצר אוטומטית.')) return;
    setProcessingId(id);
    const result = await onApprove(id, adminNotes[id]);
    setProcessingId(null);
    if (result.ok) { alert('הבקשה אושרה והאירוע נוצר!'); }
    else { alert(result.error || 'שגיאה באישור הבקשה'); }
  };

  const handleDeny = async (id: string) => {
    if (!confirm('לדחות את הבקשה?')) return;
    setProcessingId(id);
    const result = await onDeny(id, adminNotes[id]);
    setProcessingId(null);
    if (!result.ok) alert(result.error || 'שגיאה בדחיית הבקשה');
  };

  const handleDelete = async (req: EventRequest) => {
    if (!confirm('למחוק את הבקשה?')) return;
    setProcessingId(req.id);
    const result = await onDelete(req.id);
    setProcessingId(null);
    if (!result.ok) alert(result.error || 'שגיאה במחיקת הבקשה');
  };

  const handleSendPaymentLink = async (id: string) => {
    if (!confirm('לשלוח קישור תשלום ללקוח?')) return;
    setProcessingId(id);
    const result = await onSendPaymentLink(id);
    setProcessingId(null);
    if (!result.ok) alert(result.error || 'שגיאה בשליחת קישור תשלום');
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all',      label: 'הכל' },
    { key: 'pending',  label: 'ממתינות' },
    { key: 'approved', label: 'אושרו' },
    { key: 'denied',   label: 'נדחו' },
  ];

  const reqBadgeClass: Record<string, string> = {
    pending:  'req-badge--pending',
    approved: 'req-badge--approved',
    denied:   'req-badge--denied',
  };

  const reqCardClass: Record<string, string> = {
    pending:  'req-card--pending',
    approved: 'req-card--approved',
    denied:   'req-card--denied',
  };

  const reqStatusLabel: Record<string, string> = {
    pending:  'ממתינה',
    approved: 'אושרה',
    denied:   'נדחתה',
  };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar__title">בקשות אירועים</h2>
          <p className="admin-topbar__subtitle">
            {counts.pending > 0 ? `${counts.pending} בקשות ממתינות לאישור` : 'אין בקשות ממתינות'}
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={onReload}>
          רענון
        </button>
      </div>

      {/* Filter tabs */}
      <div className="admin-tabs" role="tablist" aria-label="סינון בקשות">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            className={`admin-tab ${filter === tab.key ? 'admin-tab--active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            <span className="admin-tab__count">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="admin-empty">
          <div className="admin-empty__icon">-</div>
          <p className="admin-empty__text">
            {filter === 'all' ? 'אין בקשות עדיין' : 'אין בקשות בסטטוס זה'}
          </p>
        </div>
      )}

      {filtered.map(req => {
        const isExpanded = expandedId === req.id;
        const isProcessing = processingId === req.id;

        return (
          <div key={req.id} className={`req-card ${reqCardClass[req.status] || ''}`}>
            {/* Header */}
            <div
              className="req-head"
              onClick={() => setExpandedId(isExpanded ? null : req.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : req.id); } }}
              aria-expanded={isExpanded}
            >
              <div className="req-head__info">
                <div className="req-head__name">{req.event_name || req.contact_name || 'ללא שם'}</div>
                <div className="req-head__meta">
                  {req.contact_name && <span>{req.contact_name}</span>}
                  {req.event_type && <span>{EVENT_TYPE_LABELS[req.event_type] || req.event_type}</span>}
                  {req.starts_at && <span>{fmtDate(req.starts_at)}</span>}
                </div>
              </div>
              <div className="req-head__right">
                <span className={`req-badge ${reqBadgeClass[req.status] || ''}`}>
                  {reqStatusLabel[req.status] || req.status}
                </span>
                <span className={`req-chevron ${isExpanded ? 'req-chevron--open' : ''}`} aria-hidden="true">
                  v
                </span>
              </div>
            </div>

            {/* Body */}
            {isExpanded && (
              <div className="req-body">
                <div className="req-details">
                  {req.contact_name && (
                    <div>
                      <div className="req-detail__label">שם לקוח</div>
                      <div className="req-detail__value">{req.contact_name}</div>
                    </div>
                  )}
                  {req.contact_phone && (
                    <div>
                      <div className="req-detail__label">טלפון</div>
                      <div className="req-detail__value" dir="ltr">{req.contact_phone}</div>
                    </div>
                  )}
                  {req.contact_email && (
                    <div>
                      <div className="req-detail__label">אימייל</div>
                      <div className="req-detail__value">{req.contact_email}</div>
                    </div>
                  )}
                  {req.event_type && (
                    <div>
                      <div className="req-detail__label">סוג אירוע</div>
                      <div className="req-detail__value">{EVENT_TYPE_LABELS[req.event_type] || req.event_type}</div>
                    </div>
                  )}
                  {req.starts_at && (
                    <div>
                      <div className="req-detail__label">תחילת אירוע</div>
                      <div className="req-detail__value">{fmtDate(req.starts_at)}</div>
                    </div>
                  )}
                  {req.ends_at && (
                    <div>
                      <div className="req-detail__label">סיום אירוע</div>
                      <div className="req-detail__value">{fmtDate(req.ends_at)}</div>
                    </div>
                  )}
                  {req.contact_preference && (
                    <div>
                      <div className="req-detail__label">יצירת קשר</div>
                      <div className="req-detail__value">{req.contact_preference}</div>
                    </div>
                  )}
                  {req.created_at && (
                    <div>
                      <div className="req-detail__label">נוצרה</div>
                      <div className="req-detail__value">{fmtDate(req.created_at)}</div>
                    </div>
                  )}
                </div>

                {/* Notes from client */}
                {req.special_requests && (
                  <div>
                    <div className="req-detail__label" style={{ marginBottom: 6 }}>הערות לקוח</div>
                    <div style={{
                      background: 'var(--admin-surface-2)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 'var(--admin-radius-sm)',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: 'var(--admin-text-dim)',
                      lineHeight: 1.5,
                    }}>
                      {req.special_requests}
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                {req.status === 'pending' && (
                  <div className="req-notes">
                    <input
                      className="admin-input"
                      placeholder="הערות לאדמין (אופציונלי)..."
                      value={adminNotes[req.id] || ''}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="req-actions">
                  {req.status === 'pending' && (
                    <>
                      <button
                        className="admin-btn admin-btn--green"
                        onClick={() => handleApprove(req.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? '...' : 'אשר'}
                      </button>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => handleDeny(req.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? '...' : 'דחה'}
                      </button>
                      <button
                        className="admin-btn admin-btn--ghost"
                        onClick={() => handleSendPaymentLink(req.id)}
                        disabled={isProcessing}
                      >
                        שלח קישור תשלום
                      </button>
                    </>
                  )}
                  <button
                    className="admin-btn admin-btn--danger admin-btn--sm"
                    onClick={() => handleDelete(req)}
                    disabled={isProcessing}
                    style={{ marginRight: 'auto' }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}