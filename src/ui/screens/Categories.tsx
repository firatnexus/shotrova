import { useMemo, useState } from 'react';
import { useAppState } from '../../lib/store';
import { createCategory, deleteCategory, moveCategory, updateCategory } from '../../lib/actions';
import { CATEGORY_COLORS } from '../../categorize/defaults';
import { DEFAULT_KEYWORDS } from '../../categorize/defaults';
import { categoryName, useT } from '../../i18n';
import { toast } from '../../lib/toast';
import { href } from '../router';
import { Sheet, confirmDialog } from '../components';
import { IconDown, IconEdit, IconPlus, IconTrash, IconUp } from '../icons';
import type { Category } from '../../db/types';

export function CategoriesScreen() {
  const t = useT();
  const categories = useAppState((s) => s.categories);
  const images = useAppState((s) => s.images);
  const lang = useAppState((s) => s.settings.lang);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of images) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1);
    return m;
  }, [images]);

  const remove = async (c: Category) => {
    const n = counts.get(c.id) ?? 0;
    const fb = categories.find((x) => x.isFallback);
    const ok = await confirmDialog({
      title: t('cats.delete_title', { name: categoryName(c, lang) }),
      body: n ? t('cats.delete_body_n', { n, fallback: categoryName(fb, lang) }) : t('cats.delete_body'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(c.id);
      toast(t('cats.deleted'), 'success');
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('nav.categories')}</h1>
        <button type="button" className="btn primary" onClick={() => setEditing('new')} data-testid="new-category">
          <IconPlus /> {t('cats.new')}
        </button>
      </div>
      <p className="faint">{t('cats.intro')}</p>
      <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="category-list">
        {categories.map((c, i) => (
          <li key={c.id} className="item">
            <span className="swatch-btn" style={{ background: c.color }} aria-hidden="true" />
            <a className="grow" href={href(`/images?cat=${encodeURIComponent(c.id)}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="title">{categoryName(c, lang)}</div>
              <div className="faint xs">
                {t('cat.count', { n: counts.get(c.id) ?? 0 })}
                {c.keywords.length > 0 && ` · ${t('cats.kw_count', { n: c.keywords.length })}`}
                {c.isFallback && ` · ${t('cats.fallback')}`}
              </div>
            </a>
            <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
              <button type="button" className="btn ghost icon" aria-label={t('cats.move_up', { name: categoryName(c, lang) })} disabled={i === 0} onClick={() => void moveCategory(c.id, -1)}>
                <IconUp />
              </button>
              <button type="button" className="btn ghost icon" aria-label={t('cats.move_down', { name: categoryName(c, lang) })} disabled={i === categories.length - 1} onClick={() => void moveCategory(c.id, 1)}>
                <IconDown />
              </button>
              <button type="button" className="btn ghost icon" aria-label={t('cats.edit', { name: categoryName(c, lang) })} onClick={() => setEditing(c)}>
                <IconEdit />
              </button>
              {!c.isFallback && (
                <button type="button" className="btn ghost icon danger" aria-label={t('cats.delete', { name: categoryName(c, lang) })} onClick={() => void remove(c)}>
                  <IconTrash />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing && <CategoryEditor cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryEditor({ cat, onClose }: { cat: Category | null; onClose: () => void }) {
  const t = useT();
  const lang = useAppState((s) => s.settings.lang);
  const categories = useAppState((s) => s.categories);
  const [name, setName] = useState(cat ? categoryName(cat, lang) : '');
  const [color, setColor] = useState(cat?.color ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] ?? '#E8572A');
  const [kw, setKw] = useState((cat?.keywords ?? []).join(', '));
  const builtinKw = cat ? Object.keys(DEFAULT_KEYWORDS[cat.id] ?? {}) : [];
  const [err, setErr] = useState('');

  const submit = async () => {
    const n = name.trim();
    if (!n) return setErr(t('cats.err_empty'));
    const dup = categories.find((c) => c.id !== cat?.id && categoryName(c, lang).toLocaleLowerCase(lang) === n.toLocaleLowerCase(lang));
    if (dup) return setErr(t('cats.err_dup'));
    const keywords = [...new Set(kw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 100);
    try {
      if (cat) {
        const patch: Parameters<typeof updateCategory>[1] = { color, keywords };
        if (n !== categoryName(cat, lang)) patch.name = n;
        await updateCategory(cat.id, patch);
        toast(t('cats.saved'), 'success');
      } else {
        await createCategory(n, color, keywords);
        toast(t('cats.created', { name: n }), 'success');
      }
      onClose();
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };

  return (
    <Sheet
      title={cat ? t('cats.edit_title') : t('cats.new')}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" onClick={() => void submit()} data-testid="save-category">{t('common.save')}</button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label htmlFor="c-name">{t('cats.name')}</label>
          <input id="c-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} maxLength={40} aria-invalid={Boolean(err)} aria-describedby={err ? 'c-err' : undefined} data-autofocus />
          {err && <span id="c-err" className="small" style={{ color: 'var(--danger)' }} role="alert">{err}</span>}
        </div>
        <div className="field">
          <span className="label" id="c-color">{t('cats.color')}</span>
          <div className="palette" role="group" aria-labelledby="c-color">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" style={{ background: c }} aria-pressed={c === color} aria-label={c} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="c-kw">{t('cats.keywords')}</label>
          <textarea id="c-kw" className="input" rows={3} value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t('cats.keywords_ph')} style={{ minHeight: 80 }} />
          <span className="faint xs">{t('cats.keywords_help')}</span>
          {builtinKw.length > 0 && (
            <details>
              <summary className="faint xs" style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>{t('cats.builtin_kw', { n: builtinKw.length })}</summary>
              <p className="faint xs">{builtinKw.join(', ')}</p>
            </details>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
