import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p = '/', q = ''] = h.split('?');
  const path = p.startsWith('/') ? p : `/${p}`;
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

let current = typeof location === 'undefined' ? { path: '/', parts: [], query: new URLSearchParams() } : parse();
let key = typeof location === 'undefined' ? '' : location.hash;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    key = location.hash;
    current = parse();
    listeners.forEach((l) => l());
  });
}

export function useRoute(): Route {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => key,
    () => key,
  );
  return current;
}

export function navigate(to: string, replace = false): void {
  const target = `#${to}`;
  if (replace) {
    history.replaceState(null, '', target);
    key = location.hash;
    current = parse();
    listeners.forEach((l) => l());
  } else location.hash = to;
}

export function href(to: string): string {
  return `#${to}`;
}
