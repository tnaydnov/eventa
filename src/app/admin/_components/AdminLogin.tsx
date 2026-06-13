'use client';

import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (password: string, totp?: string) => Promise<{ ok: boolean; error?: string; totpRequired?: boolean }>;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  // Revealed only after the server reports that 2FA is enabled for this admin.
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await onLogin(password, totpRequired ? totp : undefined);
    setLoading(false);
    if (result.ok) return;
    if (result.totpRequired) {
      // Password accepted; progressively reveal the 2FA code field.
      setTotpRequired(true);
      setError(totpRequired ? (result.error || 'קוד אימות שגוי') : '');
      return;
    }
    setError(result.error || 'סיסמה שגויה');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 20,
    }}>
      <form
        onSubmit={handleSubmit}
        aria-label="כניסת אדמין"
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
          borderRadius: 'var(--admin-radius)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 52,
            height: 52,
            background: 'var(--admin-accent-dim)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 14px',
            border: '1px solid rgba(99,102,241,0.3)',
          }} aria-hidden="true">🔐</div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--admin-text)',
            margin: '0 0 4px',
            letterSpacing: '-0.3px',
          }}>Eventa Admin</h1>
          <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', margin: 0 }}>
            מערכת ניהול פנימית
          </p>
        </div>

        {/* Password field */}
        <div>
          <label
            htmlFor="admin-password"
            style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            סיסמה
          </label>
          <input
            id="admin-password"
            type="password"
            placeholder="הזינו סיסמת אדמין"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            className="admin-input"
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {/* 2FA code — revealed only when the server reports that 2FA is enabled */}
        {totpRequired && (
          <div>
            <label
              htmlFor="admin-totp"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}
            >
              קוד אימות דו-שלבי
            </label>
            <input
              id="admin-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={totp}
              onChange={e => { setTotp(e.target.value.replace(/\D/g, '')); setError(''); }}
              className="admin-input"
              dir="ltr"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--admin-red-dim)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--admin-radius-xs)',
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--admin-red)',
          }} role="alert">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={loading || !password || (totpRequired && totp.length < 6)}
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14 }}
        >
          {loading ? 'כניסה...' : totpRequired ? 'אימות והתחברות' : 'כניסה למערכת'}
        </button>
      </form>
    </div>
  );
}
