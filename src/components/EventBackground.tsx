'use client';

import { useSessionStore } from '@/lib/store';

/**
 * Renders a fixed background image for the event (set by admin).
 * Positioned behind all content with a dark overlay for readability.
 * Also injects a <style> tag that overrides CSS variables to give
 * all UI surfaces solid dark backgrounds for readability.
 */
export default function EventBackground() {
  const backgroundImage = useSessionStore((s) => s.session?.backgroundImage);

  if (!backgroundImage) return null;

  return (
    <>
      {/* Activate event-background overrides via data attribute - CSS in event-bg.css */}
      <div data-event-bg />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for text readability */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6, 6, 6, 0.92)',
          }}
        />
      </div>
    </>
  );
}
