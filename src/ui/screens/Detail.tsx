import { useEffect, useState } from 'react';
import { getState, useAppState } from '../../lib/store';
import { confirmCategory, deleteImages, rerunOcr, setCategory, updateImage } from '../../lib/actions';
import { categoryName, formatBytes, formatDate, useT } from '../../i18n';
import { displayTitle } from '../../search/search';
import { safeFileName } from '../../import/validate';
import { toast } from '../../lib/toast';
import { href, navigate } from '../router';
import { CategoryPicker, Empty, OcrBadge, Skeleton, confirmDialog } from '../components';
import { downloadBlob, forgetThumb, useOriginal } from '../blobs';
import { IconBack, IconCheck, IconCopy, IconDownload, IconEdit, IconFolder, IconImage, IconRefresh, IconShare, IconTrash, IconX } from '../icons';

export function DetailScreen({ id }: { id: string }) {
  const t = useT();
  const r = useAppState((s) => s.images.find((x) => x.id === id));
  const cat = useAppState((s) => s.categories.find((c) => c.id === r?.categoryId));
  const lang = useAppState((s) => s.settings.lang);
  const ocrEnabled = useAppState((s) => s.settings.ocrEnabled);
  const prog = useAppState((s) => s.ocr[id]);
  const { url, blob } = useOriginal(id);
  const [zoom, setZoom] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!r) return;
    setTitle(r.title);
    setNotes(r.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  useEffect(() => {
    if (r && !editingText) setText(r.ocrText);
  }, [r, editingText]);

  if (!r)
    return (
      <Empty icon={<IconImage />} title={t('detail.missing')}>
        <a className="btn" href={href('/images')}>{t('nav.images')}</a>
      </Empty>
    );

  const save = async (patch: Parameters<typeof updateImage>[1], msg?: string) => {
    try {
      await updateImage(r.id, patch);
      if (msg) toast(msg, 'success');
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };
  const addTags = (raw: string) => {
    const add = raw.split(/[,\n]/).map((x) => x.trim().replace(/^#/, '')).filter(Boolean);
    if (!add.length) return;
    void save({ tags: [...r.tags, ...add] });
    setTagInput('');
  };
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(r.ocrText);
      toast(t('detail.copied'), 'success');
    } catch {
      toast(t('detail.copy_failed'), 'error');
    }
  };
  const fileName = safeFileName(r.fileName);
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: r.mimeType });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: displayTitle(r) });
      else if (nav.share && r.ocrText) await nav.share({ title: displayTitle(r), text: r.ocrText });
      else {
        downloadBlob(blob, fileName);
        toast(t('detail.share_unsupported'), 'info');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(t('detail.share_failed'), 'error');
    }
  };
  const remove = async () => {
    const ok = await confirmDialog({ title: t('detail.delete_title'), body: t('detail.delete_body'), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await deleteImages([r.id]);
      forgetThumb(r.id);
      toast(t('bulk.deleted', { n: 1 }), 'success');
      navigate('/images', true);
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };
  const busy = r.ocrStatus === 'pending' || r.ocrStatus === 'processing';
  const srcLabel: Record<string, string> = { auto: t('detail.src_auto'), rule: t('detail.src_rule'), ai: t('detail.src_ai'), manual: t('detail.src_manual'), none: t('detail.src_none') };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn ghost sm" onClick={() => (history.length > 1 ? history.back() : navigate('/images'))}>
          <IconBack /> {t('common.back')}
        </button>
        <div className="row">
          <button type="button" className="btn icon" onClick={() => void share()} aria-label={t('detail.share')} title={t('detail.share')} disabled={!blob}>
            <IconShare />
          </button>
          <button type="button" className="btn icon" onClick={() => blob && downloadBlob(blob, fileName)} aria-label={t('detail.download')} title={t('detail.download')} disabled={!blob}>
            <IconDownload />
          </button>
          <button type="button" className="btn icon danger" onClick={() => void remove()} aria-label={t('common.delete')} title={t('common.delete')}>
            <IconTrash />
          </button>
        </div>
      </div>
      <div className="detail">
        <div className={`viewer ${zoom ? 'zoomed' : ''}`}>
          {url === undefined ? (
            <Skeleton h={420} />
          ) : url === null ? (
            <Empty icon={<IconImage />} title={t('detail.image_missing')} />
          ) : (
            <img src={url} alt={displayTitle(r)} onClick={() => setZoom(!zoom)} data-testid="full-image" />
          )}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="d-title">{t('detail.title')}</label>
            <input
              id="d-title"
              className="input"
              value={title}
              placeholder={displayTitle({ title: '', fileName: r.fileName })}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== r.title && void save({ title: title.trim() }, t('detail.saved'))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              maxLength={200}
            />
          </div>

          <div className={`card stack ${r.needsReview && !busy ? 'review' : ''}`} style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">{t('detail.category')}</span>
              <span className="badge">{srcLabel[r.categorySource]}</span>
            </div>
            <button type="button" className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => setPicker(true)} data-testid="category-button">
              <span className="swatch-btn" style={{ background: cat?.color, width: 18, height: 18, borderRadius: 5 }} aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left' }}>{categoryName(cat, lang)}</span>
              <IconFolder />
            </button>
            {r.categorySource !== 'manual' && r.categorySource !== 'none' && (
              <p className="faint">
                {t('detail.confidence', { n: Math.round(r.categoryConfidence * 100) })}
                {r.categoryReasons.length > 0 && <> · {t('detail.reasons', { list: r.categoryReasons.slice(0, 6).join(', ') })}</>}
              </p>
            )}
            {r.needsReview && !busy && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">{r.categorySource === 'none' ? t('review.none') : t('review.question')}</span>
                {r.categorySource !== 'none' && (
                  <button type="button" className="btn sm primary" onClick={() => void confirmCategory([r.id]).then(() => toast(t('review.confirmed'), 'success'))}>
                    <IconCheck /> {t('review.yes')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">{t('detail.text')}</span>
              <div className="row" style={{ gap: 4 }}>
                <OcrBadge r={r} />
                {!editingText && (
                  <>
                    <button type="button" className="btn ghost sm" onClick={() => void copyText()} disabled={!r.ocrText}>
                      <IconCopy /> {t('detail.copy')}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => setEditingText(true)}>
                      <IconEdit /> {t('common.edit')}
                    </button>
                  </>
                )}
              </div>
            </div>
            {busy && prog && (
              <div className="progress" aria-label={t('ocr.status.processing')}>
                <div style={{ width: `${Math.round((prog.status === 'recognizing text' ? prog.progress : 0.05) * 100)}%` }} />
              </div>
            )}
            {editingText ? (
              <>
                <label className="sr-only" htmlFor="d-text">{t('detail.text')}</label>
                <textarea id="d-text" className="input" value={text} onChange={(e) => setText(e.target.value)} rows={10} data-testid="ocr-edit" />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn sm" onClick={() => { setText(r.ocrText); setEditingText(false); }}>
                    <IconX /> {t('common.cancel')}
                  </button>
                  <button type="button" className="btn sm primary" onClick={() => { void save({ ocrText: text }, t('detail.saved')); setEditingText(false); }}>
                    <IconCheck /> {t('common.save')}
                  </button>
                </div>
              </>
            ) : r.ocrText ? (
              <div className="ocrtext" data-testid="ocr-text" lang={r.ocrLanguage === 'eng' ? 'en' : undefined}>{r.ocrText}</div>
            ) : (
              <p className="faint">
                {r.ocrStatus === 'empty' ? t('detail.no_text') : r.ocrStatus === 'error' ? t('detail.ocr_error', { msg: r.ocrError ?? '' }) : r.ocrStatus === 'skipped' ? t('detail.ocr_skipped') : busy ? t('detail.ocr_wait') : t('detail.no_text')}
              </p>
            )}
            {r.ocrEdited && <p className="faint xs">{t('detail.edited_note')}</p>}
            {!busy && ocrEnabled && (
              <button
                type="button"
                className="btn sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={async () => {
                  if (r.ocrEdited && !(await confirmDialog({ title: t('detail.rerun_title'), body: t('detail.rerun_body'), confirmLabel: t('detail.rerun') }))) return;
                  rerunOcr(r.id);
                }}
              >
                <IconRefresh /> {r.ocrStatus === 'error' ? t('common.retry') : t('detail.rerun')}
              </button>
            )}
          </div>

          <div className="field">
            <span className="label" id="tags-l">{t('detail.tags')}</span>
            <div className="tags" aria-labelledby="tags-l">
              {r.tags.map((tg) => (
                <span key={tg} className="tag">
                  #{tg}
                  <button type="button" aria-label={t('detail.remove_tag', { tag: tg })} onClick={() => void save({ tags: r.tags.filter((x) => x !== tg) })}>
                    <IconX />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                addTags(tagInput);
              }}
            >
              <label className="sr-only" htmlFor="d-tag">{t('detail.add_tag')}</label>
              <input id="d-tag" className="input" style={{ flex: 1 }} value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={t('detail.tag_placeholder')} />
              <button type="submit" className="btn" disabled={!tagInput.trim()}>{t('common.add')}</button>
            </form>
          </div>

          <div className="field">
            <label htmlFor="d-notes">{t('detail.notes')}</label>
            <textarea
              id="d-notes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== r.notes && void save({ notes }, t('detail.saved'))}
              placeholder={t('detail.notes_placeholder')}
              rows={3}
            />
          </div>

          <dl className="kv">
            <dt>{t('detail.added')}</dt>
            <dd>{formatDate(r.createdAt, lang, true)}</dd>
            {r.fileLastModified && (
              <>
                <dt>{t('detail.file_date')}</dt>
                <dd>{formatDate(r.fileLastModified, lang, true)}</dd>
              </>
            )}
            <dt>{t('detail.filename')}</dt>
            <dd data-testid="filename">{r.fileName}</dd>
            <dt>{t('detail.size')}</dt>
            <dd>
              {r.width}×{r.height} · {formatBytes(r.size, lang)} · {r.mimeType.replace('image/', '').toUpperCase()}
            </dd>
          </dl>
        </div>
      </div>
      {picker && (
        <CategoryPicker
          title={t('detail.pick_category')}
          current={r.categoryId}
          onClose={() => setPicker(false)}
          onPick={(cid) => {
            setPicker(false);
            void setCategory([r.id], cid).then(
              () => toast(t('detail.category_set', { cat: categoryName(findCat(cid), lang) }), 'success'),
              (e: Error) => toast(`${t('storage.write_failed')} (${e.message})`, 'error'),
            );
          }}
        />
      )}
    </div>
  );
}

function findCat(id: string) {
  return getState().categories.find((c) => c.id === id);
}
