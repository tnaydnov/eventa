'use client';

import { useState, useEffect } from 'react';

type QueueItem = {
  id: string;
  event_id: string;
  item_type: 'photo' | 'message';
  photo_id?: string;
  message_id?: string;
  score: number;
  label: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  // Joined data
  photo_url?: string;
  participant_name?: string;
  message_text?: string;
};

type BlockedItem = {
  id: string;
  event_id: string;
  surface: string;
  storage_path: string;
  reason: string | null;
  scores: Record<string, number>;
  model: string;
  created_at: string;
  participant_id: string | null;
  admin_action: string | null;
};

export default function AdminModerationQueue() {
  const [tab, setTab] = useState<'review' | 'blocked'>('review');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [blockedItems, setBlockedItems] = useState<BlockedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'review') fetchQueue();
    else fetchBlocked();
  }, [tab]);

  async function fetchQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/moderation/queue', { credentials: 'include' });
      if (!res.ok) throw new Error('שגיאת שרת');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBlocked() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/moderation/blocked', { credentials: 'include' });
      if (!res.ok) throw new Error('שגיאת שרת');
      const data = await res.json();
      setBlockedItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(itemId: string, action: 'approve' | 'reject') {
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/admin/moderation/${itemId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('שגיאה');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="admin-section" dir="rtl">
      <div className="admin-section__header">
        <h2 className="admin-section__title">
          מודרציה
          {items.length > 0 && tab === 'review' && (
            <span className="admin-sidebar__badge" style={{ marginRight: '8px' }}>{items.length}</span>
          )}
        </h2>
        <button
          className="admin-btn admin-btn--ghost"
          onClick={() => tab === 'review' ? fetchQueue() : fetchBlocked()}
          style={{ fontSize: '13px' }}
        >
          רענן
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--admin-border)', paddingBottom: '8px' }}>
        <button
          onClick={() => setTab('review')}
          style={{
            fontSize: '13px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'review' ? 'var(--admin-primary)' : 'transparent',
            color: tab === 'review' ? '#fff' : 'var(--admin-text-muted)',
            fontWeight: tab === 'review' ? 600 : 400,
          }}
        >
          בתור בדיקה {items.length > 0 && `(${items.length})`}
        </button>
        <button
          onClick={() => setTab('blocked')}
          style={{
            fontSize: '13px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'blocked' ? 'rgba(239,68,68,0.15)' : 'transparent',
            color: tab === 'blocked' ? '#ef4444' : 'var(--admin-text-muted)',
            fontWeight: tab === 'blocked' ? 600 : 400,
          }}
        >
          חסומים (7 ימים אחרונים)
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="admin-spinner" />
        </div>
      ) : error ? (
        <div className="admin-alert admin-alert--error">{error}</div>
      ) : tab === 'review' ? (
        items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--admin-text-muted)' }}>
            <p style={{ fontSize: '14px' }}>אין פריטים הממתינים לבדיקה</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="admin-card"
                style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}
              >
                {/* Thumbnail for photos */}
                {item.item_type === 'photo' && item.photo_url && (
                  <div style={{ flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.photo_url}
                      alt="תמונה לבדיקה"
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid var(--admin-border)',
                      }}
                    />
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      {item.item_type === 'photo' ? 'תמונת פרופיל' : 'הודעת תמונה'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                      {new Date(item.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                  {item.participant_name && (
                    <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>
                      משתתף: {item.participant_name}
                    </p>
                  )}
                  {item.message_text && (
                    <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>
                      הודעה: {item.message_text}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: item.score > 0.7 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: item.score > 0.7 ? '#ef4444' : '#f59e0b',
                      fontWeight: 600,
                    }}>
                      {item.label} ({(item.score * 100).toFixed(0)}%)
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="admin-btn admin-btn--primary"
                      style={{ fontSize: '13px', padding: '6px 16px' }}
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={actionLoading === item.id}
                    >
                      אישור
                    </button>
                    <button
                      className="admin-btn admin-btn--danger"
                      style={{ fontSize: '13px', padding: '6px 16px' }}
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={actionLoading === item.id}
                    >
                      דחייה
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Blocked tab */
        blockedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--admin-text-muted)' }}>
            <p style={{ fontSize: '14px' }}>אין תמונות שנחסמו ב-7 ימים האחרונים</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {blockedItems.map((item) => (
              <div
                key={item.id}
                className="admin-card"
                style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
                      ✗ חסום - {item.surface === 'profile_photo' ? 'תמונת פרופיל' : 'תמונת צ\'אט'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                      {new Date(item.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>
                    סיבה: {item.reason ?? 'לא ידוע'} | מודל: {item.model}
                  </p>
                  {item.participant_id && (
                    <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>
                      משתתף: {item.participant_id.slice(0, 8)}…
                    </p>
                  )}
                  {/* Score breakdown */}
                  {item.scores && Object.keys(item.scores).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {Object.entries(item.scores)
                        .filter(([, v]) => (v as number) > 0.05)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 4)
                        .map(([cat, score]) => (
                          <span
                            key={cat}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              background: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                            }}
                          >
                            {cat}: {((score as number) * 100).toFixed(0)}%
                          </span>
                        ))}
                    </div>
                  )}
                  {item.admin_action && (
                    <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '6px' }}>
                      פעולת מנהל: {item.admin_action === 'kept' ? 'נשאר' : 'הוסר'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
