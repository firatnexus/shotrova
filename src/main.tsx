import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { applyTheme, init } from './lib/actions';
import { getState, subscribe } from './lib/store';
import './ui/styles.css';
import { installNativeBackHandler, isNativeApp } from './native/bridge';

if (isNativeApp()) {
  document.documentElement.classList.add('native-app', 'native');
  installNativeBackHandler();
  // Inside the APK the app behaves like a native app: no pinch/double-tap zoom.
  // (The public website keeps the browser's zoom and accessibility intact.)
  const vp = document.querySelector('meta[name="viewport"]');
  vp?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

void init();

// The launch screen (#boot in index.html) is dismissed by the App component:
// it fades out only after the ready screen has committed and painted, and on
// Android the native launch splash hands off to it at the first painted frame
// (see App). main.tsx no longer touches it, so the screen is never removed
// before the app beneath is ready to show.

// Follow the OS theme while the preference is "system".
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getState().settings.theme === 'system') applyTheme();
});
let lastLang = getState().settings.lang;
subscribe(() => {
  const l = getState().settings.lang;
  if (l !== lastLang) {
    lastLang = l;
    document.documentElement.lang = l;
  }
});

// The Android app ships every file inside the APK, so it needs no service worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeApp()) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A new version took over; reload once so the page and the cache agree.
    if (hadController && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then((reg) => {
      const check = () => void reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      window.addEventListener('online', check);
    }, () => undefined);
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
