import { useMemo } from 'react';
import type { OcrLangCode } from '../db/types';
import { useAppState } from '../lib/store';
import { updateSettings } from '../lib/actions';
import { useT } from '../i18n';
import { OCR_LANGS, composeOcrLanguage, ocrLangInfo, parseOcrLanguage } from '../ocr/packs';
import { Dropdown } from './Dropdown';
import { Toggle } from './components';

/**
 * OCR language picker: custom dropdown with the twelve built-in languages and
 * an "also recognise English" switch. Every language is part of the app, so a
 * choice applies immediately and works offline.
 */
export function OcrLanguageField() {
  const t = useT();
  const s = useAppState((st) => st.settings);
  const { primary, withEnglish } = parseOcrLanguage(s.ocrLanguage);

  const options = useMemo(
    () => OCR_LANGS.map((l) => ({ value: l.code, label: l.label, lang: l.bcp47, hint: t('ocr.pack.bundled') })),
    [t],
  );

  const choose = async (code: OcrLangCode) => {
    await updateSettings({ ocrLanguage: composeOcrLanguage(code, code === 'eng' ? false : primary === 'eng' ? true : withEnglish) });
  };

  const info = ocrLangInfo(primary);

  return (
    <>
      <div className="field">
        <span className="label" id="ocr-lang-l">
          {t('set.ocr_lang')}
        </span>
        <Dropdown value={primary} options={options} labelledBy="ocr-lang-l" testId="ocr-lang" onChange={(v) => void choose(v)} />
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
    </>
  );
}
