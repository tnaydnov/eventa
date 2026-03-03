'use client';

import { useState } from 'react';
import {
  DOCUMENT_TYPES,
  formatILS,
  adminFetch,
  type LocalInvoice,
} from '../shared';

interface DocumentHistoryProps {
  invoices: LocalInvoice[];
  loading: boolean;
  onReload: () => void;
}

export default function DocumentHistory({ invoices, loading, onReload }: DocumentHistoryProps) {
  const [creditNoteTarget, setCreditNoteTarget] = useState<LocalInvoice | null>(null);
  const [creditReason, setCreditReason] = useState('');
  const [processingCredit, setProcessingCredit] = useState(false);

  const handleCreditNote = async () => {
    if (!creditNoteTarget) return;

    setProcessingCredit(true);
    try {
      const res = await adminFetch('/api/admin/invoices', {
        method: 'POST',
        body: JSON.stringify({
          action: 'credit_note',
          originalDocId: creditNoteTarget.invoice4u_doc_id,
          originalInvoiceId: creditNoteTarget.id,
          customerName: creditNoteTarget.customer_name || 'לקוח',
          customerEmail: creditNoteTarget.customer_email || undefined,
          items: [{
            name: `זיכוי עבור מסמך ${creditNoteTarget.invoice4u_doc_number || creditNoteTarget.invoice4u_doc_id}`,
            price: Math.abs(creditNoteTarget.total_amount),
            quantity: 1,
          }],
          reason: creditReason || 'ביטול עסקה',
          sendByEmail: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ חשבונית זיכוי ${data.document.number} הופקה בהצלחה`);
        setCreditNoteTarget(null);
        setCreditReason('');
        onReload();
      } else {
        alert(data.error || 'שגיאה בהפקת חשבונית זיכוי');
      }
    } catch {
      alert('שגיאת תקשורת');
    } finally {
      setProcessingCredit(false);
    }
  };

  if (loading) {
    return (
      <div className="pay-docs">
        <div className="pay-docs__loading">⏳ טוען מסמכים...</div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="pay-docs">
        <div className="req-empty">
          <div className="req-empty__icon">📭</div>
          <div className="req-empty__text">עדיין לא הופקו מסמכים</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pay-docs">
      <div className="et-wrap">
        <table className="et-table">
          <thead>
            <tr>
              <th className="et-th">מס׳</th>
              <th className="et-th">סוג</th>
              <th className="et-th">לקוח</th>
              <th className="et-th">סכום</th>
              <th className="et-th">מע"מ</th>
              <th className="et-th">סטטוס</th>
              <th className="et-th">תאריך</th>
              <th className="et-th">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => {
              const typeLabel = DOCUMENT_TYPES[inv.invoice4u_doc_type as keyof typeof DOCUMENT_TYPES]
                || inv.doc_type_label;
              const isCancelled = inv.status === 'cancelled';
              const isCreditNote = inv.invoice4u_doc_type === 4;

              return (
                <tr
                  key={inv.id}
                  className={`et-row ${isCancelled ? 'et-row--cancelled' : ''}`}
                >
                  <td className="et-td">
                    <span className="pay-docs__doc-number">
                      {inv.invoice4u_doc_number || '-'}
                    </span>
                  </td>
                  <td className="et-td">
                    <span className={`admin-badge ${isCreditNote ? 'admin-badge--ended' : 'admin-badge--active'}`}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="et-td">{inv.customer_name || '-'}</td>
                  <td className="et-td">
                    <span className={`pay-docs__amount ${inv.total_amount < 0 ? 'pay-docs__amount--negative' : ''}`}>
                      {formatILS(inv.total_amount)}
                    </span>
                  </td>
                  <td className="et-td">{formatILS(inv.vat_amount)}</td>
                  <td className="et-td">
                    {isCancelled ? (
                      <span className="admin-badge admin-badge--ended">מבוטל</span>
                    ) : (
                      <span className="admin-badge admin-badge--active">פעיל</span>
                    )}
                  </td>
                  <td className="et-td">
                    {new Date(inv.issued_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="et-td">
                    <div className="pay-docs__actions">
                      {inv.invoice4u_doc_url && (
                        <a
                          href={inv.invoice4u_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          📄 צפה
                        </a>
                      )}
                      {!isCancelled && !isCreditNote && (
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setCreditNoteTarget(inv)}
                        >
                          ↩️ זיכוי
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

      {/* Credit Note Dialog */}
      {creditNoteTarget && (
        <div className="admin-overlay" onClick={() => setCreditNoteTarget(null)}>
          <div className="admin-dialog" onClick={e => e.stopPropagation()}>
            <div className="admin-dialog__title">↩️ הפקת חשבונית זיכוי</div>
            <div className="pay-docs__credit-info">
              <p>
                <strong>מסמך מקור:</strong> {creditNoteTarget.doc_type_label} מס׳ {creditNoteTarget.invoice4u_doc_number}
              </p>
              <p>
                <strong>לקוח:</strong> {creditNoteTarget.customer_name}
              </p>
              <p>
                <strong>סכום:</strong> {formatILS(creditNoteTarget.total_amount)}
              </p>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label className="admin-label">סיבת הזיכוי</label>
              <input
                className="admin-input"
                placeholder="ביטול עסקה, החזר כספי..."
                value={creditReason}
                onChange={e => setCreditReason(e.target.value)}
              />
            </div>
            <div className="admin-dialog__actions">
              <button
                className="admin-btn admin-btn--orange"
                onClick={handleCreditNote}
                disabled={processingCredit}
              >
                {processingCredit ? '⏳ מפיק...' : '↩️ הפק זיכוי'}
              </button>
              <button
                className="admin-btn admin-btn--ghost"
                onClick={() => setCreditNoteTarget(null)}
                disabled={processingCredit}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
