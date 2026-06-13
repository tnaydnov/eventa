'use client';

import Image from 'next/image';
import { getPhotoUrl } from '@/lib/api';
import { PHOTO_BLUR_DATA_URL } from '@/lib/image-placeholder';
import { UserIcon } from '@/components/Icons';
import type { PublicParticipant, ParticipantPhoto } from '@/lib/database.types';

interface ChatHeaderProps {
  otherUser: (PublicParticipant & { photos: ParticipantPhoto[] }) | null;
  onBack: () => void;
  onUserClick: () => void;
  onMenuToggle: () => void;
}

export default function ChatHeader({ otherUser, onBack, onUserClick, onMenuToggle }: ChatHeaderProps) {
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
        aria-label="חזרה"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--foreground)',
          cursor: 'pointer',
          padding: '8px',
          fontSize: '18px',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ←
      </button>

      {otherUser && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
          onClick={onUserClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onUserClick(); } }}
          aria-label={`פרופיל ${otherUser.display_name}`}
        >
          {(otherUser.photos ?? []).length > 0 ? (
            <Image
              src={getPhotoUrl(otherUser.photos![0].storage_path, { width: 96, height: 96, quality: 70 })}
              alt=""
              width={36}
              height={36}
              placeholder="blur"
              blurDataURL={PHOTO_BLUR_DATA_URL}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
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

      <button
        onClick={onMenuToggle}
        aria-label="תפריט פעולות"
        aria-haspopup="true"
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
