'use client';

import { useState, useCallback } from 'react';
import { GUEST_PHONE_CONSENT_TEXT } from '@/lib/legal-versions';

interface GuestConsentGateProps {
  onConfirm: () => Promise<void>;
}

/**
 * Required authorization gate shown before the customer can provide guest
 * phone numbers. The customer must confirm they are permitted to share the
 * numbers for event service messages. Confirmation is recorded durably.
 */
export default function GuestConsentGate({ onConfirm }: GuestConsentGateProps) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = useCallback(async () => {
    if (!checked || saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת האישור - נסו שוב');
      setSaving(false);
    }
  }, [checked, saving, onConfirm]);

  return (
    <div className="portal-section" role="group" aria-labelledby="guest-consent-title">
      <h2 className="portal-section-title" id="guest-consent-title">
        ✅ אישור הרשאה למסירת מספרי טלפון
      </h2>

      <label className="portal-consent-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={saving}
          aria-label="אישור הרשאה למסירת מספרי טלפון של אורחים"
        />
        <span className="portal-consent-text">{GUEST_PHONE_CONSENT_TEXT}</span>
      </label>

      {error && (
        <p role="alert" className="portal-field-error">
          {error}
        </p>
      )}

      <button
        type="button"
        className="portal-template-btn"
        onClick={handleConfirm}
        disabled={!checked || saving}
        style={{ marginTop: 12 }}
      >
        {saving ? 'שומר…' : 'אישור והמשך'}
      </button>
    </div>
  );
}
