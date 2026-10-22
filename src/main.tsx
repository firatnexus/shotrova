import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { applyTheme, init } from './lib/actions';
import { getState, subscribe } from './lib/store';
import './ui/styles.css';

void init();

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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
