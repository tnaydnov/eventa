'use client';

/**
 * Skeleton placeholder components for perceived-instant loading.
 * Uses CSS shimmer animation defined in base.css - no JS dependencies.
 */

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite ease-in-out',
  borderRadius: '12px',
};

/* ── Grid skeleton (profile cards) ─────────────────── */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="profile-grid" role="status" aria-label="טוען תוכן..." style={{ padding: '0 16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, aspectRatio: '3/4', borderRadius: '16px' }} />
      ))}
    </div>
  );
}

/* ── Chat list skeleton ────────────────────────────── */
export function ChatsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="טוען שיחות..." style={{ padding: '8px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
          <div style={{ ...shimmerStyle, width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ ...shimmerStyle, height: 14, width: '40%' }} />
            <div style={{ ...shimmerStyle, height: 12, width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Likes / matches grid skeleton ─────────────────── */
export function LikesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="profile-grid" role="status" aria-label="טוען לייקים..." style={{ padding: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, aspectRatio: '3/4', borderRadius: '16px' }} />
      ))}
    </div>
  );
}

/* ── Chat room message skeleton ────────────────────── */
export function ChatRoomSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="טוען הודעות..." style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 3 !== 0;
        return (
          <div key={i} style={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...shimmerStyle, height: 36, width: `${35 + (i % 4) * 12}%`, borderRadius: '16px' }} />
          </div>
        );
      })}
    </div>
  );
}
