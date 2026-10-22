import { useSyncExternalStore } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, kind: ToastKind = 'info', action?: Toast['action'], ms = kind === 'error' ? 7000 : 4000): number {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, kind, message, ...(action ? { action } : {}) }];
  emit();
  setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
