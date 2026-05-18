'use client';

export default function ScrollToButton({ targetId }: { targetId: string }) {
  return (
    <button
      className="landing-btn landing-btn--ghost"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      ראו דמו חי
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
        <polygon points="6,3 17,10 6,17" fill="currentColor" opacity="0.5"/>
      </svg>
    </button>
  );
}
