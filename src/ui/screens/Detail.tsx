import { useEffect, useState } from 'react';
import { getState, useAppState } from '../../lib/store';
import { aiEditPreview, confirmCategory, deleteImages, rerunOcr, rerunVision, setCategory, updateImage } from '../../lib/actions';
import { activeProviderConfig } from '../../ai/providers';
import { aiAskAboutImage, type ChatTurn } from '../../ai/vision';
import { categoryName, formatBytes, formatDate, useT } from '../../i18n';
import { displayTitle, primaryText } from '../../search/search';
import { safeFileName } from '../../import/validate';
import { extractEntities } from '../../lib/entities';
import { toast } from '../../lib/toast';
import { href, navigate } from '../router';
import { CategoryPicker, Empty, OcrBadge, Skeleton, confirmDialog } from '../components';
import { forgetThumb, saveBlob, useOriginal } from '../blobs';
import { nativeShareBlob } from '../../native/bridge';
import { IconBack, IconCalendar, IconCheck, IconCopy, IconDownload, IconEdit, IconFolder, IconImage, IconLink, IconMail, IconOpen, IconPhone, IconRefresh, IconShare, IconSpark, IconTrash, IconUndo, IconX } from '../icons';

export function DetailScreen({ id }: { id: string }) {
  const t = useT();
  const r = useAppState((s) => s.images.find((x) => x.id === id));
  const cat = useAppState((s) => s.categories.find((c) => c.id === r?.categoryId));
  const lang = useAppState((s) => s.settings.lang);
  const ocrEnabled = useAppState((s) => s.settings.ocrEnabled);
  const prog = useAppState((s) => s.ocr[id]);
  const aiBusy = useAppState((s) => s.visionBusy[id]);
  const aiCfg = useAppState((s) => s.settings.ai);
  const { url, blob } = useOriginal(id);
  const [zoom, setZoom] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ mode: 'clean' | 'emoji'; text: string } | null>(null);
  const [aiWorking, setAiWorking] = useState<'clean' | 'emoji' | null>(null);
  const [prevText, setPrevText] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askTurns, setAskTurns] = useState<ChatTurn[]>([]);
  const [webQuery, setWebQuery] = useState('');

  const aiOn = aiCfg.enabled && !!activeProviderConfig(aiCfg).apiKey && !!activeProviderConfig(aiCfg).model;
  const hasAi = r ? r.aiStatus === 'done' || !!(r.aiText ?? '') : false;
  const display = r ? primaryText(r) : '';
  const entities = r ? extractEntities(display) : [];

  const runAiEdit = async (mode: 'clean' | 'emoji') => {
    if (!r) return;
    if (!aiOn) return toast(t('detail.ai_disabled'), 'warning');
    setAiWorking(mode);
    try {
      const out = await aiEditPreview(r.id, mode);
      setAiPreview({ mode, text: out });
    } catch (e) {
      toast(t('detail.ai_failed', { msg: (e as Error).message }), 'error');
    } finally {
      setAiWorking(null);
    }
  };
  const applyAiPreview = async () => {
    if (!r || !aiPreview) return;
    const before = primaryText(r);
    const patch = hasAi ? { aiText: aiPreview.text } : { ocrText: aiPreview.text };
    await save(patch, t('detail.saved'));
    setPrevText(before);
    setAiPreview(null);
  };

  const askQuestion = async () => {
    if (!r || !askInput.trim() || askBusy) return;
    const q = askInput.trim();
    setAskInput('');
    setAskBusy(true);
    try {
      // Provider APIs are stateless: the image goes with every question.
      const imageDataUrl = await blobToDataUrl(blob);
      if (!imageDataUrl) throw new Error('image unavailable');
      const answer = await aiAskAboutImage(imageDataUrl, q, askTurns, aiCfg, lang);
      setAskTurns([...askTurns, { role: 'user', text: q }, { role: 'assistant', text: answer }]);
    } catch (e) {
      toast(t('detail.ai_failed', { msg: (e as Error).message }), 'error');
    } finally {
      setAskBusy(false);
    }
  };

  useEffect(() => {
    if (!r) return;
    setTitle(r.title);
    setNotes(r.notes);
    // Q&A conversation belongs to one image; reset it when the image changes.
    setAskTurns([]);
    setAskOpen(false);
    // Seed the web-search box with the best text we have (AI/manual text, else title).
    setWebQuery((primaryText(r) || r.title || '').replace(/\s*\n\s*/g, ' ').trim().slice(0, 300));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  useEffect(() => {
    if (r && !editingText) setText(primaryText(r));
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
      // Copy what is actually displayed (AI text or manual correction), not the raw OCR.
      await navigator.clipboard.writeText(display);
      toast(t('detail.copied'), 'success');
    } catch {
      toast(t('detail.copy_failed'), 'error');
    }
  };
  const fileName = safeFileName(r.fileName);
  /** Converts the stored original blob to a data URL for vision requests. */
  const blobToDataUrl = async (b: Blob | null): Promise<string | null> => {
    if (!b) return null;
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('image read failed'));
      fr.readAsDataURL(b);
    });
  };
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: r.mimeType });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (await nativeShareBlob(blob, fileName, { title: displayTitle(r) })) return;
      if (nav.share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: displayTitle(r) });
      else if (nav.share && display) await nav.share({ title: displayTitle(r), text: display });
      else {
        if (await saveBlob(blob, fileName)) toast(t('detail.share_unsupported'), 'info');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(t('detail.share_failed'), 'error');
    }
  };
  const download = async (b: Blob) => {
    try {
      if (await saveBlob(b, fileName)) toast(t('detail.saved'), 'success');
    } catch {
      toast(t('detail.save_failed'), 'error');
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
          <button type="button" className="btn icon" onClick={() => blob && void download(blob)} aria-label={t('detail.download')} title={t('detail.download')} disabled={!blob}>
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
            <img src={url} alt={displayTitle(r) || t('img.unnamed')} onClick={() => setZoom(!zoom)} data-testid="full-image" />
          )}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="d-title">{t('detail.title')}</label>
            <input
              id="d-title"
              className="input"
              value={title}
              placeholder={displayTitle({ title: '', fileName: r.fileName }) || t('img.unnamed')}
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
                    <button type="button" className="btn ghost sm" onClick={() => void copyText()} disabled={!display}>
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
            {aiBusy && (
              <div className="row" role="status">
                <span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderRightColor: 'transparent', borderRadius: '50%', flexShrink: 0 }} />
                <span className="small">{t('detail.ai_reading')}</span>
              </div>
            )}
            {r.aiStatus === 'error' && !aiBusy && (
              <div className="notice warn" role="alert">
                <span className="small">{t('detail.ai_error', { msg: r.aiError ?? '' })}</span>
                {aiOn && (
                  <button type="button" className="btn sm" onClick={() => rerunVision(r.id)}>
                    <IconRefresh /> {t('common.retry')}
                  </button>
                )}
              </div>
            )}
            {editingText ? (
              <>
                <label className="sr-only" htmlFor="d-text">{t('detail.text')}</label>
                <textarea id="d-text" className="input" value={text} onChange={(e) => setText(e.target.value)} rows={10} data-testid="ocr-edit" />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn sm" onClick={() => { setText(primaryText(r)); setEditingText(false); }}>
                    <IconX /> {t('common.cancel')}
                  </button>
                  <button type="button" className="btn sm primary" onClick={() => { void save(hasAi ? { aiText: text } : { ocrText: text }, t('detail.saved')); setEditingText(false); }}>
                    <IconCheck /> {t('common.save')}
                  </button>
                </div>
              </>
            ) : display ? (
              !hasAi && r.ocrConfidence > 0 && r.ocrConfidence < 55 ? (
                <div className="textpanel">
                  {/* Low-confidence OCR is collapsed so unreadable output is not the main result. */}
                  <details className="rawocr" data-testid="low-ocr">
                    <summary>{t('detail.ocr_low_details')}</summary>
                    <div className="body">{display}</div>
                  </details>
                  <p className="faint xs">{t('detail.ocr_low_ai')}</p>
                </div>
              ) : (
                <div className="textpanel">
                  <div className={`body ${hasAi ? 'ai' : 'raw'}`} data-testid="ocr-text" lang={r.ocrLanguage === 'eng' && !hasAi ? 'en' : undefined}>{display}</div>
                  {!hasAi && r.ocrConfidence > 0 && r.ocrConfidence < 55 && <p className="faint xs">{t('detail.ocr_low')}</p>}
                  {hasAi && r.ocrText && (
                    <details className="rawocr">
                      <summary>{t('detail.raw_ocr')}</summary>
                      <div className="body">{r.ocrText}</div>
                    </details>
                  )}
                </div>
              )
            ) : (
              <p className="faint">
                {r.ocrStatus === 'empty' ? t('detail.no_text') : r.ocrStatus === 'error' ? t('detail.ocr_error', { msg: r.ocrError ?? '' }) : r.ocrStatus === 'skipped' ? t('detail.ocr_skipped') : busy || aiBusy ? t('detail.ocr_wait') : t('detail.no_text')}
              </p>
            )}
            {aiOn && aiCfg.vision && !editingText && (
              <div className="card stack" style={{ gap: 10 }} data-testid="ask-panel">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong className="small">{t('detail.ask_title')}</strong>
                  {askTurns.length === 0 && (
                    <button type="button" className="btn ghost sm" onClick={() => setAskOpen((v) => !v)} aria-expanded={askOpen}>
                      {askOpen ? t('common.cancel') : t('detail.ask_open')}
                    </button>
                  )}
                </div>
                {(askOpen || askTurns.length > 0) && (
                  <>
                    <p className="faint xs">{t('detail.ask_hint')}</p>
                    {askTurns.length > 0 && (
                      <div className="stack" style={{ gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                        {askTurns.map((turn, i) => (
                          <div key={i} className={`textpanel ${turn.role === 'user' ? 'raw' : 'ai'}`}>
                            <div className="body">{turn.role === 'user' ? `❓ ${turn.text}` : turn.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {askBusy && (
                      <div className="row" role="status">
                        <span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderRightColor: 'transparent', borderRadius: '50%', flexShrink: 0 }} />
                        <span className="small">{t('detail.ask_busy')}</span>
                      </div>
                    )}
                    <form className="row" onSubmit={(e) => { e.preventDefault(); void askQuestion(); }}>
                      <label className="sr-only" htmlFor="d-ask">{t('detail.ask_title')}</label>
                      <input
                        id="d-ask"
                        className="input"
                        style={{ flex: 1 }}
                        value={askInput}
                        onChange={(e) => setAskInput(e.target.value)}
                        placeholder={t('detail.ask_placeholder')}
                        disabled={askBusy || !blob}
                        data-testid="ask-input"
                      />
                      <button type="submit" className="btn primary" disabled={!askInput.trim() || askBusy || !blob} data-testid="ask-send">
                        {t('detail.ask_send')}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
            <form
              className="row"
              data-testid="web-search"
              onSubmit={(e) => {
                // Text-based information search — the query is editable so
                // photos without readable text can be searched by their title/object.
                e.preventDefault();
                const q = webQuery.trim();
                if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
              }}
            >
              <label className="sr-only" htmlFor="d-websearch">{t('detail.web_search')}</label>
              <input
                id="d-websearch"
                className="input"
                style={{ flex: 1 }}
                value={webQuery}
                onChange={(e) => setWebQuery(e.target.value)}
                placeholder={t('detail.web_search_placeholder')}
                data-testid="web-search-input"
              />
              <button type="submit" className="btn ghost sm" disabled={!webQuery.trim()}>
                <IconOpen /> {t('detail.web_search')}
              </button>
            </form>
            {(r.ocrEdited || (hasAi && r.aiEdited)) && <p className="faint xs">{t('detail.edited_note')}</p>}
            {entities.length > 0 && !editingText && (
              <div className="field">
                <span className="label">{t('detail.entities')}</span>
                <div className="entities" data-testid="entities">
                  {entities.map((e) => (
                    <span key={`${e.kind}:${e.value}`} className="entity" data-testid={`entity-${e.kind}`}>
                      {e.kind === 'url' ? <IconLink /> : e.kind === 'email' ? <IconMail /> : e.kind === 'phone' ? <IconPhone /> : <IconCalendar />}
                      <span className="val">{e.value}</span>
                      <span className="act">
                        <button type="button" aria-label={t('ent.copy')} onClick={() => void navigator.clipboard.writeText(e.value).then(() => toast(t('detail.copied'), 'success'))}><IconCopy /></button>
                        {e.href && <a className="btn ghost icon" style={{ minWidth: 30, width: 30, height: 30, minHeight: 30 }} href={e.href} target={e.kind === 'url' ? '_blank' : undefined} rel={e.kind === 'url' ? 'noopener noreferrer' : undefined} aria-label={t('ent.open')}><IconOpen /></a>}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {aiOn && !editingText && !aiBusy && (
              <div className="row">
                {!hasAi && aiCfg.vision && (
                  <button type="button" className="btn sm" onClick={() => rerunVision(r.id)}>
                    <IconSpark /> {t('detail.ai_read')}
                  </button>
                )}
                {display && (
                  <>
                    <button type="button" className="btn sm" onClick={() => void runAiEdit('clean')} disabled={aiWorking !== null} data-testid="ai-clean">
                      <IconSpark /> {aiWorking === 'clean' ? t('common.working') : t('detail.ai_clean')}
                    </button>
                    <button type="button" className="btn sm" onClick={() => void runAiEdit('emoji')} disabled={aiWorking !== null} data-testid="ai-emoji">
                      <IconSpark /> {aiWorking === 'emoji' ? t('common.working') : t('detail.ai_emoji')}
                    </button>
                  </>
                )}
              </div>
            )}
            {aiPreview && (
              <div className="aipanel">
                <strong className="small">{t('detail.ai_preview')}</strong>
                <div className="body">{aiPreview.text}</div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn sm" onClick={() => setAiPreview(null)}>
                    <IconX /> {t('common.cancel')}
                  </button>
                  <button type="button" className="btn sm primary" onClick={() => void applyAiPreview()} data-testid="ai-apply">
                    <IconCheck /> {t('detail.ai_apply')}
                  </button>
                </div>
              </div>
            )}
            {prevText !== null && !aiPreview && (
              <div className="row">
                <button type="button" className="btn ghost sm" onClick={() => { void save(hasAi ? { aiText: prevText } : { ocrText: prevText }, t('detail.saved')); setPrevText(null); }}>
                  <IconUndo /> {t('detail.ai_undo')}
                </button>
              </div>
            )}
            {!busy && ocrEnabled && (
              <button
                type="button"
                className="btn sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={async () => {
                  if ((r.ocrEdited || (hasAi && r.aiEdited)) && !(await confirmDialog({ title: t('detail.rerun_title'), body: t('detail.rerun_body'), confirmLabel: t('detail.rerun') }))) return;
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
