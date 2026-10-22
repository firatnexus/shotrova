import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useToasts, dismissToast } from '../lib/toast';
import { useAppState } from '../lib/store';
import { categoryName, useT } from '../i18n';
import { findMatches, type Range } from '../search/normalize';
import type { Category, ImageRecord } from '../db/types';
import { IconAlert, IconCheck, IconInfo, IconX } from './icons';

// ------------------------------------------------------------------ toasts

export function Toasts() {
  const list = useToasts();
  const t = useT();
  return (
    <div className="toasts" role="region" aria-label={t('a11y.notifications')}>
      {list.map((x) => (
        <div key={x.id} className={`toast ${x.kind === 'error' ? 'error' : ''}`} role={x.kind === 'error' ? 'alert' : 'status'}>
          {x.kind === 'error' || x.kind === 'warning' ? <IconAlert width={18} height={18} /> : x.kind === 'success' ? <IconCheck width={18} height={18} /> : <IconInfo width={18} height={18} />}
          <span className="msg">{x.message}</span>
          {x.action && (
            <button
              type="button"
              onClick={() => {
                x.action?.run();
                dismissToast(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
          <button type="button" aria-label={t('common.close')} onClick={() => dismissToast(x.id)}>
            <IconX width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ modal sheet

export function Sheet({ title, onClose, children, actions, labelledBy }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const tid = labelledBy ?? `${id}-t`;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        const a = f[0] as HTMLElement;
        const b = f[f.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = ov;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={tid} ref={ref}>
        <h2 id={tid}>{title}</h2>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ confirm()

interface ConfirmReq {
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}
let confirmReq: ConfirmReq | null = null;
const cl = new Set<() => void>();

export function confirmDialog(o: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmReq = { ...o, resolve };
    cl.forEach((l) => l());
  });
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (l) => {
      cl.add(l);
      return () => cl.delete(l);
    },
    () => confirmReq,
    () => confirmReq,
  );
  const t = useT();
  if (!req) return null;
  const done = (v: boolean) => {
    confirmReq = null;
    cl.forEach((l) => l());
    req.resolve(v);
  };
  return (
    <Sheet
      title={req.title}
      onClose={() => done(false)}
      actions={
        <>
          <button type="button" className="btn" onClick={() => done(false)} data-autofocus>
            {t('common.cancel')}
          </button>
          <button type="button" className={`btn ${req.danger ? 'danger solid' : 'primary'}`} onClick={() => done(true)}>
            {req.confirmLabel}
          </button>
        </>
      }
    >
      {req.body && <p className="muted">{req.body}</p>}
    </Sheet>
  );
}

// ------------------------------------------------------------------ small pieces

export function Skeleton({ h = 160, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, ...(r ? { borderRadius: r } : {}) }} aria-hidden="true" />;
}

export function Empty({ icon, title, body, children }: { icon?: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      {body && <p style={{ maxWidth: 420 }}>{body}</p>}
      {children}
    </div>
  );
}

export function Highlight({ text, terms, ranges }: { text: string; terms?: string[]; ranges?: Range[] }) {
  const rs = ranges ?? (terms && terms.length ? findMatches(text, terms) : []);
  if (!rs.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  rs.forEach((r, i) => {
    if (r.start > pos) out.push(text.slice(pos, r.start));
    out.push(<mark key={i}>{text.slice(r.start, r.end)}</mark>);
    pos = r.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} aria-hidden="true" />;
}

export function useCategory(id: string): Category | undefined {
  return useAppState((s) => s.categories.find((c) => c.id === id));
}

export function OcrBadge({ r }: { r: ImageRecord }) {
  const t = useT();
  const prog = useAppState((s) => s.ocr[r.id]);
  const aiBusy = useAppState((s) => s.visionBusy[r.id]);
  if (aiBusy || r.aiStatus === 'pending') return <span className="badge accent">{t('detail.ai_badge')}…</span>;
  if (r.aiStatus === 'done' && (r.aiText ?? '') !== '') return <span className="badge accent">{t('detail.ai_badge')}</span>;
  switch (r.ocrStatus) {
    case 'pending':
      return <span className="badge">{t('ocr.status.pending')}</span>;
    case 'processing':
      return (
        <span className="badge accent">
          {t('ocr.status.processing')}
          {prog && prog.status === 'recognizing text' ? ` ${Math.round(prog.progress * 100)}%` : ''}
        </span>
      );
    case 'empty':
      return <span className="badge">{t('ocr.status.empty')}</span>;
    case 'error':
      return <span className="badge err">{t('ocr.status.error')}</span>;
    case 'skipped':
      return <span className="badge">{t('ocr.status.skipped')}</span>;
    default:
      return null;
  }
}

/** Category picker used in details and bulk actions. */
export function CategoryPicker({ current, onPick, onClose, title }: { current?: string; onPick: (id: string) => void; onClose: () => void; title: string }) {
  const cats = useAppState((s) => s.categories);
  const lang = useAppState((s) => s.settings.lang);
  const t = useT();
  return (
    <Sheet title={title} onClose={onClose} actions={<button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>}>
      <div className="picklist" role="list">
        {cats.map((c) => (
          <button key={c.id} type="button" role="listitem" aria-pressed={c.id === current} onClick={() => onPick(c.id)}>
            <span className="swatch-btn" style={{ background: c.color, width: 20, height: 20, borderRadius: 6 }} aria-hidden="true" />
            <span style={{ flex: 1 }}>{categoryName(c, lang)}</span>
            {c.id === current && <IconCheck width={18} height={18} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function useDebounced<T>(v: T, ms = 150): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const h = setTimeout(() => setD(v), ms);
    return () => clearTimeout(h);
  }, [v, ms]);
  return d;
}
