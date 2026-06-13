'use client';

import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await onLogin(password);
    setLoading(false);
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
            autoFocus
          />
        </div>

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
          disabled={loading || !password}
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14 }}
        >
          {loading ? 'כניסה...' : 'כניסה למערכת'}
        </button>
      </form>
    </div>
  );
}
