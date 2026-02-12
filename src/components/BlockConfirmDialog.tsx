'use client';

import { AnimatedOverlay } from '@/components/Animations';

interface BlockConfirmDialogProps {
  isOpen: boolean;
  displayName: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable block-user confirmation dialog.
 * Used in chat page and user profile page.
 */
export default function BlockConfirmDialog({
  isOpen,
  displayName,
  onConfirm,
  onClose,
}: BlockConfirmDialogProps) {
  return (
    <AnimatedOverlay isOpen={isOpen} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>
          חסימת {displayName}?
        </h3>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: 1.6,
          }}
        >
          החסימה תמחק את השיחה, הלייקים, ותסתיר אתכם אחד מהשני.
          <br />
          לא ניתן לבטל.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-danger"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            חסום
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
