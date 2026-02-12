import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (msg: string, duration?: number) => void;
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (msg, duration = 3000) => {
    if (_toastTimer) clearTimeout(_toastTimer);
    set({ message: msg });
    _toastTimer = setTimeout(() => {
      set({ message: null });
      _toastTimer = null;
    }, duration);
  },
}));
