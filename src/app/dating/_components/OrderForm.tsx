'use client';

import { useState, useCallback } from 'react';

const EVENT_TYPES = [
  { value: '', label: 'בחרו סוג אירוע...' },
  { value: 'wedding', label: 'חתונה' },
  { value: 'corporate', label: 'אירוע חברה / כנס' },
  { value: 'birthday', label: 'יום הולדת' },
  { value: 'conference', label: 'אירוע נטוורקינג' },
  { value: 'party', label: 'מסיבה פרטית' },
  { value: 'other', label: 'אחר' },
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

  const update = useCallback((field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }, []);

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
        disabled={submitted}
        style={submitted ? { background: '#22c55e', boxShadow: 'none' } : undefined}
      >
        {submitted ? '✓ הבקשה נשלחה בהצלחה!' : 'שלחו בקשה ✨'}
      </button>
    </form>
  );
}
