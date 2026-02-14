'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadPhoto, deletePhoto, reorderPhotos, getPhotoUrl } from '@/lib/api';
import { validateImageFile } from '@/lib/validations';
import { MAX_PHOTOS } from '@/lib/constants';
import dynamic from 'next/dynamic';
const ImageCropper = dynamic(() => import('@/components/ImageCropper'));
import { CameraIcon } from '@/components/Icons';
import type { ParticipantPhoto } from '@/lib/database.types';

interface ProfilePhotoGridProps {
  eventId: string;
  participantId: string;
  photos: ParticipantPhoto[];
  onPhotosChange: (photos: ParticipantPhoto[]) => void;
  toast: (msg: string) => void;
}

export default function ProfilePhotoGrid({
  eventId,
  participantId,
  photos,
  onPhotosChange,
  toast,
}: ProfilePhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<{ src: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ─── Drag & Drop state ─── */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [ghostSrc, setGhostSrc] = useState<string | null>(null);
  const photoGridRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);

  /* ─── Photo handlers ─── */
  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imgErr = validateImageFile(file);
    if (imgErr) {
      toast(imgErr);
      e.target.value = '';
      return;
    }

    if (photos.length >= MAX_PHOTOS) {
      toast(`ניתן להעלות עד ${MAX_PHOTOS} תמונות`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImage({ src: objectUrl, file });
    e.target.value = '';
  };

  const handleCropDone = async (croppedFile: File) => {
    setCropImage(null);
    setUploading(true);
    const photo = await uploadPhoto(eventId, participantId, croppedFile, photos.length);
    if (photo) {
      onPhotosChange([...photos, photo]);
    } else {
      toast('שגיאה בהעלאת התמונה — נסו שוב');
    }
    setUploading(false);
  };

  const handleCropCancel = () => {
    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
  };

  const handleDeletePhoto = async (photo: ParticipantPhoto) => {
    setDeletingId(photo.id);
    const success = await deletePhoto(photo.id, photo.storage_path);
    if (success) {
      onPhotosChange(photos.filter((p) => p.id !== photo.id));
    } else {
      toast('שגיאה במחיקת התמונה — נסו שוב');
    }
    setDeletingId(null);
  };

  /* ─── Reorder logic (shared by desktop + mobile) ─── */
  const commitReorder = useCallback(async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...photos];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    const reordered = updated.map((p, i) => ({ ...p, order_index: i }));
    onPhotosChange(reordered);
    const order = reordered.map((p) => ({ id: p.id, order_index: p.order_index }));
    const ok = await reorderPhotos(order);
    if (!ok) toast('שגיאה בשינוי סדר התמונות');
  }, [photos, onPhotosChange, toast]);

  const resetDrag = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
    setGhostPos(null);
    setGhostSrc(null);
    isDragging.current = false;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /* ─── Desktop drag handlers ─── */
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image — we show our own ghost
    const blank = document.createElement('canvas');
    blank.width = 1; blank.height = 1;
    e.dataTransfer.setDragImage(blank, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx === null || dragIdx === idx) return;
    setOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      await commitReorder(dragIdx, idx);
    }
    resetDrag();
  };

  const handleDragEnd = () => resetDrag();

  /* ─── Touch-based drag for mobile ─── */
  const findDropTarget = useCallback((touchX: number, touchY: number): number | null => {
    const items = photoGridRef.current?.querySelectorAll('.profile-edit-photo-item:not(.add)');
    if (!items) return null;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touchX >= rect.left && touchX <= rect.right && touchY >= rect.top && touchY <= rect.bottom) {
        return i;
      }
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, idx: number) => {
    const touch = e.touches[0];
    // Start a long-press timer
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDragIdx(idx);
      setGhostSrc(getPhotoUrl(photos[idx].storage_path));
      setGhostPos({ x: touch.clientX, y: touch.clientY });
      try { navigator.vibrate?.(40); } catch {}
    }, 250);
  }, [photos]);

  useEffect(() => {
    const grid = photoGridRef.current;
    if (!grid) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) {
        // Cancel long press if finger moved
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }
      e.preventDefault();
      const touch = e.touches[0];
      setGhostPos({ x: touch.clientX, y: touch.clientY });
      const target = findDropTarget(touch.clientX, touch.clientY);
      setOverIdx(target);
    };

    const onTouchEnd = async () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (isDragging.current) {
        const from = dragIdx;
        const to = overIdx;
        resetDrag();
        if (from !== null && to !== null && from !== to) {
          await commitReorder(from, to);
        }
      }
    };

    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    grid.addEventListener('touchend', onTouchEnd);
    grid.addEventListener('touchcancel', () => resetDrag());

    return () => {
      grid.removeEventListener('touchmove', onTouchMove);
      grid.removeEventListener('touchend', onTouchEnd);
      grid.removeEventListener('touchcancel', () => resetDrag());
    };
  }, [photos.length, dragIdx, overIdx, findDropTarget, commitReorder, resetDrag]);

  /* ─── Compute preview order for visual feedback ─── */
  const displayPhotos = (() => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) return photos;
    const arr = [...photos];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(overIdx, 0, moved);
    return arr;
  })();

  return (
    <>
      <div className="profile-edit-section">
        <div className="profile-edit-photos-header">
          <span className="profile-edit-section-icon"><CameraIcon size={18} /></span>
          <span>תמונות</span>
          <span className="profile-edit-photo-count">{photos.length}/10</span>
        </div>
        <div className={`profile-edit-photo-grid${dragIdx !== null ? ' grid-reordering' : ''}`} ref={photoGridRef}>
          {displayPhotos.map((photo, idx) => {
            const isBeingDragged = dragIdx !== null && photo.id === photos[dragIdx]?.id;
            return (
              <div
                key={photo.id}
                className={[
                  'profile-edit-photo-item',
                  idx === 0 ? 'main' : '',
                  isBeingDragged ? 'dragging' : '',
                  overIdx === idx && !isBeingDragged ? 'drag-over' : '',
                  deletingId === photo.id ? 'photo-loading' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, idx)}
              >
                <img src={getPhotoUrl(photo.storage_path)} alt="" draggable={false} />
                {deletingId === photo.id && (
                  <div className="photo-upload-overlay">
                    <div className="photo-upload-spinner" />
                  </div>
                )}
                <button type="button" className="profile-edit-photo-remove" onClick={() => handleDeletePhoto(photo)} disabled={deletingId === photo.id}>✕</button>
                {idx === 0 && <span className="profile-edit-photo-badge">ראשית</span>}
                <span className="profile-edit-photo-order">{idx + 1}</span>
              </div>
            );
          })}
          {photos.length < 10 && (
            <div className={`profile-edit-photo-item add${uploading ? ' photo-loading' : ''}`} onClick={() => !uploading && fileInputRef.current?.click()}>
              {uploading ? (
                <div className="photo-upload-overlay photo-upload-overlay--add">
                  <div className="photo-upload-spinner" />
                  <span className="photo-upload-text">מעלה...</span>
                </div>
              ) : (
                <div className="profile-edit-photo-add-inner">
                  <span>+</span>
                  <span>הוספה</span>
                </div>
              )}
            </div>
          )}
        </div>
        {photos.length > 1 && (
          <p className="profile-edit-hint">לחצו והחזיקו כדי לגרור ולשנות סדר</p>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAddPhoto} />
      </div>

      {/* Floating drag ghost (follows finger on mobile) */}
      {ghostPos && ghostSrc && (
        <div
          className="photo-drag-ghost"
          style={{
            left: ghostPos.x,
            top: ghostPos.y,
          }}
        >
          <img src={ghostSrc} alt="" />
        </div>
      )}

      {/* Image Cropper Modal */}
      {cropImage && (
        <ImageCropper
          imageSrc={cropImage.src}
          aspect={3 / 4}
          onCropDone={handleCropDone}
          onCancel={handleCropCancel}
          fileName={cropImage.file.name}
        />
      )}
    </>
  );
}
