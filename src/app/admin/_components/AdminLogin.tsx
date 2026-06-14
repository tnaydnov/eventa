'use client';

import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (password: string, totp?: string) => Promise<{ ok: boolean; error?: string; requireTotp?: boolean }>;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await onLogin(password, showTotp ? totp : undefined);
    setLoading(false);
    if (result.requireTotp) {
      // Server says password OK but needs TOTP — show the TOTP field
      setShowTotp(true);
      return;
    }
    if (result.ok) return;
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
            autoFocus={!showTotp}
            disabled={showTotp}
            style={showTotp ? { opacity: 0.5 } : undefined}
          />
        </div>

        {showTotp && (
          <div>
            <label
              htmlFor="admin-totp"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}
            >
              קוד אימות (TOTP)
            </label>
            <input
              id="admin-totp"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={totp}
              onChange={e => { setTotp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              className="admin-input"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
            />
            <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginTop: 6 }}>
              פתחו את אפליקציית האימות (Google Authenticator / Authy) והזינו את הקוד
            </p>
          </div>
        )}

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

        <button
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={loading || !password || (showTotp && totp.length !== 6)}
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14 }}
        >
          {loading ? 'כניסה...' : showTotp ? 'אמת קוד' : 'כניסה למערכת'}
        </button>

        {showTotp && (
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => { setShowTotp(false); setTotp(''); setError(''); }}
          >
            ← חזרה להזנת סיסמה
          </button>
        )}
      </form>
    </div>
  );
}
