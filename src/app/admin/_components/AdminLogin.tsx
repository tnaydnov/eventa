'use client';

import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    const result = await onLogin(password);
    if (!result.ok) alert(result.error);
  };

  return (
    <div className="admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <form className="admin-card" style={{ maxWidth: '380px', width: '100%', textAlign: 'center', padding: '32px' }} onSubmit={e => { e.preventDefault(); handleSubmit(); }} aria-label="כניסת אדמין">
        <div style={{ fontSize: '48px', marginBottom: '16px' }} aria-hidden="true">🔐</div>
        <h1 style={{ color: 'var(--admin-accent)', marginTop: 0, marginBottom: '24px', fontSize: '22px' }}>ניהול Eventa</h1>
        <label htmlFor="admin-password" className="sr-only">סיסמת אדמין</label>
        <input
          id="admin-password"
          type="password"
          placeholder="סיסמת אדמין"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="admin-input"
          style={{ marginBottom: '16px' }}
        />
        <button type="submit" className="admin-btn admin-btn--primary" style={{ width: '100%', padding: '12px' }}>
          כניסה
        </button>
      </form>
    </div>
  );
}
