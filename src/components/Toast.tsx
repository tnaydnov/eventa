'use client';

import { useToastStore } from '@/lib/store';
import { AnimatePresence } from 'framer-motion';
import { AnimatedToast } from './Animations';

export default function Toast() {
  const message = useToastStore((s) => s.message);

  return (
    <AnimatePresence>
      {message && <AnimatedToast message={message} />}
    </AnimatePresence>
  );
}
