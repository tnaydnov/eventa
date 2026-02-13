'use client';

import { useState, useMemo, useCallback } from 'react';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from '@/lib/constants';
import { slugify } from '../shared';

/* ─── Types ─── */

export interface CreateEventData {
  name: string;
  event_type: string;
  description: string;
  starts_at: string;
  ends_at: string;
}

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateEventData) => Promise<{ ok: boolean; error?: string }>;
}

/* ─── Helpers ─── */

/** Format a Date to local datetime-local input value (YYYY-MM-DDTHH:MM). */
function toLocalDatetime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Get today's date as a default start, rounded to the next hour. */
function defaultStart(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalDatetime(d);
}

/** Default end = start + 6 hours. */
function defaultEnd(startStr: string): string {
  const d = new Date(startStr);
  d.setHours(d.getHours() + 6);
  return toLocalDatetime(d);
}

const EVENT_TYPES = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
  icon: EVENT_TYPE_ICONS[value] || '📌',
}));

/* ─── Component ─── */

export default function CreateEventDialog({ open, onClose, onCreate }: CreateEventDialogProps) {
  /* ─── Form state ─── */
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [eventType, setEventType] = useState('wedding');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(() => defaultEnd(defaultStart()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  /* ─── Derived slug preview ─── */
  const slugPreview = useMemo(() => {
    if (!name.trim()) return '';
    const base = slugify(name) || 'event';
    return `${base}-xxxx`;
  }, [name]);

  /* ─── Validate details step ─── */
  const detailsValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!startsAt || !endsAt) return false;
    if (new Date(endsAt) <= new Date(startsAt)) return false;
    return true;
  }, [name, startsAt, endsAt]);

  /* ─── Reset form ─── */
  const reset = useCallback(() => {
    setStep('type');
    setEventType('wedding');
    setName('');
    setDescription('');
    setStartsAt(defaultStart());
    setEndsAt(defaultEnd(defaultStart()));
    setSubmitting(false);
    setError('');
  }, []);

  /* ─── Handlers ─── */
  const handleSelectType = (type: string) => {
    setEventType(type);
    setStep('details');
  };

  const handleBack = () => {
    setStep('type');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!detailsValid || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await onCreate({
        name: name.trim(),
        event_type: eventType,
        description: description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      });

      if (result.ok) {
        reset();
        onClose();
      } else {
        setError(result.error || 'שגיאה ביצירת האירוע');
      }
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Auto-adjust end date when start changes ─── */
  const handleStartChange = (val: string) => {
    setStartsAt(val);
    // If end is before new start, push end to start + 6h
    if (val && (!endsAt || new Date(endsAt) <= new Date(val))) {
      setEndsAt(defaultEnd(val));
    }
  };

  if (!open) return null;

  /* ─── Step 1: Type selection ─── */
  if (step === 'type') {
    return (
      <div className="admin-overlay" onClick={handleClose}>
        <div
          className="admin-dialog admin-dialog--lg admin-animate-in"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="admin-dialog__title">✨ אירוע חדש — בחרו סוג</h3>

          <div className="ced-type-grid">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                className={`ced-type-card ${eventType === t.value ? 'ced-type-card--selected' : ''}`}
                onClick={() => handleSelectType(t.value)}
                type="button"
              >
                <span className="ced-type-card__icon">{t.icon}</span>
                <span className="ced-type-card__label">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="admin-dialog__actions">
            <button className="admin-btn" onClick={handleClose} type="button">
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Step 2: Event details ─── */
  const selectedType = EVENT_TYPES.find((t) => t.value === eventType);

  return (
    <div className="admin-overlay" onClick={handleClose}>
      <div
        className="admin-dialog admin-dialog--lg admin-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="ced-header">
          <button className="ced-back-btn" onClick={handleBack} type="button" title="חזרה לבחירת סוג">
            ←
          </button>
          <h3 className="admin-dialog__title" style={{ margin: 0 }}>
            {selectedType?.icon} יצירת {selectedType?.label || 'אירוע'}
          </h3>
        </div>

        {/* Event name */}
        <div className="ced-field">
          <label className="admin-label">שם האירוע *</label>
          <input
            className="admin-input"
            type="text"
            placeholder="לדוגמא: החתונה של דנה ויובל"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
          {slugPreview && (
            <div className="ced-slug-preview">
              <span className="ced-slug-preview__label">כתובת:</span>
              <code className="ced-slug-preview__value">/dating/{slugPreview}</code>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="admin-grid-2">
          <div className="ced-field">
            <label className="admin-label">תחילת האירוע *</label>
            <input
              className="admin-input admin-input--ltr"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => handleStartChange(e.target.value)}
            />
          </div>
          <div className="ced-field">
            <label className="admin-label">סיום האירוע *</label>
            <input
              className="admin-input admin-input--ltr"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              min={startsAt}
            />
            {endsAt && startsAt && new Date(endsAt) <= new Date(startsAt) && (
              <span className="ced-field-error">תאריך הסיום חייב להיות אחרי ההתחלה</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="ced-field">
          <label className="admin-label">תיאור (אופציונלי)</label>
          <textarea
            className="admin-input ced-textarea"
            placeholder="תיאור קצר של האירוע..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
          {description.length > 0 && (
            <span className="ced-char-count">{description.length}/500</span>
          )}
        </div>

        {/* Error message */}
        {error && <div className="ced-error">{error}</div>}

        {/* Actions */}
        <div className="admin-dialog__actions">
          <button
            className="admin-btn admin-btn--primary"
            onClick={handleSubmit}
            disabled={!detailsValid || submitting}
            type="button"
          >
            {submitting ? '⏳ יוצר...' : '🚀 צור אירוע'}
          </button>
          <button className="admin-btn" onClick={handleClose} type="button">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
