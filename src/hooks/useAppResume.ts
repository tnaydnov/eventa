/**
 * useAppResume - fires a callback when the user returns to the app.
 *
 * On mobile, users constantly jump between apps, lock/unlock the phone,
 * pull down notification shade, etc. The `visibilitychange` event is the
 * most reliable signal across iOS Safari, Android Chrome, and PWAs.
 *
 * The callback is stored in a ref so it can close over the latest state
 * without causing re-subscriptions.
 */

import { useEffect, useRef } from 'react';

export function useAppResume(callback: () => void, enabled = true): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled]);
}
