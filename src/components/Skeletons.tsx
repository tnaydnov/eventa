'use client';

/**
 * Skeleton placeholder components for perceived-instant loading.
 * Uses CSS shimmer animation — no JS dependencies.
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
    <div className="profile-grid" style={{ padding: '0 16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, aspectRatio: '3/4', borderRadius: '16px' }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

/* ── Chat list skeleton ────────────────────────────── */
export function ChatsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
          <div style={{ ...shimmerStyle, width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ ...shimmerStyle, height: 14, width: '40%' }} />
            <div style={{ ...shimmerStyle, height: 12, width: '70%' }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

/* ── Likes / matches grid skeleton ─────────────────── */
export function LikesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="profile-grid" style={{ padding: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, aspectRatio: '3/4', borderRadius: '16px' }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
