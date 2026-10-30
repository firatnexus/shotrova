import { useEffect, useMemo, useState } from 'react';
import type { OcrLangCode } from '../db/types';
import { useAppState } from '../lib/store';
import { updateSettings } from '../lib/actions';
import { toast } from '../lib/toast';
import { formatBytes, useT } from '../i18n';
import {
  OCR_LANGS,
  OcrPackError,
  composeOcrLanguage,
  installPack,
  isBundled,
  ocrLangInfo,
  packStatus,
  parseOcrLanguage,
  removePack,
} from '../ocr/packs';
import { Dropdown } from './Dropdown';
import { Toggle } from './components';

/**
 * OCR language picker: custom dropdown with the twelve languages, install
 * state per language, an "also recognise English" switch, and management of
 * downloaded packs. A language only becomes the OCR language after its data is
 * installed and verified — never just by being picked in the menu.
 */
export function OcrLanguageField() {
  const t = useT();
  const s = useAppState((st) => st.settings);
  const { primary, withEnglish } = parseOcrLanguage(s.ocrLanguage);
  const [installed, setInstalled] = useState<Record<string, boolean> | null>(null);
  const [installing, setInstalling] = useState<{ code: OcrLangCode; progress: number } | null>(null);

  const refresh = async () => setInstalled(await packStatus());
  useEffect(() => {
    void refresh();
  }, [s.ocrLanguage]);

  const options = useMemo(
    () =>
      OCR_LANGS.map((l) => ({
        value: l.code,
        label: l.label,
        lang: l.bcp47,
        hint: isBundled(l.code)
          ? t('ocr.pack.bundled')
          : installed?.[l.code]
            ? t('ocr.pack.installed')
            : t('ocr.pack.download', { size: formatBytes(l.size, s.lang) }),
      })),
    [installed, s.lang, t],
  );

  const install = async (code: OcrLangCode): Promise<boolean> => {
    setInstalling({ code, progress: 0 });
    try {
      await installPack(code, (p) => setInstalling({ code, progress: p }));
      await refresh();
      toast(t('ocr.pack.installed_toast', { lang: ocrLangInfo(code)?.label ?? code }), 'success');
      return true;
    } catch (e) {
      const key = e instanceof OcrPackError ? e.key : 'ocr.pack.err_network';
      toast(t(key, { lang: ocrLangInfo(code)?.label ?? code }), 'error');
      return false;
    } finally {
      setInstalling(null);
    }
  };

  const choose = async (code: OcrLangCode) => {
    if (installed && !installed[code] && !(await install(code))) return;
    await updateSettings({ ocrLanguage: composeOcrLanguage(code, code === 'eng' ? false : primary === 'eng' ? true : withEnglish) });
  };

  const missing = installed !== null && !installed[primary];
  const extras = OCR_LANGS.filter((l) => !isBundled(l.code) && installed?.[l.code] && l.code !== primary);
  const info = ocrLangInfo(primary);

  return (
    <>
      <div className="field">
        <span className="label" id="ocr-lang-l">
          {t('set.ocr_lang')}
        </span>
        <Dropdown
          value={primary}
          options={options}
          labelledBy="ocr-lang-l"
          testId="ocr-lang"
          disabled={installing !== null}
          onChange={(v) => void choose(v)}
        />
        {installing && (
          <div className="pack-progress" role="status" aria-live="polite" data-testid="ocr-pack-progress">
            <span className="small">{t('ocr.pack.installing', { lang: ocrLangInfo(installing.code)?.label ?? installing.code })}</span>
            <progress max={1} value={installing.progress} />
          </div>
        )}
        {missing && !installing && info && (
          <div className="notice row wrap" style={{ gap: 8, justifyContent: 'space-between' }} data-testid="ocr-pack-missing">
            <span className="small">{t('ocr.pack.err_missing', { lang: info.label })}</span>
            <button type="button" className="btn sm" onClick={() => void install(primary)}>
              {t('ocr.pack.reinstall')}
            </button>
          </div>
        )}
        {info?.script !== 'latin' && <span className="faint xs">{t(`ocr.script_note.${info?.script ?? 'latin'}`)}</span>}
      </div>
      {primary !== 'eng' && (
        <Toggle
          label={t('ocr.with_english')}
          desc={t('ocr.with_english_d')}
          checked={withEnglish}
          testId="ocr-with-english"
          onChange={(v: boolean) => void updateSettings({ ocrLanguage: composeOcrLanguage(primary, v) })}
        />
      )}
      {extras.length > 0 && (
        <div className="field">
          <span className="label">{t('ocr.pack.downloaded')}</span>
          <ul className="pack-list">
            {extras.map((l) => (
              <li key={l.code} className="row" style={{ justifyContent: 'space-between' }}>
                <span lang={l.bcp47}>
                  {l.label} <span className="faint xs">· {formatBytes(l.size, s.lang)}</span>
                </span>
                <button
                  type="button"
                  className="btn ghost sm"
                  data-testid={`ocr-pack-remove-${l.code}`}
                  onClick={async () => {
                    await removePack(l.code);
                    await refresh();
                  }}
                >
                  {t('ocr.pack.remove')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
