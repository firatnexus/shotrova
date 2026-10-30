import { isNativeApp, markFirstFrame, nativeSplashRemoved, onNativeShare, onNativeSplashRemoved, takeNativeSharedFiles } from '../native/bridge';
import { useEffect, useRef, useState } from 'react';
import { useAppState, setState } from '../lib/store';
import { toast } from '../lib/toast';
import { useT } from '../i18n';
import { BRAND, logoSvg } from '../config/brand';
import { ACCEPT_ATTR } from '../import/validate';
import { href, navigate, useRoute } from './router';
import { useTabSwipe } from './swipe';
import { installKeyboardTracking } from './keyboard';
import { ConfirmHost, Skeleton, Toasts } from './components';
import { filesFromClipboard, registerPicker, runImport, useImportState } from './importer';
import { IconFolder, IconGrid, IconHome, IconOffline, IconScan, IconSettings } from './icons';
import { Dashboard } from './screens/Dashboard';
import { ImagesScreen } from './screens/Images';
import { DetailScreen } from './screens/Detail';
import { CategoriesScreen } from './screens/Categories';
import { SettingsScreen } from './screens/Settings';
import { ImportScreen } from './screens/Import';
import { BackgroundScreen } from './screens/Background';

export function Logo({ size = 28 }: { size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: logoSvg(size, { themed: true, sparkColor: BRAND.colors.line }) }} />;
}

export function App() {
  const t = useT();
  const route = useRoute();
  const ready = useAppState((s) => s.ready);
  const fatal = useAppState((s) => s.fatal);

  // Hand the native Android launch splash off only once the launch screen
  // has painted AND that painted state has been submitted to the compositor.
  // The page's first contentful paint IS the launch screen (static HTML in
  // index.html), so waiting for it keeps the native splash up until a real
  // frame exists — but FCP alone is not proof the frame reached the
  // compositor, so markFirstFrame also asks the native side for a
  // WebView.postVisualStateCallback confirmation (submitted-to-compositor;
  // per the Android docs this still does not prove presentation on the
  // display — no WebView API does). Falls back to the double-rAF signal
  // where the paint timing API is unavailable. markFirstFrame is idempotent.
  // The native trace (ShotrovaLaunch logcat tag) records the timing of
  // these events; see scripts/record-launch.sh.
  useEffect(() => {
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const signal = () => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => markFirstFrame());
      });
    };
    const painted = performance.getEntriesByType('paint').some((e) => e.name === 'first-contentful-paint');
    if (painted || typeof PerformanceObserver === 'undefined') {
      signal();
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    const po = new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) {
        po.disconnect();
        signal();
      }
    });
    po.observe({ type: 'paint', buffered: true });
    return () => {
      cancelled = true;
      po.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Fade the launch screen out only after the ready (or fatal) screen has
  // actually committed and painted — one frame after commit, so the app never
  // reveals stale skeletons underneath. Inside the Android app the exit also
  // waits for the native splash's splashRemoved event: the retained splash
  // view covers the composition until the launch frame has been submitted,
  // and starting the boot screen's own fade before that reveal would fade the
  // composition away while it is still hidden. A safety timeout (longer than
  // the native one) keeps a lost event from pinning the boot screen forever.
  // dismissBootScreen is idempotent.
  useEffect(() => {
    if (!ready && !fatal) return;
    let dismissed = false;
    const stop: Array<() => void> = [];
    const go = () => {
      if (dismissed) return;
      dismissed = true;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => dismissBootScreen());
      });
      stop.push(() => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      });
    };
    if (isNativeApp()) {
      const timer = window.setTimeout(go, 10000);
      stop.push(() => window.clearTimeout(timer));
      stop.push(onNativeSplashRemoved(go));
      // The event may have fired before this listener registered.
      void nativeSplashRemoved().then((r) => {
        if (r) go();
      });
    } else {
      go();
    }
    return () => {
      stop.forEach((fn) => fn());
    };
  }, [ready, fatal]);
  const online = useAppState((s) => s.online);
  const imp = useImportState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    registerPicker(() => inputRef.current?.click());
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const files = filesFromClipboard(e);
      if (!files.length) return;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && !files.length) return;
      e.preventDefault();
      void runImport(files, 'paste');
    };
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      void runImport(files, 'drop');
    };
    const on = () => setState({ online: true });
    const off = () => setState({ online: false });
    const onScroll = () => setScrolled(window.scrollY > 4);
    document.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Android app: images shared with "Share -> Shotrova" arrive through the native bridge.
  useEffect(() => {
    if (!ready || fatal || !isNativeApp()) return;
    let busy = false;
    const pull = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await takeNativeSharedFiles();
        if (!r || (!r.files.length && !r.failed.length)) return;
        navigate('/import');
        if (r.failed.length) toast(t('share.some_failed', { names: r.failed.join(', ') }), 'error');
        if (r.files.length) await runImport(r.files, 'share');
      } catch {
        toast(t('share.failed'), 'error');
      } finally {
        busy = false;
      }
    };
    void pull();
    return onNativeShare(() => void pull());
  }, [ready, fatal, t]);

  // Android app: capture sync + notification-tap navigation are owned by
  // installCaptureSync (see lib/actions init) — a single owner avoids double pulls.

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  useEffect(() => installKeyboardTracking(), []);

  const tab = route.parts[0] ?? '';
  // Swipes call navigate() like a tap would; the route stays the only tab state.
  const swipeRef = useTabSwipe(tab, ready && !fatal);
  const nav = [
    { to: '/', key: '', label: t('nav.home'), icon: <IconHome /> },
    { to: '/images', key: 'images', label: t('nav.images'), icon: <IconGrid /> },
    { to: '/categories', key: 'categories', label: t('nav.categories'), icon: <IconFolder /> },
    { to: '/settings', key: 'settings', label: t('nav.settings'), icon: <IconSettings /> },
  ];
  const isActive = (k: string) => (k === '' ? tab === '' : tab === k || (k === 'images' && tab === 'image'));

  let screen;
  if (!ready) screen = <LoadingScreen />;
  else if (fatal) screen = <FatalScreen code={fatal} />;
  else if (tab === '') screen = <Dashboard />;
  else if (tab === 'images') screen = <ImagesScreen />;
  else if (tab === 'image' && route.parts[1]) screen = <DetailScreen id={route.parts[1]} />;
  else if (tab === 'categories') screen = <CategoriesScreen />;
  else if (tab === 'settings') screen = <SettingsScreen />;
  else if (tab === 'import') screen = <ImportScreen />;
  else if (tab === 'background') screen = <BackgroundScreen />;
  else screen = <NotFound />;

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        {t('a11y.skip')}
      </a>
      <nav className="bottomnav" aria-label={t('a11y.main_nav')}>
        <a className="rail-logo" href={href("/")} aria-hidden="true" tabIndex={-1}>
          <Logo />
        </a>
        {nav.map((n) => (
          <a key={n.to} href={href(n.to)} aria-current={isActive(n.key) ? 'page' : undefined}>
            {n.icon}
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <div className="content-col">
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <a className="brand" href={href('/')}>
            <Logo />
            <span>{BRAND.name}</span>
          </a>
          <span className="spacer" />
          {!online && (
            <span className="badge" role="status">
              <IconOffline width={14} height={14} /> {t('net.offline')}
            </span>
          )}
          <button type="button" className="btn sm primary" onClick={() => inputRef.current?.click()} disabled={imp.busy} data-testid="scan-button">
            <IconScan /> {t('import.cta')}
          </button>
        </header>
        {imp.busy && imp.progress && (
          <div className="importbar" role="status" aria-live="polite" style={{ padding: '0 16px' }}>
            <div className="card" style={{ padding: 12, maxWidth: 1180, margin: '0 auto' }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <span>{t('import.progress', { done: imp.progress.done, total: imp.progress.total })}</span>
                <span className="faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>{imp.progress.current}</span>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <div style={{ width: `${(imp.progress.done / Math.max(1, imp.progress.total)) * 100}%` }} />
              </div>
            </div>
          </div>
        )}
        <main
          id="main"
          tabIndex={-1}
          data-screen={tab || 'home'}
          ref={swipeRef}
        >
          {screen}
        </main>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void runImport(files, 'picker');
        }}
      />
      {dragging && (
        <div className="scrim" style={{ alignItems: 'center', pointerEvents: 'none' }}>
          <div className="dropzone over" style={{ width: 'min(90vw, 480px)' }}>
            <strong>{t('import.drop_here')}</strong>
            <span className="faint">{t('import.formats')}</span>
          </div>
        </div>
      )}
      <Toasts />
      <ConfirmHost />
    </div>
  );
}

/**
 * Fades the static launch screen (index.html #boot) out and removes it.
 * Called only after the ready screen has committed and painted, so the app
 * beneath is never stale. Idempotent; honours reduced-motion by skipping
 * the fade (no transition events fire then).
 */
function dismissBootScreen() {
  const el = document.getElementById('boot');
  if (!el || el.classList.contains('is-done')) return;
  console.info('[boot] dismissed');
  const remove = () => el.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    remove();
    return;
  }
  el.classList.add('is-done');
  // animationend bubbles from the child entrance animation — only the
  // overlay's own exit fade may remove it.
  el.addEventListener('animationend', (e) => {
    if (e.target === el && e.animationName === 'boot-out') remove();
  });
  // Safety: the CSS fade may be disabled or interrupted — never leave it up.
  setTimeout(remove, 400);
}

function LoadingScreen() {
  return (
    <div className="stack" aria-busy="true">
      <Skeleton h={28} w="40%" />
      <Skeleton h={50} r={999} />
      <div className="stats">
        <Skeleton h={70} />
        <Skeleton h={70} />
        <Skeleton h={70} />
      </div>
      <div className="grid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} h={220} />
        ))}
      </div>
    </div>
  );
}

function FatalScreen({ code }: { code: string }) {
  const t = useT();
  return (
    <div className="empty" role="alert">
      <h2>{t('storage.fatal_title')}</h2>
      <p style={{ maxWidth: 460 }}>{t(code)}</p>
      <button type="button" className="btn primary" onClick={() => location.reload()}>
        {t('common.retry')}
      </button>
    </div>
  );
}

function NotFound() {
  const t = useT();
  return (
    <div className="empty">
      <h2>{t('notfound.title')}</h2>
      <a className="btn" href={href('/')}>{t('nav.home')}</a>
    </div>
  );
}
