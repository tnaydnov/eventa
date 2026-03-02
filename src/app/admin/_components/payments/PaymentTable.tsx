'use client';

import { useState, useMemo } from 'react';
import {
  PAYMENT_STATUS_DISPLAY,
  PAYMENT_METHOD_LABELS,
  DOCUMENT_TYPES,
  formatILS,
  type EventRequest,
} from '../shared';

type PaymentFilter = 'all' | 'pending' | 'paid' | 'waived' | 'expired';

interface PaymentTableProps {
  requests: EventRequest[];
  onMarkAsPaid: (requestId: string, method: string) => Promise<{ ok: boolean; error?: string }>;
  onWaivePayment: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onResendPaymentLink: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onGenerateDocument: (request: EventRequest) => void;
}

export default function PaymentTable({
  requests, onMarkAsPaid, onWaivePayment, onResendPaymentLink, onGenerateDocument,
}: PaymentTableProps) {
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [payMethodId, setPayMethodId] = useState<string | null>(null);

  // Filter out not_applicable rows and apply filter
  const payableRequests = useMemo(() => {
    return requests.filter(r => r.payment_status !== 'not_applicable');
  }, [requests]);

  const filtered = useMemo(() => {
    if (filter === 'all') return payableRequests;
    if (filter === 'pending') {
      return payableRequests.filter(r =>
        r.payment_status === 'pending_payment' || r.payment_status === 'payment_link_sent'
      );
    }
    return payableRequests.filter(r => r.payment_status === filter);
  }, [payableRequests, filter]);

  // Counts for filter tabs
  const counts = useMemo(() => {
    const c = { all: payableRequests.length, pending: 0, paid: 0, waived: 0, expired: 0 };
    for (const r of payableRequests) {
      if (r.payment_status === 'pending_payment' || r.payment_status === 'payment_link_sent') c.pending++;
      else if (r.payment_status === 'paid') c.paid++;
      else if (r.payment_status === 'waived') c.waived++;
      else if (r.payment_status === 'expired') c.expired++;
    }
    return c;
  }, [payableRequests]);

  const handleAction = async (
    requestId: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    setProcessingId(requestId);
    try {
      const res = await action();
      if (!res.ok) alert(res.error || 'שגיאה');
    } finally {
      setProcessingId(null);
    }
  };

  const FILTERS: { key: PaymentFilter; label: string; emoji: string }[] = [
    { key: 'all', label: 'הכל', emoji: '📋' },
    { key: 'pending', label: 'ממתינים', emoji: '⏳' },
    { key: 'paid', label: 'שולמו', emoji: '✅' },
    { key: 'waived', label: 'בוטלו', emoji: '🎁' },
    { key: 'expired', label: 'פג תוקף', emoji: '⏰' },
  ];

  return (
    <div className="pay-table">
      {/* Filter tabs */}
      <div className="pay-table__tabs">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`req-tab ${filter === f.key ? 'req-tab--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.emoji} {f.label}
            <span className="req-tab__count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="req-empty">
          <div className="req-empty__icon">💸</div>
          <div className="req-empty__text">אין תשלומים בקטגוריה זו</div>
        </div>
      ) : (
        <div className="et-wrap">
          <table className="et-table">
            <thead>
              <tr>
                <th className="et-th">לקוח</th>
                <th className="et-th">סוג אירוע</th>
                <th className="et-th">סכום</th>
                <th className="et-th">סטטוס</th>
                <th className="et-th">אמצעי תשלום</th>
                <th className="et-th">תאריך תשלום</th>
                <th className="et-th">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const statusDisplay = PAYMENT_STATUS_DISPLAY[r.payment_status] || {
                  label: r.payment_status, emoji: '❓', color: 'admin-badge--muted',
                };
                const isProcessing = processingId === r.id;

                return (
                  <tr key={r.id} className="et-row">
                    {/* Customer */}
                    <td className="et-td">
                      <div className="pay-table__customer">
                        <span className="pay-table__customer-name">
                          {r.contact_name || '—'}
                        </span>
                        {r.contact_phone && (
                          <span className="pay-table__customer-phone">{r.contact_phone}</span>
                        )}
                      </div>
                    </td>

                    {/* Event type */}
                    <td className="et-td">
                      <span className="pay-table__event-type">{r.event_type}</span>
                      {r.event_name && (
                        <span className="pay-table__event-name">{r.event_name}</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="et-td">
                      <span className="pay-table__amount">{formatILS(r.total_price)}</span>
                    </td>

                    {/* Status badge */}
                    <td className="et-td">
                      <span className={`admin-badge ${statusDisplay.color}`}>
                        {statusDisplay.emoji} {statusDisplay.label}
                      </span>
                    </td>

                    {/* Payment method */}
                    <td className="et-td">
                      {r.payment_method
                        ? (PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method)
                        : '—'}
                    </td>

                    {/* Payment date */}
                    <td className="et-td">
                      {r.paid_at
                        ? new Date(r.paid_at).toLocaleDateString('he-IL')
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="et-td">
                      <div className="pay-table__actions">
                        {/* Pending actions */}
                        {(r.payment_status === 'pending_payment' || r.payment_status === 'payment_link_sent') && (
                          <>
                            {/* Mark as paid with method selection */}
                            {payMethodId === r.id ? (
                              <div className="pay-table__method-select">
                                <select
                                  className="admin-select"
                                  defaultValue=""
                                  disabled={isProcessing}
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    handleAction(r.id, () => onMarkAsPaid(r.id, e.target.value));
                                    setPayMethodId(null);
                                  }}
                                >
                                  <option value="" disabled>בחר אמצעי...</option>
                                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                                <button
                                  className="admin-btn admin-btn--ghost admin-btn--sm"
                                  onClick={() => setPayMethodId(null)}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                className="admin-btn admin-btn--green admin-btn--sm"
                                disabled={isProcessing}
                                onClick={() => setPayMethodId(r.id)}
                              >
                                ✅ סמן שולם
                              </button>
                            )}

                            {r.payment_status === 'payment_link_sent' && (
                              <button
                                className="admin-btn admin-btn--ghost admin-btn--sm"
                                disabled={isProcessing}
                                onClick={() => handleAction(r.id, () => onResendPaymentLink(r.id))}
                              >
                                📧 שלח שוב
                              </button>
                            )}

                            <button
                              className="admin-btn admin-btn--ghost admin-btn--sm"
                              disabled={isProcessing}
                              onClick={() => {
                                if (confirm('לוותר על התשלום?')) {
                                  handleAction(r.id, () => onWaivePayment(r.id));
                                }
                              }}
                            >
                              🎁 ויתור
                            </button>
                          </>
                        )}

                        {/* Generate document (any payable request) */}
                        {r.payment_status === 'paid' && (
                          <button
                            className="admin-btn admin-btn--primary admin-btn--sm"
                            onClick={() => onGenerateDocument(r)}
                          >
                            🧾 הפק חשבונית
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
