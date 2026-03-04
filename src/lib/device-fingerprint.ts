/**
 * Device fingerprinting - generates a semi-persistent identifier
 * that survives incognito mode, localStorage clears, and browser restarts.
 *
 * Uses canvas, screen, WebGL, and navigator properties to create
 * a hash that is consistent for the same device+browser combo.
 *
 * This is NOT 100% unique across all devices, but combined with
 * the localStorage UUID it provides strong ban enforcement:
 * - localStorage UUID handles normal usage
 * - Hardware fingerprint handles incognito / cleared storage
 *
 * Privacy note: This is only used for ban enforcement at events
 * and all data is deleted after 7 days per the app's policy.
 */

import { LEGACY_LOCAL_ID_KEY } from '@/lib/constants';

/** Simple string hash (djb2 variant) */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** SHA-256 hex digest (async, uses SubtleCrypto) */
async function sha256(str: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback for environments without SubtleCrypto
    return hash(str);
  }
}

/** Collect canvas fingerprint signal */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Eventa.fp', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Eventa.fp', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

/** Collect WebGL renderer info */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

/** Collect screen/display properties */
function getScreenFingerprint(): string {
  try {
    const s = window.screen;
    return [
      s.width,
      s.height,
      s.colorDepth,
      s.pixelDepth,
      window.devicePixelRatio || 1,
    ].join(',');
  } catch {
    return 'screen-error';
  }
}

/** Collect navigator properties */
function getNavigatorFingerprint(): string {
  try {
    const n = navigator;
    return [
      n.language,
      n.languages?.join(',') || '',
      n.hardwareConcurrency || 0,
      (n as Navigator & { deviceMemory?: number }).deviceMemory || 0,
      n.maxTouchPoints || 0,
      n.platform || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('|');
  } catch {
    return 'nav-error';
  }
}

/**
 * Generate a hardware-based device fingerprint.
 * Returns a hex string that is consistent for the same device+browser.
 * This fingerprint persists even in incognito mode.
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const signals = [
    getCanvasFingerprint(),
    getWebGLFingerprint(),
    getScreenFingerprint(),
    getNavigatorFingerprint(),
  ].join('|||');

  return sha256(signals);
}

/**
 * Get the combined device identifier - localStorage UUID + hardware fingerprint.
 * Used for ban enforcement. Returns both so the server can check either.
 */
export async function getDeviceIdentifiers(): Promise<{
  localId: string;
  hardwareFingerprint: string;
}> {
  // localStorage-based UUID (existing mechanism)
  let localId = '';
  if (typeof window !== 'undefined') {
    localId = localStorage.getItem(LEGACY_LOCAL_ID_KEY) || '';
    if (!localId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        localId = crypto.randomUUID();
      } else {
        localId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      }
      localStorage.setItem(LEGACY_LOCAL_ID_KEY, localId);
    }
  }

  // Hardware fingerprint
  const hardwareFingerprint = typeof window !== 'undefined'
    ? await generateDeviceFingerprint()
    : '';

  return { localId, hardwareFingerprint };
}
