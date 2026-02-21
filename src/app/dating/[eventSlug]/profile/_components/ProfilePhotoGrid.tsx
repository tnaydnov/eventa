'use client';

import { useState, useRef, useCallback } from 'react';
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

  /* ─── Tap-to-swap state (mobile-friendly) ─── */
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  /* ─── Desktop drag state ─── */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

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
    // Revoke the object URL to prevent memory leak
    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
    setUploading(true);

    // Yield so React paints the upload spinner before compression blocks the main thread
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

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
    setSelectedIdx(null);
    setDeletingId(photo.id);
    const success = await deletePhoto(photo.id, photo.storage_path);
    if (success) {
      onPhotosChange(photos.filter((p) => p.id !== photo.id));
    } else {
      toast('שגיאה במחיקת התמונה — נסו שוב');
    }
    setDeletingId(null);
  };

  /* ─── Reorder logic ─── */
  const commitSwap = useCallback(async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...photos];
    // Swap the two photos
    [updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]];
    const reordered = updated.map((p, i) => ({ ...p, order_index: i }));
    onPhotosChange(reordered);
    const order = reordered.map((p) => ({ id: p.id, order_index: p.order_index }));
    const ok = await reorderPhotos(order);
    if (!ok) toast('שגיאה בשינוי סדר התמונות');
  }, [photos, onPhotosChange, toast]);

  /* ─── Tap-to-swap handler ─── */
  const handlePhotoTap = useCallback((idx: number) => {
    if (photos.length < 2) return; // Nothing to swap

    if (selectedIdx === null) {
      // First tap — select this photo
      setSelectedIdx(idx);
      try { navigator.vibrate?.(15); } catch {}
    } else if (selectedIdx === idx) {
      // Tapped same photo — deselect
      setSelectedIdx(null);
    } else {
      // Second tap on a different photo — swap!
      const from = selectedIdx;
      setSelectedIdx(null);
      try { navigator.vibrate?.(30); } catch {}
      commitSwap(from, idx);
    }
  }, [selectedIdx, photos.length, commitSwap]);

  /* ─── Desktop drag handlers ─── */
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setSelectedIdx(null); // Clear any tap selection
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx === null || dragIdx === idx) return;
    setOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      await commitSwap(dragIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <>
      <div className="profile-edit-section">
        <div className="profile-edit-photos-header">
          <span className="profile-edit-section-icon"><CameraIcon size={18} /></span>
          <span>תמונות</span>
          <span className="profile-edit-photo-count">{photos.length}/10</span>
        </div>

        {/* Selection hint banner */}
        {selectedIdx !== null && (
          <div className="photo-swap-hint">
            <span>📸</span>
            <span>לחצו על תמונה אחרת כדי להחליף מיקום</span>
            <button type="button" onClick={() => setSelectedIdx(null)}>✕</button>
          </div>
        )}

        <div className="profile-edit-photo-grid" ref={undefined}>
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className={[
                'profile-edit-photo-item',
                idx === 0 ? 'main' : '',
                selectedIdx === idx ? 'selected' : '',
                selectedIdx !== null && selectedIdx !== idx ? 'swap-target' : '',
                dragIdx === idx ? 'dragging' : '',
                overIdx === idx && dragIdx !== idx ? 'drag-over' : '',
                deletingId === photo.id ? 'photo-loading' : '',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onClick={() => handlePhotoTap(idx)}
            >
              <img src={getPhotoUrl(photo.storage_path)} alt="" draggable={false} />
              {deletingId === photo.id && (
                <div className="photo-upload-overlay">
                  <div className="photo-upload-spinner" />
                </div>
              )}
              {selectedIdx === idx && (
                <div className="photo-selected-overlay">
                  <span className="photo-selected-check">✓</span>
                </div>
              )}
              {selectedIdx !== null && selectedIdx !== idx && (
                <div className="photo-swap-target-overlay">
                  <span>⇄</span>
                </div>
              )}
              <button
                type="button"
                className="profile-edit-photo-remove"
                onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                disabled={deletingId === photo.id}
              >✕</button>
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
        {photos.length > 1 && !selectedIdx && (
          <p className="profile-edit-hint">לחצו על תמונה כדי לשנות סדר</p>
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
