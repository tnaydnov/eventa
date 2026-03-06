'use client';

import { useState, useCallback } from 'react';

type FormData = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export default function OrderForm() {
  const [form, setForm] = useState<FormData>({
    contactName: '', contactPhone: '', contactEmail: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const update = useCallback((field: keyof FormData, value: string) => {
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
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError('שגיאה בשליחה. נסו שוב או פנו אלינו ישירות.');
    } finally {
      setSending(false);
    }
  }, [form]);

  return (
    <form className="order-form" onSubmit={handleSubmit} dir="rtl">
      {/* Personal Info */}
      <div className="order-form__group">
        <label className="order-form__label">שם מלא *</label>
        <input
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
          <label className="order-form__label">טלפון *</label>
          <input
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
          <label className="order-form__label">אימייל</label>
          <input
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
        className="order-form__submit"
        type="submit"
        disabled={submitted || sending}
        style={submitted ? { background: '#22c55e', boxShadow: 'none' } : undefined}
      >
        {submitted ? '✓ הפרטים נשלחו בהצלחה!' : sending ? 'שולח...' : 'שלחו פרטים'}
      </button>

      {error && (
        <p style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center', marginTop: '12px' }}>
          {error}
        </p>
      )}
    </form>
  );
}
