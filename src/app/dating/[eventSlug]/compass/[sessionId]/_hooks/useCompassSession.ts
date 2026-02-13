'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useCompassStore, useToastStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { updateCompassLocation, closeCompass, getParticipant } from '@/lib/api';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { calcBearing, calcDistance, normalizeDelta } from '@/lib/compass-math';
import { GEO_MAX_AGE_MS, GEO_TIMEOUT_MS, GEO_LOW_ACCURACY_THRESHOLD, GEO_THROTTLE_DISTANCE_M, GEO_THROTTLE_INTERVAL_MS } from '@/lib/constants';

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

  // Device orientation (iOS uses webkitCompassHeading — no TS types available)
  useEffect(() => {
    if (closed) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : 0);
      setMyHeading(heading);
    };

    const requestPermission = async () => {
      if (
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        try {
          const result = await (DeviceOrientationEvent as any).requestPermission();
          if (result === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            toast('⚠️ יש לאשר גישה לחיישן תנועה כדי שהמצפן יציג כיוון');
          }
        } catch {
          toast('⚠️ יש לאשר גישה לחיישן תנועה כדי שהמצפן יציג כיוון');
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [closed, setMyHeading, toast]);

  // Subscribe to session status changes via Realtime (event-scoped, secure)
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
    ],
    enabled: !!session && !closed,
  });

  // Poll other user's location every 1s (compass_locations not exposed via Realtime for security)
  useEffect(() => {
    if (!session || closed) return;

    const fetchOtherLocation = () => {
      supabase
        .from('compass_locations')
        .select('lat, lng, accuracy, participant_id')
        .eq('compass_session_id', sessionId)
        .neq('participant_id', session.participantId)
        .single()
        .then(({ data }) => {
          if (data) {
            setOtherLocation({ lat: data.lat, lng: data.lng, accuracy: data.accuracy });
          }
        });
    };

    // Initial fetch
    fetchOtherLocation();
    // Poll every 1 second
    const intervalId = setInterval(fetchOtherLocation, 1000);
    return () => clearInterval(intervalId);
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
