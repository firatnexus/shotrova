import { useMemo, useEffect, useState } from 'react';
import { useAppState } from '../../lib/store';
import { updateSettings } from '../../lib/actions';
import { categoryName, useT } from '../../i18n';
import { toast } from '../../lib/toast';
import { href, navigate } from '../router';
import { Tile } from '../Tile';
import { Dot } from '../components';
import { openPicker, readClipboardImages, runImport } from '../importer';
import { IconClipboard, IconPhone, IconSearch, IconShield, IconUpload, IconX } from '../icons';
import { isNativeApp } from '../../native/bridge';
import { CaptureSetupSheet, CaptureStatusCard, openSetup } from '../CaptureCard';
import { refreshCaptureStatus } from '../../auto/capture';

const EXAMPLES = ['ex.q1', 'ex.q2', 'ex.q3', 'ex.q4', 'ex.q5', 'ex.q6'];

export function Dashboard() {
  const t = useT();
  const images = useAppState((s) => s.images);
  const categories = useAppState((s) => s.categories);
  const lang = useAppState((s) => s.settings.lang);
  const onboardingDismissed = useAppState((s) => s.settings.onboardingDismissed);
  const captureConsentSeen = useAppState((s) => s.settings.capture?.aiConsent);
  const queue = useAppState((s) => s.ocrQueueLength);
  const visionQueue = useAppState((s) => s.visionQueueLength);
  const engine = useAppState((s) => s.ocrEngine);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of images) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1);
    return m;
  }, [images]);
  const review = useMemo(() => images.filter((i) => i.needsReview && i.ocrStatus !== 'pending' && i.ocrStatus !== 'processing'), [images]);
  const withText = useMemo(() => images.filter((i) => i.ocrStatus === 'done').length, [images]);
  const empty = images.length === 0;

  // First run on the native app: open the consent sheet once (opt-in only).
  useEffect(() => {
    if (isNativeApp() && !onboardingDismissed && captureConsentSeen === undefined) {
      openSetup();
    }
  }, [onboardingDismissed, captureConsentSeen]);

  // Keep the status card fresh while the dashboard is visible.
  useEffect(() => {
    if (!isNativeApp()) return;
    void refreshCaptureStatus();
  }, []);

  const submit = (v: string) => {
    if (!v.trim()) return navigate('/images');
    navigate(`/images?q=${encodeURIComponent(v.trim())}`);
  };

  return (
    <div className="stack" style={{ gap: 0 }}>
      <section className="hero" aria-labelledby="dash-title">
        <div className="stack" style={{ gap: 4 }}>
          <h1 id="dash-title">{empty ? t('dash.title_empty') : t('dash.title')}</h1>
          <p className="muted">{empty ? t('dash.sub_empty') : t('dash.sub', { n: images.length })}</p>
        </div>
        <form
          className="searchbox"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
        >
          <IconSearch />
          <input className="input" type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.label')} />
          {q && (
            <button type="button" className="btn ghost icon clear" aria-label={t('search.clear')} onClick={() => setQ('')}>
              <IconX />
            </button>
          )}
        </form>
        <div className="chips" aria-label={t('dash.examples')}>
          {EXAMPLES.map((k) => (
            <button key={k} type="button" className="chip" onClick={() => submit(t(k))}>
              {t(k)}
            </button>
          ))}
        </div>
        <div className="stats">
          <div className="stat">
            <b data-testid="total-count">{images.length}</b>
            <span>{t('dash.total')}</span>
          </div>
          <div className="stat">
            <b>{withText}</b>
            <span>{t('dash.with_text')}</span>
          </div>
          <a className="stat" href={href('/images?review=1')} style={{ textDecoration: 'none', color: 'inherit' }}>
            <b>{review.length}</b>
            <span>{t('dash.to_review')}</span>
          </a>
        </div>
        {(queue > 0 || visionQueue > 0) && (
          <div className="notice" role="status" aria-live="polite">
            <span className="spin" style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderRightColor: 'transparent', borderRadius: '50%', flexShrink: 0, marginTop: 2 }} />
            <span>
              {queue > 0 ? (engine === 'loading' ? t('ocr.engine_loading') : t('ocr.queue', { n: queue })) : ''}
              {queue > 0 && visionQueue > 0 ? ' · ' : ''}
              {visionQueue > 0 ? t('ai.queue', { n: visionQueue }) : ''}
            </span>
          </div>
        )}
      </section>

      {empty && isNativeApp() && <CaptureStatusCard />}
      {empty && !onboardingDismissed && <Onboarding />}
      {empty && onboardingDismissed && <ImportCard compact={isNativeApp()} />}

      {!empty && (
        <section className="section" aria-labelledby="recent-h">
          <div className="section-head">
            <h2 id="recent-h">{t('dash.recent')}</h2>
            <a href={href('/images')}>{t('common.see_all')}</a>
          </div>
          <div className="recent">
            {images.slice(0, 12).map((r) => (
              <Tile key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      {review.length > 0 && (
        <section className="section" aria-labelledby="review-h">
          <div className="section-head">
            <h2 id="review-h">{t('dash.review_title')}</h2>
            <a href={href('/images?review=1')}>{t('common.see_all')}</a>
          </div>
          <p className="faint" style={{ marginBottom: 12 }}>{t('dash.review_body')}</p>
          <div className="recent">
            {review.slice(0, 10).map((r) => (
              <Tile key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="cats-h">
        <div className="section-head">
          <h2 id="cats-h">{t('nav.categories')}</h2>
          <a href={href('/categories')}>{t('common.manage')}</a>
        </div>
        <div className="catgrid">
          {categories.map((c) => (
            <a key={c.id} className="catcard" href={href(`/images?cat=${encodeURIComponent(c.id)}`)}>
              <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
              <span className="name">{categoryName(c, lang)}</span>
              <span className="count" aria-label={t('cat.count', { n: counts.get(c.id) ?? 0 })}>{counts.get(c.id) ?? 0}</span>
            </a>
          ))}
        </div>
      </section>

      {!empty && (
        <section className="section">
          {isNativeApp() ? <CaptureStatusCard /> : null}
          <ImportCard compact />
        </section>
      )}
      <CaptureSetupSheet />
    </div>
  );
}

function ImportCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const paste = async () => {
    try {
      const files = await readClipboardImages();
      if (files === null) return toast(t('import.paste_hint'), 'info');
      if (!files.length) return toast(t('import.paste_empty'), 'warning');
      await runImport(files, 'paste');
    } catch {
      toast(t('import.paste_denied'), 'warning');
    }
  };
  return (
    <div className="dropzone vf" data-testid="dropzone">
      {!compact && <IconUpload className="big" />}
      <strong>{t('import.card_title')}</strong>
      <span className="faint">{t('import.card_body')}</span>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn primary" onClick={openPicker}>
          <IconUpload /> {t('import.cta')}
        </button>
        <button type="button" className="btn" onClick={() => void paste()}>
          <IconClipboard /> {t('import.paste')}
        </button>
      </div>
      <span className="faint xs">{t('import.formats')}</span>
    </div>
  );
}

function Onboarding() {
  const t = useT();
  return (
    <section className="section stack" aria-labelledby="ob-h" style={{ gap: 16 }}>
      <ImportCard />
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="ob-h">{t('ob.title')}</h2>
          <button type="button" className="btn ghost sm" onClick={() => void updateSettings({ onboardingDismissed: true })}>
            {t('ob.hide')}
          </button>
        </div>
        <ol className="steps">
          <li>
            <div><strong>{t('ob.s1')}</strong><p className="faint">{t('ob.s1b')}</p></div>
          </li>
          <li>
            <div><strong>{t('ob.s2')}</strong><p className="faint">{t('ob.s2b')}</p></div>
          </li>
          <li>
            <div><strong>{t('ob.s3')}</strong><p className="faint">{t('ob.s3b')}</p></div>
          </li>
        </ol>
      </div>
      <div className="notice">
        <IconShield />
        <span>{t('ob.privacy')}</span>
      </div>
      <div className="notice">
        <IconPhone />
        <span>
          {t('ob.android')} <a href={href('/settings?s=install')}>{t('ob.android_link')}</a>
        </span>
      </div>
    </section>
  );
}

export { Dot };
