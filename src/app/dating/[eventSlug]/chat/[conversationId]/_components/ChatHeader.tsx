'use client';

import { getPhotoUrl } from '@/lib/api';
import { UserIcon, CompassIcon } from '@/components/Icons';
import type { Participant, ParticipantPhoto } from '@/lib/database.types';

interface ChatHeaderProps {
  otherUser: (Participant & { photos: ParticipantPhoto[] }) | null;
  onBack: () => void;
  onUserClick: () => void;
  onMenuToggle: () => void;
  compassEligible: boolean | null;
  compassWaiting: boolean;
  onCompassClick: () => void;
}

export default function ChatHeader({ otherUser, onBack, onUserClick, onMenuToggle, compassEligible, compassWaiting, onCompassClick }: ChatHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top))',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--card-border)',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--foreground)',
          cursor: 'pointer',
          padding: '4px',
          fontSize: '18px',
        }}
      >
        ←
      </button>

      {otherUser && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
          onClick={onUserClick}
        >
          {otherUser.photos.length > 0 ? (
            <img
              src={getPhotoUrl(otherUser.photos[0].storage_path)}
              alt=""
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--surface-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={20} />
            </div>
          )}
          <span style={{ fontWeight: 600 }}>{otherUser.display_name}</span>
        </div>
      )}

      {compassEligible !== false && (
        <button
          onClick={onCompassClick}
          disabled={compassWaiting}
          style={{
            background: 'none',
            border: 'none',
            color: compassWaiting ? 'var(--text-muted)' : 'var(--primary)',
            cursor: compassWaiting ? 'not-allowed' : 'pointer',
            padding: '6px',
            minWidth: '40px',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: compassWaiting ? 0.5 : 1,
          }}
          aria-label="מצפן מפגש"
        >
          <CompassIcon size={22} />
        </button>
      )}

      <button
        onClick={onMenuToggle}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '20px',
          padding: '8px',
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        ⋮
      </button>
    </div>
  );
}
