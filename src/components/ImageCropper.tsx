'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';

interface ImageCropperProps {
  /** Object URL or data URL of the image to crop */
  imageSrc: string;
  /** Aspect ratio — e.g. 3/4 for profile, 9/16 for background */
  aspect?: number;
  /** Called with the cropped File */
  onCropDone: (croppedFile: File, originalFileName: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Original file name (for naming the output) */
  fileName?: string;
  /** Shape of crop area */
  cropShape?: 'rect' | 'round';
}

/**
 * Creates a cropped image File from a source image + crop area.
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string
): Promise<File> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        const outName = fileName.replace(/\.[^.]+$/, '.webp');
        resolve(new File([blob], outName, { type: 'image/webp' }));
      },
      'image/webp',
      0.92
    );
  });
}

export default function ImageCropper({
  imageSrc,
  aspect = 3 / 4,
  onCropDone,
  onCancel,
  fileName = 'photo.jpg',
  cropShape = 'rect',
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const cropped = await getCroppedImg(imageSrc, croppedAreaPixels, fileName);
      onCropDone(cropped, fileName);
    } catch {
      console.error('Crop failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Crop area */}
        <div style={styles.cropArea}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: '12px' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div style={styles.zoomRow}>
          <span style={styles.zoomLabel}>−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.zoomLabel}>+</span>
        </div>

        {/* Buttons */}
        <div style={styles.buttonRow}>
          <button onClick={onCancel} style={styles.cancelBtn} type="button">
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            style={styles.confirmBtn}
            disabled={saving}
            type="button"
          >
            {saving ? 'שומר...' : 'אישור'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  container: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cropArea: {
    position: 'relative',
    width: '100%',
    height: '400px',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  zoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'center',
  },
  zoomLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '18px',
    fontWeight: 700,
    userSelect: 'none',
    width: '20px',
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    maxWidth: '220px',
    accentColor: '#D4A59A',
    height: '4px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  cancelBtn: {
    padding: '12px 32px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '12px 32px',
    background: 'linear-gradient(135deg, #D4A59A, #C9A580)',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
