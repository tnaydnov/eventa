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
  eventEndDate: string;
  eventName: string;
  guestCount: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

export default function OrderForm() {
  const [form, setForm] = useState<FormData>({
    eventType: '', eventDate: '', eventEndDate: '', eventName: '',
    guestCount: '', contactName: '', contactPhone: '', contactEmail: '', notes: '',
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
        <label className="order-form__label">שם האירוע *</label>
        <input
          className="order-form__input"
          type="text"
          placeholder='לדוגמה: "החתונה של דנה ואיתי"'
          value={form.eventName}
          onChange={e => update('eventName', e.target.value)}
          required
        />
      </div>

      <div className="order-form__row">
        <div className="order-form__group">
          <label className="order-form__label">תאריך התחלה *</label>
          <input
            className="order-form__input"
            type="date"
            value={form.eventDate}
            onChange={e => update('eventDate', e.target.value)}
            required
          />
        </div>
        <div className="order-form__group">
          <label className="order-form__label">תאריך סיום</label>
          <input
            className="order-form__input"
            type="date"
            value={form.eventEndDate}
            onChange={e => update('eventEndDate', e.target.value)}
          />
        </div>
      </div>

      <div className="order-form__group">
        <label className="order-form__label">מספר אורחים משוער</label>
        <input
          className="order-form__input"
          type="number"
          placeholder="200"
          min="10"
          max="10000"
          value={form.guestCount}
          onChange={e => update('guestCount', e.target.value)}
        />
      </div>

      {/* Background image upload (decorative) */}
      <div className="order-form__group">
        <label className="order-form__label">תמונת רקע לאירוע</label>
        <label className="order-form__upload">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>גרירה או לחיצה להעלאת תמונה</span>
          <input type="file" accept="image/*" style={{ display: 'none' }} />
        </label>
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

      <div className="order-form__group">
        <label className="order-form__label">הערות נוספות</label>
        <textarea
          className="order-form__textarea"
          placeholder="ספרו לנו עוד על האירוע שלכם..."
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          rows={3}
        />
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
