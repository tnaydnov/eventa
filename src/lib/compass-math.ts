/* ---- Compass math utilities ---- */

/** Convert degrees to radians */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculate the bearing (azimuth) from point A to point B.
 * Returns degrees 0–360.
 */
export function calcBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = toRad(lng2 - lng1);
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);

  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculate the Haversine distance between two points (in meters).
 */
export function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalize angle to -180..180
 */
export function normalizeDelta(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1) return '< 1 מ׳';
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}
