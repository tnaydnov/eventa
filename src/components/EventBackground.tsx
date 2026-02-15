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
      {/* Inject solid-surface overrides when background image is active */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --card-bg: rgba(30, 30, 30, 0.95) !important;
          --card-border: rgba(255, 255, 255, 0.15) !important;
          --surface: rgba(28, 28, 28, 0.92) !important;
          --surface-light: rgba(45, 45, 45, 0.92) !important;
          --glass-bg: rgba(30, 30, 30, 0.95) !important;
          --glass-border: rgba(255, 255, 255, 0.15) !important;
        }

        /* Page backgrounds — semi-transparent to hint at event image */
        .profile-edit-page {
          background: rgba(10, 10, 10, 0.92) !important;
        }

        /* Tab bar — nearly opaque */
        .tab-bar {
          background: rgba(8, 8, 8, 0.97) !important;
          border-top-color: rgba(255, 255, 255, 0.12) !important;
        }

        /* Header — nearly opaque */
        .app-header {
          background: rgba(8, 8, 8, 0.97) !important;
          border-bottom-color: rgba(255, 255, 255, 0.12) !important;
        }

        /* Cards — visible dark surface */
        .card {
          background: rgba(30, 30, 30, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }

        /* Grid cards — boost overlay */
        .grid-card {
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .grid-card .card-overlay {
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.88)) !important;
        }

        /* Chat received bubbles */
        .message-bubble.received {
          background: rgba(35, 35, 35, 0.95) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Chat input bar */
        .message-input-bar {
          background: rgba(8, 8, 8, 0.97) !important;
          border-top-color: rgba(255, 255, 255, 0.12) !important;
        }
        .message-input-bar input {
          background: rgba(38, 38, 38, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        /* Filter chips */
        .filter-chip {
          background: rgba(30, 30, 30, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .filter-chip.active {
          background: var(--primary) !important;
        }

        /* Form inputs */
        .input {
          background: rgba(38, 38, 38, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        /* Select / pills */
        .select-option,
        .profile-edit-pill {
          background: rgba(35, 35, 35, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .select-option.selected,
        .profile-edit-pill.active {
          background: rgba(212, 165, 154, 0.15) !important;
          border-color: var(--primary) !important;
        }

        /* Profile edit header */
        .profile-edit-header {
          background: rgba(8, 8, 8, 0.97) !important;
          border-bottom-color: rgba(255, 255, 255, 0.12) !important;
        }

        /* Profile edit sections — LIGHTER than page bg for contrast */
        .profile-edit-section {
          background: rgba(30, 30, 30, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Profile action buttons */
        .profile-action-btn {
          background: rgba(30, 30, 30, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .profile-action-btn.liked {
          background: rgba(212, 165, 154, 0.2) !important;
        }

        /* Modal */
        .modal-content {
          background: rgba(18, 18, 18, 0.98) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Toast */
        .toast {
          background: rgba(18, 18, 18, 0.98) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Button secondary */
        .btn-secondary {
          background: rgba(35, 35, 35, 0.95) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Photo upload */
        .photo-upload-slot {
          border-color: rgba(255, 255, 255, 0.22) !important;
        }
        .profile-edit-photo-item {
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        .profile-edit-photo-item.add {
          border-color: rgba(255, 255, 255, 0.22) !important;
          background: rgba(30, 30, 30, 0.6) !important;
        }

        /* Avatar placeholder */
        .avatar-placeholder {
          background: linear-gradient(135deg, rgba(212, 165, 154, 0.25) 0%, rgba(201, 165, 128, 0.18) 100%) !important;
        }

        /* Chat list */
        .chat-list-item {
          background: rgba(20, 20, 20, 0.45) !important;
          border-bottom-color: rgba(255, 255, 255, 0.08) !important;
        }

        /* Likes empty state */
        .likes-section {
          background: transparent !important;
        }

        /* Chat header (in conversation view) */
        .chat-header {
          background: rgba(8, 8, 8, 0.97) !important;
          border-bottom-color: rgba(255, 255, 255, 0.12) !important;
        }
      `}} />
      <div
        aria-hidden
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
            background: 'rgba(10, 10, 10, 0.88)',
          }}
        />
      </div>
    </>
  );
}
