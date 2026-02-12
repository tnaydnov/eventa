'use client';

import type { Event } from '@/lib/database.types';
import type { AdminParticipant } from './shared';

interface ParticipantsDialogProps {
  event: Event;
  participants: AdminParticipant[];
  onClose: () => void;
  onBan: (pid: string, isBanned: boolean) => void;
}

export default function ParticipantsDialog({ event, participants, onClose, onBan }: ParticipantsDialogProps) {
  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-dialog admin-dialog--lg" onClick={e => e.stopPropagation()}>
        <h3 className="admin-dialog__title">
          👥 {event.name} — {participants.length} משתתפים
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
                    {p.gender === 'male' ? 'ג׳' : p.gender === 'female' ? 'א׳' : '—'}
                    {p.age ? `, ${p.age}` : ''}
                  </span>
                  {p.is_banned && <span style={{ color: 'var(--admin-red)', fontSize: '12px' }}> (חסום)</span>}
                </div>
                <button
                  onClick={() => onBan(p.id, p.is_banned)}
                  className={`admin-btn admin-btn--sm ${p.is_banned ? 'admin-btn--green' : 'admin-btn--red'}`}
                >
                  {p.is_banned ? 'בטל חסימה' : 'חסום'}
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
    </div>
  );
}
