'use client';

import { useState } from 'react';
import { AnimatedOverlay } from '@/components/Animations';
import { TrashIcon } from '@/components/Icons';
import { deleteAccount } from '@/lib/api';
import { useToastStore } from '@/lib/store';
import type { WeddingSession } from '@/lib/store';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  session: WeddingSession;
  onDeleted: () => void;
}

export default function DeleteAccountDialog({
  isOpen,
  onClose,
  session,
  onDeleted,
}: DeleteAccountDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const toast = useToastStore((s) => s.show);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteAccount();
    if (result.ok) {
      onDeleted();
    } else {
      toast('שגיאה במחיקת החשבון - נסו שוב');
      setDeleting(false);
    }
  };

  return (
    <AnimatedOverlay isOpen={isOpen} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '12px', color: 'var(--danger)' }}><TrashIcon size={40} /></div>
        <h3 style={{ marginBottom: '8px', color: 'var(--danger)' }}>מחיקת חשבון?</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
          כל הנתונים שלך יימחקו לצמיתות - תמונות, שיחות, לייקים, והפרופיל.
          <br />לא ניתן לשחזר.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-danger"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'מוחק...' : 'מחק לצמיתות'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
