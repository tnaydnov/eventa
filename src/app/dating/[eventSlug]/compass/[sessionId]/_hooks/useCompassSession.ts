'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useCompassStore, useToastStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { updateCompassLocation, closeCompass, getParticipant } from '@/lib/api';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { calcBearing, calcDistance, normalizeDelta } from '@/lib/compass-math';
import {
  GEO_MAX_AGE_MS,
  GEO_TIMEOUT_MS,
  GEO_LOW_ACCURACY_THRESHOLD,
  GEO_THROTTLE_DISTANCE_M,
  GEO_THROTTLE_INTERVAL_MS,
  HEADING_SMOOTH_FACTOR,
  GPS_HEADING_SPEED_THRESHOLD,
} from '@/lib/constants';

interface CompassSessionResult {
  myLocation: { lat: number; lng: number; accuracy: number } | null;
  otherName: string;
  permissionError: string;
  closed: boolean;
  arrowAngle: number;
  distance: number;
  lowAccuracy: boolean;
  handleStop: () => Promise<void>;
}

export function useCompassSession(sessionId: string, eventSlug: string): CompassSessionResult {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);
  const { otherLocation, setOtherLocation, myHeading, setMyHeading } = useCompassStore();

  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [otherName, setOtherName] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [closed, setClosed] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const gpsHeadingRef = useRef<{ heading: number; time: number } | null>(null);
  const orientationCleanupRef = useRef<(() => void) | null>(null);

  /**
   * Smooth heading using shortest-angle interpolation (low-pass filter).
   * Prevents jitter while staying responsive.
   */
  const smoothHeading = useCallback((rawHeading: number) => {
    const prev = smoothedHeadingRef.current;
    if (prev === null) {
      smoothedHeadingRef.current = rawHeading;
    } else {
      const delta = normalizeDelta(rawHeading - prev);
      smoothedHeadingRef.current = (prev + delta * HEADING_SMOOTH_FACTOR + 360) % 360;
    }
    setMyHeading(smoothedHeadingRef.current);
  }, [setMyHeading]);

  /** Only send GPS update if moved > threshold OR enough time elapsed. */
  const shouldSendUpdate = (lat: number, lng: number): boolean => {
    const last = lastSentRef.current;
    if (!last) return true;
    const elapsed = Date.now() - last.time;
    if (elapsed < GEO_THROTTLE_INTERVAL_MS) return false;
    // Quick Haversine approximation for short distances
    const dLat = (lat - last.lat) * 111_320;
    const dLng = (lng - last.lng) * 111_320 * Math.cos(last.lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    return dist > GEO_THROTTLE_DISTANCE_M || elapsed > GEO_THROTTLE_INTERVAL_MS * 2;
  };

  // Load compass session info
  useEffect(() => {
    async function load() {
      if (!session) return;

      const { data: cs } = await supabase
        .from('compass_sessions')
        .select('id, participant_a_id, participant_b_id, status')
        .eq('id', sessionId)
        .single();

      if (!cs || cs.status === 'closed') {
        setClosed(true);
        return;
      }

      const otherId =
        cs.participant_a_id === session.participantId
          ? cs.participant_b_id
          : cs.participant_a_id;

      const other = await getParticipant(otherId);
      if (other) setOtherName(other.display_name);
    }
    load();
  }, [session, sessionId]);

  // Start geolocation watch
  useEffect(() => {
    if (!session || closed) return;

    if (!navigator.geolocation) {
      setPermissionError('הדפדפן לא תומך בשירותי מיקום');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMyLocation(loc);

        // Use GPS heading when user is moving (much more accurate than magnetometer)
        const speed = pos.coords.speed;
        const gpsHeading = pos.coords.heading;
        if (
          speed !== null &&
          speed > GPS_HEADING_SPEED_THRESHOLD &&
          gpsHeading !== null &&
          !isNaN(gpsHeading)
        ) {
          gpsHeadingRef.current = { heading: gpsHeading, time: Date.now() };
          smoothHeading(gpsHeading);
        }

        // Throttle: only send to server if moved enough or enough time passed
        if (shouldSendUpdate(loc.lat, loc.lng)) {
          lastSentRef.current = { lat: loc.lat, lng: loc.lng, time: Date.now() };
          updateCompassLocation(sessionId, loc.lat, loc.lng, loc.accuracy, null);
        }
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setPermissionError('הגישה למיקום נדחתה — יש לאשר הרשאות מיקום בהגדרות המכשיר');
            break;
          case err.POSITION_UNAVAILABLE:
            setPermissionError('לא ניתן לזהות מיקום — ודאו שה-GPS פעיל');
            break;
          case err.TIMEOUT:
            setPermissionError('זמן המתנה למיקום פג — נסו שוב באזור עם קליטה טובה');
            break;
          default:
            setPermissionError('לא ניתן לגשת למיקום — יש לאשר הרשאות מיקום');
        }
      },
      { enableHighAccuracy: true, maximumAge: GEO_MAX_AGE_MS, timeout: GEO_TIMEOUT_MS }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [session, sessionId, closed]);

  // Device orientation — multi-strategy approach for accurate heading:
  // 1. AbsoluteOrientationSensor (Chrome Android — fused gyro+accel+mag, best accuracy)
  // 2. webkitCompassHeading (iOS Safari — true north, very accurate)
  // 3. deviceorientationabsolute (Android Chrome fallback — true north)
  // 4. deviceorientation (last resort — magnetic, unreliable)
  // GPS heading overrides all when user is walking (see geolocation watch above).
  useEffect(() => {
    if (closed) return;

    let cleanup: (() => void) | null = null;

    const useGpsRecent = () => {
      const g = gpsHeadingRef.current;
      return g && Date.now() - g.time < 3000;
    };

    const handleOrientationEvent = (e: DeviceOrientationEvent) => {
      // If GPS heading is fresh (user walking), skip compass — GPS is more accurate
      if (useGpsRecent()) return;

      // iOS: webkitCompassHeading is true north, top quality
      const webkit = (e as any).webkitCompassHeading;
      if (typeof webkit === 'number' && webkit >= 0) {
        smoothHeading(webkit);
        return;
      }

      // Android fallback: alpha from absolute event
      if (typeof e.alpha === 'number') {
        smoothHeading((360 - e.alpha) % 360);
      }
    };

    const startOrientation = async () => {
      // Strategy 1: AbsoluteOrientationSensor (Chrome 67+ on Android)
      // Uses sensor fusion (gyro + accel + mag) — like Google Maps
      if ('AbsoluteOrientationSensor' in window) {
        try {
          const sensor = new (window as any).AbsoluteOrientationSensor({ frequency: 30, referenceFrame: 'device' });
          sensor.addEventListener('reading', () => {
            if (useGpsRecent()) return;
            const q = sensor.quaternion as [number, number, number, number];
            if (!q) return;
            // Convert quaternion to compass heading (yaw angle, true north)
            const [x, y, z, w] = q;
            const heading = Math.atan2(2 * (x * y + w * z), w * w + x * x - y * y - z * z);
            smoothHeading(((heading * 180) / Math.PI + 360) % 360);
          });
          sensor.addEventListener('error', () => {
            // Sensor failed — fall through to deviceorientation
            sensor.stop();
            fallbackToDeviceOrientation();
          });
          sensor.start();
          cleanup = () => sensor.stop();
          orientationCleanupRef.current = cleanup;
          return;
        } catch {
          // Not available — try next strategy
        }
      }

      // Strategy 2 & 3: deviceorientationabsolute (Android true north) or deviceorientation
      await fallbackToDeviceOrientation();
    };

    const fallbackToDeviceOrientation = async () => {
      // iOS: Request permission (required since iOS 13)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const result = await (DeviceOrientationEvent as any).requestPermission();
          if (result !== 'granted') {
            toast('⚠️ יש לאשר גישה לחיישן תנועה כדי שהמצפן יציג כיוון');
            return;
          }
        } catch {
          toast('⚠️ יש לאשר גישה לחיישן תנועה כדי שהמצפן יציג כיוון');
          return;
        }
      }

      // Prefer deviceorientationabsolute (Android true-north) over plain deviceorientation
      let usedAbsolute = false;
      const absHandler = (e: DeviceOrientationEvent) => {
        usedAbsolute = true;
        handleOrientationEvent(e);
      };

      const supportsAbsolute = 'ondeviceorientationabsolute' in window;
      if (supportsAbsolute) {
        window.addEventListener('deviceorientationabsolute' as any, absHandler, true);
        // Give it 1 second to fire; if it doesn't, fall back to regular
        const fallbackTimer = setTimeout(() => {
          if (!usedAbsolute) {
            window.removeEventListener('deviceorientationabsolute' as any, absHandler, true);
            window.addEventListener('deviceorientation', handleOrientationEvent, true);
            orientationCleanupRef.current = () => window.removeEventListener('deviceorientation', handleOrientationEvent, true);
          }
        }, 1000);

        orientationCleanupRef.current = () => {
          clearTimeout(fallbackTimer);
          window.removeEventListener('deviceorientationabsolute' as any, absHandler, true);
          window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        };
      } else {
        window.addEventListener('deviceorientation', handleOrientationEvent, true);
        orientationCleanupRef.current = () => window.removeEventListener('deviceorientation', handleOrientationEvent, true);
      }
    };

    startOrientation();

    return () => {
      if (orientationCleanupRef.current) {
        orientationCleanupRef.current();
        orientationCleanupRef.current = null;
      }
    };
  }, [closed, smoothHeading, toast]);

  // Subscribe to session status + other user's location via Realtime
  useRealtimeHub({
    channelKey: `compass:${sessionId}`,
    postgres: [
      {
        binding: {
          event: 'UPDATE',
          schema: 'public',
          table: 'compass_sessions',
          filter: `id=eq.${sessionId}`,
        },
        handler: (payload) => {
          const cs = payload.new as { status: string };
          if (cs.status === 'closed') {
            setClosed(true);
            toast('שיתוף המיקום הסתיים');
          }
        },
      },
      {
        binding: {
          event: '*',
          schema: 'public',
          table: 'compass_locations',
          filter: `compass_session_id=eq.${sessionId}`,
        },
        handler: (payload) => {
          const loc = payload.new as { participant_id: string; lat: number; lng: number; accuracy: number } | null;
          if (loc && session && loc.participant_id !== session.participantId) {
            setOtherLocation({ lat: Number(loc.lat), lng: Number(loc.lng), accuracy: Number(loc.accuracy) });
          }
        },
      },
    ],
    enabled: !!session && !closed,
  });

  // Initial fetch of other user's location (Realtime only catches changes)
  useEffect(() => {
    if (!session || closed) return;
    supabase
      .from('compass_locations')
      .select('lat, lng, accuracy, participant_id')
      .eq('compass_session_id', sessionId)
      .neq('participant_id', session.participantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setOtherLocation({ lat: Number(data.lat), lng: Number(data.lng), accuracy: Number(data.accuracy) });
        }
      });
  }, [session, sessionId, closed, setOtherLocation]);

  // Auto-disconnect on page leave / tab switch (with grace period)
  useEffect(() => {
    if (closed) return;

    let gracePeriodTimer: ReturnType<typeof setTimeout> | null = null;

    const handleBeforeUnload = () => {
      const blob = new Blob(
        [JSON.stringify({ action: 'close', sessionId })],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/secure/compass', blob);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        gracePeriodTimer = setTimeout(() => {
          closeCompass(sessionId);
          setClosed(true);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
        }, 30_000);
      } else {
        if (gracePeriodTimer) {
          clearTimeout(gracePeriodTimer);
          gracePeriodTimer = null;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (gracePeriodTimer) clearTimeout(gracePeriodTimer);
    };
  }, [closed, sessionId]);

  // Resume after background: re-check session + restart geo
  useAppResume(async () => {
    if (closed || !session) return;

    const { data: cs } = await supabase
      .from('compass_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (!cs || cs.status === 'closed') {
      setClosed(true);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      toast('שיתוף המיקום הסתיים');
      return;
    }

    const { data: otherLoc } = await supabase
      .from('compass_locations')
      .select('lat, lng, accuracy, participant_id')
      .eq('compass_session_id', sessionId)
      .neq('participant_id', session.participantId)
      .single();

    if (otherLoc) {
      setOtherLocation({ lat: otherLoc.lat, lng: otherLoc.lng, accuracy: otherLoc.accuracy });
    }

    // Restart geolocation watch (iOS kills it on background)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMyLocation(loc);

        // GPS heading when moving
        const speed = pos.coords.speed;
        const gpsHeading = pos.coords.heading;
        if (
          speed !== null &&
          speed > GPS_HEADING_SPEED_THRESHOLD &&
          gpsHeading !== null &&
          !isNaN(gpsHeading)
        ) {
          gpsHeadingRef.current = { heading: gpsHeading, time: Date.now() };
          smoothHeading(gpsHeading);
        }

        if (shouldSendUpdate(loc.lat, loc.lng)) {
          lastSentRef.current = { lat: loc.lat, lng: loc.lng, time: Date.now() };
          updateCompassLocation(sessionId, loc.lat, loc.lng, loc.accuracy, null);
        }
      },
      () => { /* error already shown on initial start */ },
      { enableHighAccuracy: true, maximumAge: GEO_MAX_AGE_MS, timeout: GEO_TIMEOUT_MS }
    );
  }, !closed && !!session);

  // Stop handler
  const handleStop = async () => {
    try {
      await closeCompass(sessionId);
    } catch {
      // Best-effort close — navigate away regardless
    }
    setClosed(true);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    toast('שיתוף המיקום הופסק');
    router.back();
  };

  // Calculate arrow direction & distance
  let arrowAngle = 0;
  let distance = 0;
  let lowAccuracy = false;

  if (myLocation && otherLocation) {
    const bearing = calcBearing(myLocation.lat, myLocation.lng, otherLocation.lat, otherLocation.lng);
    distance = calcDistance(myLocation.lat, myLocation.lng, otherLocation.lat, otherLocation.lng);
    arrowAngle = normalizeDelta(bearing - myHeading);
    lowAccuracy = myLocation.accuracy > GEO_LOW_ACCURACY_THRESHOLD || otherLocation.accuracy > GEO_LOW_ACCURACY_THRESHOLD;
  }

  return {
    myLocation,
    otherName,
    permissionError,
    closed,
    arrowAngle,
    distance,
    lowAccuracy,
    handleStop,
  };
}
