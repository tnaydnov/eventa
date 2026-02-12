import imageCompression from 'browser-image-compression';

/**
 * Compress an image file before upload.
 * - Profile photos: max 800px, max 200KB
 * - Chat images: max 1200px, max 400KB
 */

export interface CompressionOptions {
  /** Max width/height in pixels */
  maxSizePx: number;
  /** Max file size in MB */
  maxSizeMB: number;
}

const PROFILE_PHOTO_OPTIONS: CompressionOptions = {
  maxSizePx: 800,
  maxSizeMB: 0.2,
};

const CHAT_IMAGE_OPTIONS: CompressionOptions = {
  maxSizePx: 1200,
  maxSizeMB: 0.4,
};

export async function compressImage(
  file: File,
  options: CompressionOptions = PROFILE_PHOTO_OPTIONS
): Promise<File> {
  // Skip compression for small files
  if (file.size < options.maxSizeMB * 1024 * 1024) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxSizePx,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8,
    });

    // Return as File with proper name (change extension to .webp)
    const newName = file.name.replace(/\.[^.]+$/, '.webp');
    return new File([compressed], newName, { type: 'image/webp' });
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return file;
  }
}

/** Compress for profile photos (smaller, lower quality) */
export function compressProfilePhoto(file: File): Promise<File> {
  return compressImage(file, PROFILE_PHOTO_OPTIONS);
}

/** Compress for chat images (larger, higher quality) */
export function compressChatImage(file: File): Promise<File> {
  return compressImage(file, CHAT_IMAGE_OPTIONS);
}

/**
 * Generate a thumbnail preview URL for immediate display.
 * Returns a data URL. For production use, prefer URL.createObjectURL() — it's
 * much lighter for large files (no base64 overhead).
 */
export function createThumbnailUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file for thumbnail'));
    reader.readAsDataURL(file);
  });
}
