import { useState } from 'react';
import { useAppState } from '../../lib/store';
import { useT } from '../../i18n';
import { toast } from '../../lib/toast';
import { href } from '../router';
import { Tile } from '../Tile';
import { clearLastImport, openPicker, readClipboardImages, runImport, useImportState } from '../importer';
import { IconAlert, IconClipboard, IconShare, IconUpload } from '../icons';

export function ImportScreen() {
  const t = useT();
  const { last, busy } = useImportState();
  const images = useAppState((s) => s.images);
  const queue = images.filter((i) => i.ocrStatus === 'pending' || i.ocrStatus === 'processing');
  const [over, setOver] = useState(false);
  const added = last ? last.added.map((a) => images.find((i) => i.id === a.id) ?? a) : [];

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
    <div className="stack" style={{ gap: 16 }}>
      <h1>{t('import.title')}</h1>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
      >
        <IconUpload className="big" />
        <strong>{t('import.card_title')}</strong>
        <span className="faint">{t('import.card_body')}</span>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={openPicker} disabled={busy}>
            <IconUpload /> {t('import.cta')}
          </button>
          <button type="button" className="btn" onClick={() => void paste()} disabled={busy}>
            <IconClipboard /> {t('import.paste')}
          </button>
        </div>
        <span className="faint xs">{t('import.formats')}</span>
      </div>

      <div className="notice">
        <IconShare />
        <span>{t('import.share_hint_app')}</span>
      </div>
      <p className="faint small">{t('import.no_gallery')}</p>

      {last && (
        <section className="card stack" aria-labelledby="last-h" data-testid="import-summary">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="last-h">{t('import.last')}</h2>
            <button type="button" className="btn ghost sm" onClick={clearLastImport}>{t('common.close')}</button>
          </div>
          <div className="row">
            <span className="badge ok">{t('import.added', { n: last.added.length })}</span>
            <span className="badge">{t('import.duplicates', { n: last.duplicates.length })}</span>
            <span className={`badge ${last.invalid.length ? 'err' : ''}`}>{t('import.invalid', { n: last.invalid.length })}</span>
          </div>
          {last.storageError && (
            <div className="notice warn" role="alert">
              <IconAlert />
              <span>{t(last.storageError.kind === 'quota' ? 'storage.quota' : 'storage.write_failed')}</span>
            </div>
          )}
          {last.duplicates.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="label">{t('import.dup_list')}</span>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {last.duplicates.map((d, i) => (
                  <li key={i}>
                    {d.name}
                    {d.existingId && images.some((x) => x.id === d.existingId) && (
                      <>
                        {' — '}
                        <a href={href(`/image/${d.existingId}`)}>{t('import.dup_open')}</a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {last.invalid.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="label">{t('import.invalid_list')}</span>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }} data-testid="invalid-list">
                {last.invalid.map((d, i) => (
                  <li key={i}>
                    {d.name}: {t(`import.err.${d.reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {added.length > 0 && (
            <div className="grid">
              {added.map((r) => (
                <Tile key={r.id} r={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {queue.length > 0 && !last && (
        <section className="stack" aria-labelledby="q-h">
          <h2 id="q-h">{t('import.queue_title', { n: queue.length })}</h2>
          <div className="grid">
            {queue.map((r) => (
              <Tile key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
