'use client';

import { type FormEvent, useState, useCallback } from 'react';

/** Strip spaces/dashes from phone for cleaner submission. */
function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '');
}

interface AddPhoneFormProps {
  onAdd: (phone: string, name?: string) => Promise<void>;
  disabled?: boolean;
}

export default function AddPhoneForm({ onAdd, disabled }: AddPhoneFormProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const normalized = normalizePhone(phone);
      if (!normalized) return;
      setError('');
      setLoading(true);
      try {
        await onAdd(normalized, name.trim() || undefined);
        setPhone('');
        setName('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בהוספת המספר');
      } finally {
        setLoading(false);
      }
    },
    [phone, name, onAdd]
  );

  return (
    <div className="portal-section">
      <h2 className="portal-section-title">➕ הוספת מספר בודד</h2>
      <form className="portal-add-form" onSubmit={handleSubmit}>
        <div className="portal-add-row">
          <input
            className="portal-input portal-input--rtl"
            type="text"
            placeholder="שם (אופציונלי)"
            aria-label="שם (אופציונלי)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled || loading}
            maxLength={100}
          />
        </div>
        <div className="portal-add-row">
          <input
            className="portal-input"
            type="tel"
            inputMode="tel"
            placeholder="050-1234567"
            aria-label="מספר טלפון"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={disabled || loading}
            maxLength={15}
            dir="ltr"
            required
          />
          <button
            type="submit"
            className="portal-add-btn"
            disabled={disabled || loading || !phone.trim()}
          >
            {loading ? '…' : 'הוסיפו'}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="portal-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
