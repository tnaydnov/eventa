'use client';

import { useState, useCallback } from 'react';
import { EVENT_TYPE_OPTIONS } from '@/lib/constants';

const EVENT_TYPES = [
  { value: '', label: 'בחרו סוג אירוע...' },
  ...EVENT_TYPE_OPTIONS,
];

type FormData = {
  eventType: string;
  eventDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export default function OrderForm() {
  const [form, setForm] = useState<FormData>({
    eventType: '', eventDate: '', contactName: '', contactPhone: '', contactEmail: '',
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
      setForm({ eventType: '', eventDate: '', contactName: '', contactPhone: '', contactEmail: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError('שגיאה בשליחה. נסו שוב או פנו אלינו ישירות.');
    } finally {
      setSending(false);
    }
  }, [form]);

  return (
    <form className="order-form" onSubmit={handleSubmit} dir="rtl">
      {/* Event Details */}
      <div className="order-form__group">
        <label className="order-form__label">סוג האירוע *</label>
        <select
          className="order-form__select"
          value={form.eventType}
          onChange={e => update('eventType', e.target.value)}
          required
        >
          {EVENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="order-form__group">
        <label className="order-form__label">תאריך האירוע *</label>
        <input
          className="order-form__input"
          type="date"
          value={form.eventDate}
          onChange={e => update('eventDate', e.target.value)}
          required
        />
      </div>

      {/* Separator */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '24px 0' }} />

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
