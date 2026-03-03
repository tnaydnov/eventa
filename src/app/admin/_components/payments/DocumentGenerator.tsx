'use client';

import { useState, useEffect } from 'react';
import {
  COMMON_DOC_TYPES,
  INVOICE4U_PAYMENT_TYPES,
  PAYMENT_METHOD_LABELS,
  formatILS,
  adminFetch,
  type EventRequest,
} from '../shared';

interface DocumentGeneratorProps {
  /** Pre-fill from a specific request (optional) */
  request?: EventRequest | null;
  onClose: () => void;
  onCreated: () => void;
}

interface LineItem {
  name: string;
  price: number;
  quantity: number;
  description: string;
}

const VAT_RATE = 0.18;

export default function DocumentGenerator({ request, onClose, onCreated }: DocumentGeneratorProps) {
  /* ─── Form state ─── */
  const [docType, setDocType] = useState(3); // InvoiceReceipt default
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerVATId, setCustomerVATId] = useState('');
  const [subject, setSubject] = useState('');
  const [comments, setComments] = useState('');
  const [sendByEmail, setSendByEmail] = useState(true);
  const [paymentType, setPaymentType] = useState<number | null>(null);

  const [items, setItems] = useState<LineItem[]>([
    { name: '', price: 0, quantity: 1, description: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ docNumber: string; url: string } | null>(null);

  // Pre-fill from request
  useEffect(() => {
    if (!request) return;
    setCustomerName(request.contact_name || '');
    setCustomerEmail(request.contact_email || '');
    setCustomerPhone(request.contact_phone || '');
    setSubject(`אירוע ${request.event_type}${request.event_name ? ' - ' + request.event_name : ''}`);
    setItems([{
      name: `חבילת אירוע - ${request.event_type}`,
      price: request.total_price,
      quantity: 1,
      description: request.event_name || '',
    }]);

    // Map payment method to Invoice4U payment type
    if (request.payment_method) {
      const mapping: Record<string, number> = {
        bit: 8,
        paybox: 9,
        cash: 4,
        bank_transfer: 3,
        other: 7,
      };
      setPaymentType(mapping[request.payment_method] ?? null);
    }
  }, [request]);

  /* ─── Calculations ─── */
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = subtotal + vatAmount;

  // Does this doc type need payment info?
  const needsPayment = [2, 3, 9].includes(docType); // Receipt, InvoiceReceipt, Deposits

  /* ─── Line items ─── */
  const addItem = () => setItems([...items, { name: '', price: 0, quantity: 1, description: '' }]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    // Validate
    if (!customerName.trim()) { setError('נא להזין שם לקוח'); return; }
    if (items.some(i => !i.name.trim() || i.price <= 0)) {
      setError('נא למלא שם ומחיר לכל פריט');
      return;
    }
    if (needsPayment && !paymentType) {
      setError('נא לבחור אמצעי תשלום');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        action: 'create_document',
        docType,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerVATId: customerVATId.trim() || undefined,
        items: items.map(i => ({
          name: i.name.trim(),
          price: i.price,
          quantity: i.quantity,
          description: i.description.trim() || undefined,
        })),
        subject: subject.trim() || undefined,
        comments: comments.trim() || undefined,
        sendByEmail,
      };

      if (request?.id) {
        payload.requestId = request.id;
      }

      if (needsPayment && paymentType) {
        payload.payments = [{
          type: paymentType,
          amount: total,
        }];
      }

      const res = await adminFetch('/api/admin/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'שגיאה בהפקת מסמך');
        return;
      }

      setSuccess({
        docNumber: data.document.number || data.document.id,
        url: data.document.url || '',
      });
      onCreated();
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Success screen ─── */
  if (success) {
    return (
      <div className="admin-overlay" onClick={onClose}>
        <div className="admin-dialog admin-dialog--lg" onClick={e => e.stopPropagation()}>
          <div className="pay-gen__success">
            <div className="pay-gen__success-icon">🎉</div>
            <div className="pay-gen__success-title">המסמך הופק בהצלחה!</div>
            <div className="pay-gen__success-number">מסמך מס׳ {success.docNumber}</div>
            {success.url && (
              <a
                href={success.url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn--primary"
              >
                📄 צפה במסמך
              </a>
            )}
            <button className="admin-btn admin-btn--ghost" onClick={onClose}>
              סגור
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Form ─── */
  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-dialog admin-dialog--lg" onClick={e => e.stopPropagation()}>
        <div className="admin-dialog__title">🧾 הפקת מסמך - Invoice4U</div>

        <div className="pay-gen">
          {/* Document type */}
          <div className="pay-gen__section">
            <label className="admin-label">סוג מסמך</label>
            <div className="pay-gen__doc-types">
              {COMMON_DOC_TYPES.map(dt => (
                <button
                  key={dt.value}
                  className={`pay-gen__doc-type-btn ${docType === dt.value ? 'pay-gen__doc-type-btn--active' : ''}`}
                  onClick={() => setDocType(dt.value)}
                  type="button"
                >
                  <span>{dt.emoji}</span>
                  <span>{dt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Customer info */}
          <div className="pay-gen__section">
            <label className="admin-label">פרטי לקוח</label>
            <div className="pay-gen__row">
              <input
                className="admin-input"
                placeholder="שם לקוח *"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
              <input
                className="admin-input"
                placeholder="אימייל"
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
              />
            </div>
            <div className="pay-gen__row">
              <input
                className="admin-input"
                placeholder="טלפון"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
              <input
                className="admin-input"
                placeholder="ע.מ / ח.פ"
                value={customerVATId}
                onChange={e => setCustomerVATId(e.target.value)}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="pay-gen__section">
            <div className="pay-gen__section-header">
              <label className="admin-label">פריטים</label>
              <button
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={addItem}
                type="button"
              >
                + הוסף פריט
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="pay-gen__item-row">
                <input
                  className="admin-input pay-gen__item-name"
                  placeholder="שם פריט *"
                  value={item.name}
                  onChange={e => updateItem(idx, { name: e.target.value })}
                />
                <input
                  className="admin-input pay-gen__item-price"
                  placeholder="מחיר"
                  type="number"
                  min={0}
                  step={1}
                  value={item.price || ''}
                  onChange={e => updateItem(idx, { price: Number(e.target.value) })}
                />
                <input
                  className="admin-input pay-gen__item-qty"
                  placeholder="כמות"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                />
                {items.length > 1 && (
                  <button
                    className="admin-btn admin-btn--ghost admin-btn--sm"
                    onClick={() => removeItem(idx)}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Payment type (for receipts) */}
          {needsPayment && (
            <div className="pay-gen__section">
              <label className="admin-label">אמצעי תשלום *</label>
              <div className="pay-gen__payment-types">
                {INVOICE4U_PAYMENT_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    className={`pay-gen__payment-btn ${paymentType === pt.value ? 'pay-gen__payment-btn--active' : ''}`}
                    onClick={() => setPaymentType(pt.value)}
                    type="button"
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subject & comments */}
          <div className="pay-gen__section">
            <input
              className="admin-input"
              placeholder="נושא / תיאור"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
            <textarea
              className="admin-input pay-gen__comments"
              placeholder="הערות (אופציונלי)"
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={2}
            />
          </div>

          {/* Send by email toggle */}
          <div className="pay-gen__section">
            <label className="pay-gen__checkbox">
              <input
                type="checkbox"
                checked={sendByEmail}
                onChange={e => setSendByEmail(e.target.checked)}
              />
              <span>שלח עותק ללקוח במייל</span>
            </label>
          </div>

          {/* Totals */}
          <div className="pay-gen__totals">
            <div className="pay-gen__total-row">
              <span>סה"כ לפני מע"מ</span>
              <span>{formatILS(subtotal)}</span>
            </div>
            <div className="pay-gen__total-row">
              <span>מע"מ (18%)</span>
              <span>{formatILS(vatAmount)}</span>
            </div>
            <div className="pay-gen__total-row pay-gen__total-row--grand">
              <span>סה"כ כולל מע"מ</span>
              <span>{formatILS(total)}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="pay-gen__error">⚠️ {error}</div>
          )}

          {/* Actions */}
          <div className="admin-dialog__actions">
            <button
              className="admin-btn admin-btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '⏳ מפיק...' : '🧾 הפק מסמך'}
            </button>
            <button
              className="admin-btn admin-btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
