import { useEffect, useRef, useState } from 'react';
import { useAppState, setState } from '../lib/store';
import { consumeShareInbox } from '../lib/actions';
import { toast } from '../lib/toast';
import { useT } from '../i18n';
import { BRAND, logoSvg } from '../config/brand';
import { ACCEPT_ATTR } from '../import/validate';
import { href, navigate, useRoute } from './router';
import { ConfirmHost, Skeleton, Toasts } from './components';
import { filesFromClipboard, registerPicker, runImport, useImportState } from './importer';
import { IconFolder, IconGrid, IconHome, IconOffline, IconPlus, IconSettings } from './icons';
import { Dashboard } from './screens/Dashboard';
import { ImagesScreen } from './screens/Images';
import { DetailScreen } from './screens/Detail';
import { CategoriesScreen } from './screens/Categories';
import { SettingsScreen } from './screens/Settings';
import { ImportScreen } from './screens/Import';

export function Logo({ size = 30 }: { size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: logoSvg(size) }} />;
}

export function App() {
  const t = useT();
  const route = useRoute();
  const ready = useAppState((s) => s.ready);
  const fatal = useAppState((s) => s.fatal);
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

  // Android share target: the service worker parks shared files in Cache Storage.
  useEffect(() => {
    if (!ready || fatal) return;
    if (route.path === '/import' && route.query.has('shared')) {
      void consumeShareInbox()
        .then((files) => {
          navigate('/import', true);
          if (files.length) return runImport(files, 'share');
          toast(t('share.nothing'), 'warning');
          return null;
        })
        .catch(() => toast(t('share.failed'), 'error'));
    }
  }, [ready, fatal, route.path, route.query, t]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  const tab = route.parts[0] ?? '';
  const nav = [
    { to: '/', key: '', label: t('nav.home'), icon: <IconHome /> },
    { to: '/images', key: 'images', label: t('nav.images'), icon: <IconGrid /> },
    null,
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
  else screen = <NotFound />;

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        {t('a11y.skip')}
      </a>
      <nav className="bottomnav" aria-label={t('a11y.main_nav')}>
        {nav.map((n, i) =>
          n ? (
            <a key={n.to} href={href(n.to)} aria-current={isActive(n.key) ? 'page' : undefined}>
              {n.icon}
              <span>{n.label}</span>
            </a>
          ) : (
            <div className="navfab" key={`fab${i}`}>
              <button type="button" onClick={() => inputRef.current?.click()} aria-label={t('import.cta')} title={t('import.cta')} disabled={imp.busy}>
                <IconPlus />
              </button>
            </div>
          ),
        )}
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
        <main id="main" tabIndex={-1}>{screen}</main>
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
