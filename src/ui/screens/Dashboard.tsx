import type { ImageRecord } from '../../db/types';
import { useMemo, useEffect, useState } from 'react';
import { useAppState } from '../../lib/store';
import { updateSettings } from '../../lib/actions';
import { categoryName, useT } from '../../i18n';
import { toast } from '../../lib/toast';
import { href, navigate } from '../router';
import { Thumb, Tile } from '../Tile';
import { HandArrow, Sticker } from '../stickers';
import { displayTitle } from '../../search/search';
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
  const captureSetupSeen = useAppState((s) => !!s.settings.capture?.setupSeen);
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
    if (isNativeApp() && !onboardingDismissed && !captureSetupSeen) {
      openSetup();
    }
  }, [onboardingDismissed, captureSetupSeen]);

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
        <div className="hero-copy">
          <span className="caption-hand" aria-hidden="true">
            {t('dash.caption')}
            <HandArrow />
          </span>
          <div style={{ position: 'relative' }}>
            <h1 id="dash-title">
              <MarkedTitle text={empty ? t('dash.title_empty') : t('dash.title')} mark={empty ? t('dash.title_empty_mark') : t('dash.title_mark')} />
            </h1>
            <Sticker kind="bolt" size={40} rotate={12} className="sticker-m" style={{ right: 4, top: -52 }} />
            <Sticker kind="heart" size={30} rotate={-10} className="sticker-m" style={{ right: 46, top: -36 }} />
          </div>
          <p className="lead">{empty ? t('dash.sub_empty') : t('dash.sub', { n: images.length })}</p>
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
        </div>
        <HeroArt images={images.slice(0, 3)} />
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

      {/* Every home screen resolves on the closing orange brand band. */}
      <section className="section stack" style={{ gap: 16 }}>
        {!empty && isNativeApp() ? <CaptureStatusCard /> : null}
        <ImportCard compact={!empty || (onboardingDismissed && isNativeApp())} />
      </section>
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
    <div className="dropzone band" data-testid="dropzone">
      <Sticker kind="sparkle" size={52} rotate={-12} style={{ right: 28, top: 26 }} />
      <Sticker kind="ghost" size={46} rotate={9} style={{ right: 84, top: 64 }} />
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

/** Display headline with one word in marker orange and a hand-drawn underline. */
function MarkedTitle({ text, mark }: { text: string; mark: string }) {
  const i = mark ? text.toLocaleLowerCase().indexOf(mark.toLocaleLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="marker">{text.slice(i, i + mark.length)}</span>
      {text.slice(i + mark.length)}
    </>
  );
}

/** Hero product object: the latest screenshots as a tilted polaroid stack
 *  with a school name-label sticker — or, when empty, a stack of blank
 *  polaroids waiting for their first photo. Desktop only, decorative. */
function HeroArt({ images }: { images: ImageRecord[] }) {
  const t = useT();
  const lang = useAppState((s) => s.settings.lang);
  const categories = useAppState((s) => s.categories);
  const top = images[0];
  const cat = top ? categories.find((c) => c.id === top.categoryId) : undefined;
  const slots = ['p1', 'p2', 'p3'];
  // Front photo (p3) is the newest; behind it the next two.
  const order = [images[2], images[1], images[0]];
  return (
    <div className="hero-art" aria-hidden="true">
      {slots.map((cls, i) => (
        <div key={cls} className={`stack-photo ${cls}`}>
          <div className="ph" style={{ position: 'relative' }}>{order[i] ? <Thumb id={order[i]!.id} alt="" /> : null}</div>
        </div>
      ))}
      <span className="caption-hand">
        <HandArrow />
        {top ? t('dash.art_caption') : t('dash.art_caption_empty')}
      </span>
      <div className="label-sticker">
        <div className="l-row"><span className="l-key">{t('label.name')}</span><span className="l-val">{top ? displayTitle(top) || t('img.unnamed') : '—'}</span></div>
        <div className="l-row"><span className="l-key">{t('label.cat')}</span><span className="l-val">{cat ? categoryName(cat, lang) : '—'}</span></div>
        <div className="l-row"><span className="l-key">{t('label.no')}</span><span className="l-val">{images.length ? String(images.length).padStart(3, '0') : '000'}</span></div>
      </div>
      <Sticker kind="bolt" size={64} rotate={14} style={{ left: 0, top: '58%' }} />
      <Sticker kind="heart" size={52} rotate={-9} style={{ right: '4%', top: '44%', zIndex: 4 }} />
      <Sticker kind="star" size={44} rotate={8} style={{ left: '44%', top: -10, zIndex: 4 }} />
    </div>
  );
}

export { Dot };
