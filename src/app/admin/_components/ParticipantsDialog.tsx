'use client';

import { useState } from 'react';
import type { Event } from '@/lib/database.types';
import type { AdminParticipant } from './shared';

interface ParticipantsDialogProps {
  event: Event;
  participants: AdminParticipant[];
  onClose: () => void;
  onBan: (pid: string, isBanned: boolean) => void;
}

export default function ParticipantsDialog({ event, participants, onClose, onBan }: ParticipantsDialogProps) {
  const [confirmTarget, setConfirmTarget] = useState<AdminParticipant | null>(null);

  const handleBanClick = (p: AdminParticipant) => {
    if (p.is_banned) {
      // Unban doesn't need confirmation
      onBan(p.id, p.is_banned);
    } else {
      // Ban needs confirmation
      setConfirmTarget(p);
    }
  };

  const confirmBan = () => {
    if (!confirmTarget) return;
    onBan(confirmTarget.id, confirmTarget.is_banned);
    setConfirmTarget(null);
  };

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-dialog admin-dialog--lg" onClick={e => e.stopPropagation()}>
        <h3 className="admin-dialog__title">
          👥 {event.name} - {participants.length} משתתפים
        </h3>

        {participants.length === 0 ? (
          <p className="admin-text-muted">אין משתתפים עדיין</p>
        ) : (
          <div>
            {participants.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid var(--admin-border)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{p.display_name || '(ללא שם)'}</span>
                  <span className="admin-text-muted" style={{ marginRight: '8px', fontSize: '12px' }}>
                    {p.gender === 'male' ? 'ג׳' : p.gender === 'female' ? 'א׳' : '-'}
                    {p.age ? `, ${p.age}` : ''}
                  </span>
                  {p.is_banned && <span style={{ color: 'var(--admin-red)', fontSize: '12px' }}> (חסום)</span>}
                </div>
                <button
                  onClick={() => handleBanClick(p)}
                  className={`admin-btn admin-btn--sm ${p.is_banned ? 'admin-btn--green' : 'admin-btn--red'}`}
                >
                  {p.is_banned ? 'בטל חסימה ✅' : 'חסום 🚫'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="admin-dialog__actions">
          <button onClick={onClose} className="admin-btn admin-btn--ghost" style={{ width: '100%', padding: '10px' }}>
            סגור
          </button>
        </div>
      </div>

      {/* ── Ban confirmation popup ── */}
      {confirmTarget && (
        <div className="admin-overlay" style={{ zIndex: 1001 }} onClick={(e) => { e.stopPropagation(); setConfirmTarget(null); }}>
          <div className="admin-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
            <h3 className="admin-dialog__title" style={{ marginBottom: '8px' }}>
              חסימת {confirmTarget.display_name || 'משתתף/ת'}
            </h3>
            <p className="admin-text-muted" style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
              המשתתף/ת ייחסמו מהאירוע ולא יוכלו להיכנס מחדש.
              <br />
              פעולה זו ניתנת לביטול.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmTarget(null)}
                className="admin-btn admin-btn--ghost"
                style={{ flex: 1, padding: '10px' }}
              >
                ביטול
              </button>
              <button
                onClick={confirmBan}
                className="admin-btn admin-btn--red"
                style={{ flex: 1, padding: '10px' }}
              >
                🚫 חסום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
