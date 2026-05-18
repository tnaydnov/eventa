'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type OrderLeadForm = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export default function OrderForm() {
  const [form, setForm] = useState<OrderLeadForm>({
    contactName: '', contactPhone: '', contactEmail: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { clearTimeout(resetTimerRef.current); };
  }, []);

  const update = useCallback((field: keyof OrderLeadForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Failed');

      setSubmitted(true);
      setForm({ contactName: '', contactPhone: '', contactEmail: '' });
      resetTimerRef.current = setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError('שגיאה בשליחה. נסו שוב או פנו אלינו ישירות.');
    } finally {
      setSending(false);
    }
  }, [form]);

  return (
    <form className="order-form" onSubmit={handleSubmit} dir="rtl" aria-describedby={error ? 'order-form-error' : undefined}>
      {/* Personal Info */}
      <div className="order-form__group">
        <label className="order-form__label" htmlFor="order-name">שם מלא *</label>
        <input
          id="order-name"
          className="order-form__input"
          type="text"
          placeholder="השם שלכם"
          value={form.contactName}
          onChange={e => update('contactName', e.target.value)}
          required
        />
      </div>

      <div className="order-form__row">
        <div className="order-form__group">
          <label className="order-form__label" htmlFor="order-phone">טלפון *</label>
          <input
            id="order-phone"
            className="order-form__input"
            type="tel"
            placeholder="050-0000000"
            value={form.contactPhone}
            onChange={e => update('contactPhone', e.target.value)}
            required
            dir="ltr"
          />
        </div>
        <div className="order-form__group">
          <label className="order-form__label" htmlFor="order-email">אימייל</label>
          <input
            id="order-email"
            className="order-form__input"
            type="email"
            placeholder="you@example.com"
            value={form.contactEmail}
            onChange={e => update('contactEmail', e.target.value)}
            dir="ltr"
          />
        </div>
      </div>

      <button
        className={`order-form__submit${submitted ? ' order-form__submit--success' : ''}`}
        type="submit"
        disabled={submitted || sending}
      >
        {submitted ? '✓ הפרטים נשלחו בהצלחה!' : sending ? 'שולח...' : 'שלחו פרטים'}
      </button>

      {error && (
        <p id="order-form-error" className="order-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
