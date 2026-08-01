'use client';

import { useRef } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { useSessionStore } from '@/lib/store';

const VITALS_SAMPLE_RATE = 0.1;

/**
 * WebVitalsReporter - ships Core Web Vitals to /api/telemetry/vitals.
 *
 * Uses `navigator.sendBeacon` (fire-and-forget, survives page unload) with
 * `fetch` as fallback. Drop this component into the root layout.
 */
export default function WebVitalsReporter() {
  const sampledRef = useRef(Math.random() < VITALS_SAMPLE_RATE);

  useReportWebVitals((metric) => {
    if (!sampledRef.current) return;

    const eventId = useSessionStore.getState().session?.eventId;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      url: window.location.pathname,
      event_id: eventId,
    });

    const url = '/api/telemetry/vitals';

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
        () => { /* non-critical */ },
      );
    }
  });

  return null;
}
