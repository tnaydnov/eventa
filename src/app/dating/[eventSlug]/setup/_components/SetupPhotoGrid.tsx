'use client';

import { useState, useRef } from 'react';
import { validateImageFile } from '@/lib/validations';
import { MAX_PHOTOS } from '@/lib/constants';
import dynamic from 'next/dynamic';
const ImageCropper = dynamic(() => import('@/components/ImageCropper'));

interface SetupPhotoGridProps {
  photos: (File | null)[];
  onPhotosChange: (photos: (File | null)[]) => void;
  toast: (msg: string) => void;
}

export default function SetupPhotoGrid({
  photos,
  onPhotosChange,
  toast,
}: SetupPhotoGridProps) {
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>(
    Array(MAX_PHOTOS).fill(null)
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [cropImage, setCropImage] = useState<{ src: string; file: File } | null>(null);

  const handlePhotoSelect = (index: number) => {
    setCurrentSlot(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imgErr = validateImageFile(file);
    if (imgErr) {
      toast(imgErr);
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImage({ src: objectUrl, file });
    e.target.value = '';
  };

  const handleCropDone = (croppedFile: File) => {
    const newFiles = [...photos];
    newFiles[currentSlot] = croppedFile;
    onPhotosChange(newFiles);

    const previewUrl = URL.createObjectURL(croppedFile);
    const newPreviews = [...photoPreviews];
    if (newPreviews[currentSlot]) URL.revokeObjectURL(newPreviews[currentSlot]!);
    newPreviews[currentSlot] = previewUrl;
    setPhotoPreviews(newPreviews);

    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
  };

  const handleCropCancel = () => {
    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
  };

  const removePhoto = (index: number) => {
    const newFiles = [...photos];
    const newPreviews = [...photoPreviews];
    newFiles[index] = null;
    newPreviews[index] = null;
    onPhotosChange(newFiles);
    setPhotoPreviews(newPreviews);
  };

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
          תמונות (1–10)
        </label>
        <div className="photo-upload-grid">
          {Array.from({ length: MAX_PHOTOS }, (_, i) => i).map((i) => (
            <div
              key={i}
              className="photo-upload-slot"
              onClick={() => !photoPreviews[i] && handlePhotoSelect(i)}
            >
              {photoPreviews[i] ? (
                <>
                  <img src={photoPreviews[i]!} alt={`תמונה ${i + 1}`} />
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(i);
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>+</span>
              )}
            </div>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
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
