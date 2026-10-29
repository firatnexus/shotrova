import { SearchInput } from '../SearchInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../lib/store';
import { confirmCategory, deleteImages, setCategory } from '../../lib/actions';
import { categoryAllNames, categoryName, locale, translate, useT } from '../../i18n';
import { fold } from '../../search/normalize';
import { parseQuery } from '../../search/query';
import { displayTitle, primaryText, search, type SearchOptions } from '../../search/search';
import { toast } from '../../lib/toast';
import { navigate, useRoute } from '../router';
import { Dropdown } from '../Dropdown';
import { Tile } from '../Tile';
import { CategoryPicker, Dot, Empty, confirmDialog, useDebounced, useProgressiveCount } from '../components';
import { forgetThumb } from '../blobs';
import { openPicker } from '../importer';
import { IconCheck, IconFolder, IconImage, IconSearch, IconSelect, IconTextCopy, IconTrash, IconX } from '../icons';

type DatePreset = '' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year' | 'custom';
const DAY = 86_400_000;

function presetRange(p: DatePreset, from: string, to: string): { from?: number; to?: number } {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (p) {
    case '7d':
      return { from: sod - 6 * DAY };
    case '30d':
      return { from: sod - 29 * DAY };
    case 'this_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
    case 'last_month':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), to: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
    case 'this_year':
      return { from: new Date(now.getFullYear(), 0, 1).getTime() };
    case 'custom': {
      const r: { from?: number; to?: number } = {};
      if (from) r.from = new Date(`${from}T00:00:00`).getTime();
      if (to) r.to = new Date(`${to}T00:00:00`).getTime() + DAY;
      return r;
    }
    default:
      return {};
  }
}

export function ImagesScreen() {
  const t = useT();
  const route = useRoute();
  const images = useAppState((s) => s.images);
  const categories = useAppState((s) => s.categories);
  const lang = useAppState((s) => s.settings.lang);
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [cat, setCat] = useState<string>(route.query.get('cat') ?? '');
  const [review, setReview] = useState(route.query.get('review') === '1');
  const [preset, setPreset] = useState<DatePreset>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<NonNullable<SearchOptions['sort']>>('relevance');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState(false);
  const lastClicked = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q, 120);

  // Keep state in sync when navigating to this screen with new params (e.g. from the dashboard).
  const qs = route.query.toString();
  useEffect(() => {
    setQ(route.query.get('q') ?? '');
    setCat(route.query.get('cat') ?? '');
    setReview(route.query.get('review') === '1');
    if (route.query.get('focus') === 'search') searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const catNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) for (const n of categoryAllNames(c)) for (const w of fold(n).split(/\s+/)) if (w.length >= 4) m[w] = c.id;
    return m;
  }, [categories]);
  const catLabel = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, categoryAllNames(c).join(' ')]));
    return (id: string) => m.get(id) ?? '';
  }, [categories]);

  const parsed = useMemo(() => parseQuery(dq, new Date(), catNames), [dq, catNames]);
  const range = presetRange(preset, from, to);
  const hits = useMemo(
    () =>
      search(images, parsed, {
        categoryId: cat || null,
        needsReview: review,
        ...(range.from !== undefined ? { dateFrom: range.from } : {}),
        ...(range.to !== undefined ? { dateTo: range.to } : {}),
        sort: sort === 'relevance' && !parsed.terms.length && !parsed.tags.length ? 'newest' : sort,
        categoryLabel: catLabel,
        locale: locale(lang),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, parsed, cat, review, range.from, range.to, sort, catLabel, lang],
  );
  const terms = useMemo(() => [...parsed.terms, ...Object.values(parsed.synonyms).flat(), ...parsed.tags], [parsed]);
  const visibleIds = hits.map((h) => h.item.id);
  const shown = useProgressiveCount(hits.length);

  const toggle = (id: string, shift: boolean) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked.current) {
        const a = visibleIds.indexOf(lastClicked.current);
        const b = visibleIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          for (const x of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClicked.current = id;
  };
  const exitSelect = () => {
    setSelecting(false);
    setSel(new Set());
  };
  useEffect(() => {
    if (!selecting) return;
    // Lets the Android back button leave selection mode first.
    document.documentElement.dataset.selecting = 'true';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      delete document.documentElement.dataset.selecting;
      window.removeEventListener('keydown', onKey);
    };
  }, [selecting]);

  const bulkCopyText = async () => {
    const chosen = images.filter((r) => sel.has(r.id));
    const withText = chosen.filter((r) => primaryText(r).trim());
    if (!withText.length) return toast(t('bulk.copy_empty'), 'warning');
    const joined = withText
      .map((r) => `${displayTitle(r) || t('img.unnamed')}
${primaryText(r)}`)
      .join('\n\n———\n\n');
    try {
      await navigator.clipboard.writeText(joined);
      toast(t('bulk.copied_text', { n: withText.length }), 'success');
    } catch {
      toast(t('detail.copy_failed'), 'error');
    }
  };

  const bulkDelete = async () => {
    const ids = [...sel];
    const ok = await confirmDialog({ title: t('bulk.delete_title', { n: ids.length }), body: t('bulk.delete_body'), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await deleteImages(ids);
      ids.forEach(forgetThumb);
      toast(t('bulk.deleted', { n: ids.length }), 'success');
      exitSelect();
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };
  const bulkCategorize = async (catId: string) => {
    const ids = [...sel];
    setPicker(false);
    try {
      await setCategory(ids, catId);
      toast(t('bulk.categorized', { n: ids.length, cat: categoryName(categories.find((c) => c.id === catId), lang) }), 'success');
      exitSelect();
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };
  const bulkConfirm = async () => {
    const ids = [...sel];
    await confirmCategory(ids);
    toast(t('bulk.confirmed', { n: ids.length }), 'success');
    exitSelect();
  };

  const dateLabel = parsed.date
    ? parsed.date.label.key === 'date.month'
      ? new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(new Date(Number(parsed.date.label.params?.year), Number(parsed.date.label.params?.month), 1))
      : translate(lang, parsed.date.label.key, parsed.date.label.params)
    : null;
  const hintedCats = [...new Set(Object.values(parsed.categoryHints))];
  const filtersActive = Boolean(cat || review || preset);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('nav.images')}</h1>
        {images.length > 0 && (
          <button type="button" className="btn sm" onClick={() => (selecting ? exitSelect() : setSelecting(true))} aria-pressed={selecting}>
            {selecting ? <IconX /> : <IconSelect />} {selecting ? t('common.cancel') : t('bulk.select')}
          </button>
        )}
      </div>
      <form className="searchbox" role="search" onSubmit={(e) => e.preventDefault()}>
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} testId="search" />
      </form>

      <div className="chips" role="group" aria-label={t('filter.categories')}>
        <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat('')}>
          {t('filter.all')}
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? '' : c.id)}>
            <Dot color={c.color} />
            {categoryName(c, lang)}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="sr-only" id="date-l">{t('filter.date')}</span>
        <Dropdown
          value={preset}
          labelledBy="date-l"
          testId="date-filter"
          placement="below"
          triggerStyle={{ width: 'auto', minWidth: 150 }}
          onChange={(v) => setPreset(v)}
          options={[
            { value: '' as DatePreset, label: t('filter.any_date') },
            { value: '7d', label: t('filter.7d') },
            { value: '30d', label: t('filter.30d') },
            { value: 'this_month', label: t('date.this_month') },
            { value: 'last_month', label: t('date.last_month') },
            { value: 'this_year', label: t('date.this_year') },
            { value: 'custom', label: t('filter.custom') },
          ]}
        />
        <span className="sr-only" id="sort-l">{t('sort.label')}</span>
        <Dropdown
          value={sort}
          labelledBy="sort-l"
          testId="sort"
          placement="below"
          triggerStyle={{ width: 'auto', minWidth: 140 }}
          onChange={(v) => setSort(v)}
          options={[
            { value: 'relevance', label: t('sort.relevance') },
            { value: 'newest', label: t('sort.newest') },
            { value: 'oldest', label: t('sort.oldest') },
            { value: 'title', label: t('sort.title') },
          ]}
        />
        <button type="button" className="chip" aria-pressed={review} onClick={() => setReview(!review)}>
          {t('filter.review')}
        </button>
        {filtersActive && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setCat('');
              setReview(false);
              setPreset('');
            }}
          >
            {t('filter.clear')}
          </button>
        )}
      </div>
      {preset === 'custom' && (
        <div className="row">
          <div className="field">
            <label htmlFor="f-from">{t('filter.from')}</label>
            <input id="f-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-to">{t('filter.to')}</label>
            <input id="f-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {(dateLabel || hintedCats.length > 0 || parsed.tags.length > 0 || parsed.explicitCategory) && dq && (
        <p className="faint" role="note" data-testid="query-understood">
          {t('search.understood')}{' '}
          {dateLabel && <span className="badge accent">{t('search.date_chip', { label: dateLabel })}</span>}{' '}
          {hintedCats.map((id) => (
            <span key={id} className="badge" style={{ marginRight: 4 }}>
              {t('search.cat_chip', { cat: categoryName(categories.find((c) => c.id === id), lang) })}
            </span>
          ))}
          {parsed.tags.map((tg) => (
            <span key={tg} className="badge" style={{ marginRight: 4 }}>#{tg}</span>
          ))}
        </p>
      )}

      <p className="faint" aria-live="polite" data-testid="result-count">
        {images.length === 0 ? '' : t(hits.length === 1 ? 'search.results_one' : 'search.results', { n: hits.length })}
        {dq && images.length > 0 && <span> · {t('search.text_based')}</span>}
      </p>

      {images.length === 0 ? (
        <Empty icon={<IconImage />} title={t('images.empty_title')} body={t('images.empty_body')}>
          <button type="button" className="btn" onClick={openPicker}>
            {t('import.cta')}
          </button>
        </Empty>
      ) : hits.length === 0 ? (
        <Empty icon={<IconSearch />} title={t('search.none_title')} body={t('search.none_body')}>
          {(filtersActive || q) && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQ('');
                setCat('');
                setReview(false);
                setPreset('');
                navigate('/images', true);
              }}
            >
              {t('filter.clear_all')}
            </button>
          )}
        </Empty>
      ) : (
        <div className="grid" data-testid="grid">
          {hits.slice(0, shown).map((h) => (
            <Tile key={h.item.id} r={h.item} terms={terms} selecting={selecting} selected={sel.has(h.item.id)} onToggle={toggle} />
          ))}
        </div>
      )}

      {selecting && (
        <div className="selectbar" role="toolbar" aria-label={t('bulk.toolbar')}>
          <span className="count" aria-live="polite">{t('bulk.selected', { n: sel.size })}</span>
          <button type="button" className="btn sm" onClick={() => setSel(new Set(sel.size === visibleIds.length ? [] : visibleIds))}>
            {sel.size === visibleIds.length ? t('bulk.none') : t('bulk.all')}
          </button>
          <button type="button" className="btn sm" disabled={!sel.size} onClick={() => void bulkConfirm()}>
            <IconCheck /> {t('bulk.confirm')}
          </button>
          <button type="button" className="btn sm" disabled={!sel.size} onClick={() => void bulkCopyText()} data-testid="bulk-copy-text">
            <IconTextCopy /> {t('bulk.copy_text')}
          </button>
          <button type="button" className="btn sm" disabled={!sel.size} onClick={() => setPicker(true)}>
            <IconFolder /> {t('bulk.categorize')}
          </button>
          <button type="button" className="btn sm danger" disabled={!sel.size} onClick={() => void bulkDelete()}>
            <IconTrash /> {t('common.delete')}
          </button>
        </div>
      )}
      {picker && <CategoryPicker title={t('bulk.categorize_title', { n: sel.size })} onClose={() => setPicker(false)} onPick={(id) => void bulkCategorize(id)} />}
    </div>
  );
}
