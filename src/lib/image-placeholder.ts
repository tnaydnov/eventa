const SVG_PLACEHOLDER =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 24'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='%23211f1f'/><stop offset='100%' stop-color='%23110f0f'/></linearGradient></defs><rect width='16' height='24' fill='url(%23g)'/></svg>";

/**
 * Tiny SVG data URL placeholder used for remote participant photos.
 * Keeps card layout visually stable while transformed images load.
 */
export const PHOTO_BLUR_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SVG_PLACEHOLDER)}`;
