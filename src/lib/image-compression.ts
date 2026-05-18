import imageCompression from 'browser-image-compression';

/**
 * Compress an image file before upload.
 * - Profile photos: max 2048px, max 2MB  (high quality for dating profiles)
 * - Chat images:   max 1600px, max 1.5MB
 *
 * All images pass through canvas-based compression which naturally
 * strips EXIF metadata (GPS, camera info, etc.) from the output.
 */

export interface CompressionOptions {
  /** Max width/height in pixels */
  maxSizePx: number;
  /** Max file size in MB */
  maxSizeMB: number;
}

const PROFILE_PHOTO_OPTIONS: CompressionOptions = {
  maxSizePx: 2048,
  maxSizeMB: 2,
};

const CHAT_IMAGE_OPTIONS: CompressionOptions = {
  maxSizePx: 1600,
  maxSizeMB: 1.5,
};

/** Maximum input file size (20 MB) - reject before processing. */
const MAX_INPUT_SIZE = 20 * 1024 * 1024;

/** Maximum input dimension (px) - reject decompression bombs. */
const MAX_INPUT_DIMENSION = 8000;

/**
 * Read image intrinsic dimensions via a temporary <img> load.
 * Resolves with { width, height } or rejects on load failure.
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

export async function compressImage(
  file: File,
  options: CompressionOptions = PROFILE_PHOTO_OPTIONS
): Promise<File> {
  // Guard: reject files over 20 MB instantly (no OOM from huge files)
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error('File too large - maximum 20 MB');
  }

  // Guard: reject images with extreme dimensions (decompression-bomb defense)
  try {
    const { width, height } = await getImageDimensions(file);
    if (width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION) {
      throw new Error(`Image too large - maximum ${MAX_INPUT_DIMENSION}×${MAX_INPUT_DIMENSION} pixels`);
    }
  } catch (dimErr) {
    if (dimErr instanceof Error && dimErr.message.startsWith('Image too large')) throw dimErr;
    // Dimension check failed but file might still be valid - log and continue
    console.warn('[compressImage] Dimension check failed, proceeding anyway:', dimErr);
  }

  try {
    // Always compress through canvas to strip EXIF metadata,
    // even for small files that are already below the size limit.
    // Do NOT force fileType - let the library use the input format
    // so it works on every browser (Safari < 16.4 doesn't support WebP canvas).
    const compressed = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxSizePx,
      // Offload compression to a worker when available to keep UI responsive.
      useWebWorker: true,
      initialQuality: 0.92,
    });

    // Preserve the actual output type and name
    const outType = compressed.type || file.type;
    const outExt = outType === 'image/png' ? '.png' : outType === 'image/webp' ? '.webp' : '.jpg';
    const newName = file.name.replace(/\.[^.]+$/, outExt);
    return new File([compressed], newName, { type: outType });
  } catch (error) {
    // Don't return the original - it still contains EXIF metadata (GPS, camera info).
    // Throwing forces the caller to handle the failure explicitly.
    throw new Error(
      `Image compression failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

/** Compress for profile photos (high quality, larger limit) */
export function compressProfilePhoto(file: File): Promise<File> {
  return compressImage(file, PROFILE_PHOTO_OPTIONS);
}

/** Compress for chat images */
export function compressChatImage(file: File): Promise<File> {
  return compressImage(file, CHAT_IMAGE_OPTIONS);
}

/**
 * Generate a thumbnail preview URL for immediate display.
 * Returns a data URL. For production use, prefer URL.createObjectURL() - it's
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
