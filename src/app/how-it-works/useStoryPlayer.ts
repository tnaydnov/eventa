import { useState, useCallback, useEffect, useRef } from 'react';
import { ORGANIZER_STEPS, GUEST_STEPS } from './data';
import type { Journey, Step } from './data';

const TRANSITION_MS = 250;
const AUTO_ADVANCE_MS = 6000;

export interface StoryPlayer {
  journey: Journey;
  step: number;
  steps: Step[];
  current: Step;
  transitioning: boolean;
  paused: boolean;
  goTo: (idx: number) => void;
  next: () => void;
  prev: () => void;
  switchJourney: (j: Journey) => void;
  togglePause: () => void;
}

export function useStoryPlayer(): StoryPlayer {
  const [journey, setJourney] = useState<Journey>('organizer');
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = journey === 'organizer' ? ORGANIZER_STEPS : GUEST_STEPS;
  const current = steps[step];

  /* Clear any pending transition timeout before starting a new one */
  const startTransition = useCallback((apply: () => void) => {
    if (transitionRef.current) clearTimeout(transitionRef.current);
    setTransitioning(true);
    transitionRef.current = setTimeout(() => {
      apply();
      setTransitioning(false);
      transitionRef.current = null;
    }, TRANSITION_MS);
  }, []);

  const goTo = useCallback((idx: number) => {
    if (idx === step || transitioning) return;
    startTransition(() => setStep(idx));
  }, [step, transitioning, startTransition]);

  const next = useCallback(() => {
    if (step < steps.length - 1) goTo(step + 1);
  }, [step, steps.length, goTo]);

  const prev = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  const switchJourney = useCallback((j: Journey) => {
    if (j === journey) return;
    startTransition(() => {
      setJourney(j);
      setStep(0);
    });
  }, [journey, startTransition]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  /* Keyboard nav - ignore when focus is on interactive elements */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'ArrowLeft') next();      // RTL: left = forward
      if (e.key === 'ArrowRight') prev();     // RTL: right = back
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  /* Auto-advance timer */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (paused) return;
    timerRef.current = setTimeout(() => {
      if (step < steps.length - 1) {
        goTo(step + 1);
      }
    }, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step, steps.length, goTo, paused]);

  /* Clean up on unmount */
  useEffect(() => {
    return () => {
      if (transitionRef.current) clearTimeout(transitionRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    journey, step, steps, current,
    transitioning, paused,
    goTo, next, prev, switchJourney, togglePause,
  };
}
