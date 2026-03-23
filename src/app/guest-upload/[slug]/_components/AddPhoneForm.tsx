'use client';

import { useState, useCallback } from 'react';

interface AddPhoneFormProps {
  onAdd: (phone: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
}

export default function AddPhoneForm({ onAdd, disabled }: AddPhoneFormProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = phone.trim();
      if (!trimmed) return;
      setError('');
      setLoading(true);
      try {
        const result = await onAdd(trimmed, name.trim() || undefined);
        if (result.success) {
          setPhone('');
          setName('');
        } else {
          setError(result.error || 'שגיאה בהוספת המספר');
        }
      } catch {
        setError('שגיאה בהוספת המספר');
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
        <p role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
