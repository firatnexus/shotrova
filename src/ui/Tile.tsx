import type { ImageRecord } from '../db/types';
import { categoryName, useT } from '../i18n';
import { useAppState } from '../lib/store';
import { displayTitle } from '../search/search';
import { excerpt } from '../search/normalize';
import { useThumb } from './blobs';
import { Dot, Highlight, OcrBadge } from './components';
import { href } from './router';
import { IconCheck, IconImage } from './icons';

export function Thumb({ id, alt }: { id: string; alt: string }) {
  const url = useThumb(id);
  if (url === undefined) return <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />;
  if (url === null)
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <IconImage width={32} height={32} />
      </div>
    );
  return <img src={url} alt={alt} loading="lazy" decoding="async" draggable={false} />;
}

export function Tile({
  r,
  terms = [],
  selecting = false,
  selected = false,
  onToggle,
  compact = false,
}: {
  r: ImageRecord;
  terms?: string[];
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (id: string, shift: boolean) => void;
  compact?: boolean;
}) {
  const t = useT();
  const cat = useAppState((s) => s.categories.find((c) => c.id === r.categoryId));
  const lang = useAppState((s) => s.settings.lang);
  const title = displayTitle(r);
  const snip = terms.length && r.ocrText ? excerpt(r.ocrText.replace(/\s+/g, ' '), terms, 50) : null;
  const inner = (
    <>
      <div className="thumb">
        <Thumb id={r.id} alt={title} />
        <div className="status">
          <OcrBadge r={r} />
          {r.needsReview && r.ocrStatus !== 'pending' && r.ocrStatus !== 'processing' && <span className="badge warn">{t('review.badge')}</span>}
        </div>
        {selecting && (
          <span className="check" aria-hidden="true">
            {selected && <IconCheck />}
          </span>
        )}
      </div>
      {!compact && (
        <div className="meta">
          <span className="title">
            <Highlight text={title} terms={terms} />
          </span>
          <span className="catline">
            <Dot color={cat?.color ?? '#888'} />
            <span>{categoryName(cat, lang)}</span>
          </span>
          {snip && snip.ranges.length > 0 && (
            <span className="snippet">
              <Highlight text={snip.text} ranges={snip.ranges} />
            </span>
          )}
        </div>
      )}
    </>
  );
  if (selecting)
    return (
      <button
        type="button"
        className={`tile ${selected ? 'selected' : ''}`}
        aria-pressed={selected}
        aria-label={title}
        onClick={(e) => onToggle?.(r.id, e.shiftKey)}
      >
        {inner}
      </button>
    );
  return (
    <a className="tile" href={href(`/image/${r.id}`)} aria-label={compact ? title : undefined} data-testid="tile">
      {inner}
    </a>
  );
}
