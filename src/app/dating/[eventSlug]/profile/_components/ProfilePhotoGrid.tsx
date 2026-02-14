'use client';

import { useState, useRef, useEffect } from 'react';
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
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const photoGridRef = useRef<HTMLDivElement | null>(null);

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

  /* ─── Desktop drag handlers ─── */
  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const updated = [...photos];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    const reordered = updated.map((p, i) => ({ ...p, order_index: i }));
    onPhotosChange(reordered);
    setDragIdx(null);
    setOverIdx(null);
    const order = reordered.map((p) => ({ id: p.id, order_index: p.order_index }));
    const ok = await reorderPhotos(order);
    if (!ok) toast('שגיאה בשינוי סדר התמונות');
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  /* ─── Touch-based drag for mobile ─── */
  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isDragging.current = false;
    const timer = setTimeout(() => {
      isDragging.current = true;
      setDragIdx(idx);
      try { navigator.vibrate?.(30); } catch {}
    }, 300);
    const node = e.currentTarget as HTMLDivElement;
    dragNodeRef.current = node;
    node.dataset.dragTimer = String(timer);
  };

  const handleTouchMoveRef = useRef((e: TouchEvent) => {
    if (!isDragging.current) {
      if (dragNodeRef.current?.dataset.dragTimer) {
        clearTimeout(Number(dragNodeRef.current.dataset.dragTimer));
      }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    const elements = document.querySelectorAll('.profile-edit-photo-item:not(.add)');
    elements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        setOverIdx(i);
      }
    });
  });

  useEffect(() => {
    const grid = photoGridRef.current;
    if (!grid) return;
    const handler = handleTouchMoveRef.current;
    grid.addEventListener('touchmove', handler, { passive: false });
    return () => grid.removeEventListener('touchmove', handler);
  }, [photos.length]);

  const handleTouchEnd = async () => {
    if (dragNodeRef.current?.dataset.dragTimer) {
      clearTimeout(Number(dragNodeRef.current.dataset.dragTimer));
    }
    if (isDragging.current && dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      await handleDrop(overIdx);
    } else {
      setDragIdx(null);
      setOverIdx(null);
    }
    isDragging.current = false;
    touchStartPos.current = null;
  };

  return (
    <>
      <div className="profile-edit-section">
        <div className="profile-edit-photos-header">
          <span className="profile-edit-section-icon"><CameraIcon size={18} /></span>
          <span>תמונות</span>
          <span className="profile-edit-photo-count">{photos.length}/10</span>
        </div>
        <div className="profile-edit-photo-grid" ref={photoGridRef}>
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className={`profile-edit-photo-item${idx === 0 ? ' main' : ''}${dragIdx === idx ? ' dragging' : ''}${overIdx === idx && dragIdx !== idx ? ' drag-over' : ''}${deletingId === photo.id ? ' photo-loading' : ''}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              onTouchEnd={() => handleTouchEnd()}
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
          ))}
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
