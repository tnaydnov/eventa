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
      <div className="admin-card" style={{ maxWidth: '380px', width: '100%', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
        <h1 style={{ color: 'var(--admin-accent)', marginTop: 0, marginBottom: '24px', fontSize: '22px' }}>ניהול Weddate</h1>
        <input
          type="password"
          placeholder="סיסמת אדמין"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="admin-input"
          style={{ marginBottom: '16px' }}
        />
        <button onClick={handleSubmit} className="admin-btn admin-btn--primary" style={{ width: '100%', padding: '12px' }}>
          כניסה
        </button>
      </div>
    </div>
  );
}
