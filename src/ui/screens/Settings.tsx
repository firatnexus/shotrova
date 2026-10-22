import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../lib/store';
import { deleteAllData, deleteRules, recategorizeAll, reloadAll, updateSettings } from '../../lib/actions';
import { exportJson, exportZip, restoreBackup, RestoreError } from '../../backup/backup';
import { decodeAndThumb } from '../../import/image';
import { ocrAssetUrls } from '../../ocr/engine';
import { BRAND } from '../../config/brand';
import { LANGS, categoryName, formatBytes, formatDate, useT } from '../../i18n';
import { toast } from '../../lib/toast';
import { useRoute } from '../router';
import { Sheet, confirmDialog } from '../components';
import { saveBlob } from '../blobs';
import { isNativeApp } from '../../native/bridge';
import { IconAlert, IconDownload, IconInfo, IconShield, IconTrash, IconUpload } from '../icons';
import type { Lang, OcrLanguage, ThemePref } from '../../db/types';

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="section stack" id={id} aria-labelledby={`${id ?? title}-h`} style={{ gap: 10, marginTop: 28 }}>
      <h2 id={`${id ?? title}-h`}>{title}</h2>
      <div className="card stack" style={{ gap: 12 }}>{children}</div>
    </section>
  );
}

function Toggle({ label, desc, checked, onChange, testId }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="toggle">
      <span>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {desc && <span className="faint" style={{ display: 'block' }}>{desc}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  );
}

export function SettingsScreen() {
  const t = useT();
  const native = isNativeApp();
  const route = useRoute();
  const s = useAppState((x) => x.settings);
  const images = useAppState((x) => x.images);
  const rules = useAppState((x) => x.rules);
  const categories = useAppState((x) => x.categories);
  const [est, setEst] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);
  const [ocrCached, setOcrCached] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState(s.ai);

  const refreshStorage = async () => {
    try {
      const e = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setEst({ ...(e?.usage !== undefined ? { usage: e.usage } : {}), ...(e?.quota !== undefined ? { quota: e.quota } : {}), ...(persisted !== undefined ? { persisted } : {}) });
    } catch {
      setEst({});
    }
  };
  const refreshOcrCache = async () => {
    if (typeof caches === 'undefined') return setOcrCached(null);
    try {
      const c = await caches.open(`${BRAND.storagePrefix}-ocr-v1`);
      const urls = ocrAssetUrls(s.ocrLanguage);
      let n = 0;
      for (const u of urls) if (await c.match(u)) n++;
      setOcrCached(n === urls.length ? 1 : n / urls.length);
    } catch {
      setOcrCached(null);
    }
  };
  useEffect(() => {
    void refreshStorage();
    void refreshOcrCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, s.ocrLanguage]);
  useEffect(() => {
    const target = route.query.get('s');
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }), 50);
  }, [route.query]);

  const prepareOcr = async () => {
    setPreparing(true);
    try {
      const urls = ocrAssetUrls(s.ocrLanguage);
      const c = typeof caches !== 'undefined' ? await caches.open(`${BRAND.storagePrefix}-ocr-v1`) : null;
      for (const u of urls) {
        const res = await fetch(u, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${res.status} ${u}`);
        if (c) await c.put(u, res.clone());
        await res.arrayBuffer();
      }
      await refreshOcrCache();
      toast(t('set.ocr_prepared'), 'success');
    } catch (e) {
      toast(`${t('set.ocr_prepare_failed')} (${(e as Error).message})`, 'error');
    } finally {
      setPreparing(false);
    }
  };

  const doExport = async (kind: 'zip' | 'json') => {
    setBusy(kind);
    try {
      const r = kind === 'zip' ? await exportZip() : await exportJson();
      if (!(await saveBlob(r.blob, r.fileName))) return;
      await updateSettings({ lastBackupAt: Date.now() });
      toast(t('set.exported', { n: r.imageCount }), 'success');
    } catch (e) {
      toast(`${t('set.export_failed')} (${(e as Error).message})`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async (mode: 'merge' | 'replace') => {
    if (!restoreFile) return;
    if (mode === 'replace' && !(await confirmDialog({ title: t('set.replace_title'), body: t('set.replace_body'), confirmLabel: t('set.replace'), danger: true }))) return;
    const f = restoreFile;
    setRestoreFile(null);
    setBusy('restore');
    try {
      const r = await restoreBackup(f, mode, decodeAndThumb);
      await reloadAll();
      toast(t('set.restored', { n: r.imported, d: r.duplicates, m: r.metadataOnly, bad: r.invalid + r.integrityFailures }), r.invalid + r.integrityFailures ? 'warning' : 'success', undefined, 9000);
    } catch (e) {
      const code = e instanceof RestoreError ? e.code : 'unknown';
      toast(`${t(`restore.err.${code}`)}${code === 'unknown' ? ` (${(e as Error).message})` : ''}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const recat = async () => {
    setBusy('recat');
    try {
      const n = await recategorizeAll();
      toast(t('set.recat_done', { n }), 'success');
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    const ok = await confirmDialog({ title: t('set.wipe_title'), body: t('set.wipe_body', { n: images.length }), confirmLabel: t('set.wipe'), danger: true });
    if (!ok) return;
    try {
      await deleteAllData();
      toast(t('set.wiped'), 'success');
    } catch (e) {
      toast(`${t('storage.write_failed')} (${(e as Error).message})`, 'error');
    }
  };

  const usagePct = est?.usage !== undefined && est.quota ? Math.min(100, (est.usage / est.quota) * 100) : null;

  return (
    <div className="stack" style={{ gap: 0 }}>
      <h1>{t('nav.settings')}</h1>

      <Section id="appearance" title={t('set.appearance')}>
        <div className="field">
          <span className="label" id="theme-l">{t('set.theme')}</span>
          <div className="segmented" role="group" aria-labelledby="theme-l">
            {(['system', 'light', 'dark'] as ThemePref[]).map((v) => (
              <button key={v} type="button" aria-pressed={s.theme === v} onClick={() => void updateSettings({ theme: v })} data-testid={`theme-${v}`}>
                {t(`set.theme_${v}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label" id="lang-l">{t('set.language')}</span>
          <div className="segmented" role="group" aria-labelledby="lang-l">
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={s.lang === l.code} lang={l.code} onClick={() => void updateSettings({ lang: l.code as Lang })} data-testid={`lang-${l.code}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section id="ocr" title={t('set.ocr')}>
        <Toggle label={t('set.ocr_enabled')} desc={t('set.ocr_enabled_d')} checked={s.ocrEnabled} onChange={(v) => void updateSettings({ ocrEnabled: v })} />
        <div className="field">
          <label htmlFor="ocr-lang">{t('set.ocr_lang')}</label>
          <select id="ocr-lang" className="input" value={s.ocrLanguage} onChange={(e) => void updateSettings({ ocrLanguage: e.target.value as OcrLanguage })}>
            <option value="tur+eng">{t('set.ocr_both')}</option>
            <option value="tur">{t('set.ocr_tur')}</option>
            <option value="eng">{t('set.ocr_eng')}</option>
          </select>
        </div>
        {native ? (
          <p className="small">{t('set.ocr_bundled')}</p>
        ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small">
            {ocrCached === 1 ? t('set.ocr_ready_offline') : ocrCached === null ? t('set.ocr_cache_unknown') : t('set.ocr_not_cached')}
          </span>
          <button type="button" className="btn sm" onClick={() => void prepareOcr()} disabled={preparing}>
            <IconDownload /> {preparing ? t('set.ocr_preparing') : t('set.ocr_prepare')}
          </button>
        </div>
        )}
        <p className="faint xs">{t('set.ocr_note')}</p>
      </Section>

      <Section id="categorize" title={t('set.categorize')}>
        <Toggle label={t('set.auto')} desc={t('set.auto_d')} checked={s.autoCategorize} onChange={(v) => void updateSettings({ autoCategorize: v })} />
        <Toggle label={t('set.learn')} desc={t('set.learn_d')} checked={s.learnFromCorrections} onChange={(v) => void updateSettings({ learnFromCorrections: v })} />
        <div className="field">
          <label htmlFor="thr">{t('set.threshold', { n: Math.round(s.reviewThreshold * 100) })}</label>
          <input id="thr" type="range" min={0.2} max={0.9} step={0.05} value={s.reviewThreshold} onChange={(e) => void updateSettings({ reviewThreshold: Number(e.target.value) })} style={{ accentColor: 'var(--accent)', minHeight: 32 }} />
          <span className="faint xs">{t('set.threshold_d')}</span>
        </div>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => void recat()} disabled={busy === 'recat' || !images.length}>
          {t('set.recat')}
        </button>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', fontWeight: 500 }}>{t('set.rules', { n: rules.length })}</summary>
          {rules.length === 0 ? (
            <p className="faint small">{t('set.rules_empty')}</p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="rules-list">
                {rules
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((r) => (
                    <li key={r.id} className="item" style={{ minHeight: 48, padding: '6px 12px' }}>
                      <span className="grow small">
                        <code>{r.token}</code> → {categoryName(categories.find((c) => c.id === r.categoryId), s.lang)} <span className="faint xs">×{r.weight.toFixed(1)}</span>
                      </span>
                      <button type="button" className="btn ghost icon" aria-label={t('set.rule_delete', { token: r.token })} onClick={() => void deleteRules([r.id])}>
                        <IconTrash />
                      </button>
                    </li>
                  ))}
              </ul>
              <button type="button" className="btn sm danger" style={{ alignSelf: 'flex-start' }} onClick={async () => (await confirmDialog({ title: t('set.rules_clear'), confirmLabel: t('common.delete'), danger: true })) && void deleteRules(rules.map((r) => r.id))}>
                {t('set.rules_clear')}
              </button>
            </div>
          )}
        </details>
      </Section>

      <Section id="ai" title={t('set.ai')}>
        <div className="notice warn">
          <IconAlert />
          <span>{t('set.ai_warn')}</span>
        </div>
        <Toggle
          label={t('set.ai_enable')}
          checked={s.ai.enabled && s.categorizer === 'ai'}
          onChange={(v) => {
            if (v && !ai.apiKey) return toast(t('set.ai_need_key'), 'warning');
            setAi({ ...ai, enabled: v });
            void updateSettings({ categorizer: v ? 'ai' : 'keywords', ai: { ...ai, enabled: v } });
          }}
        />
        <div className="field">
          <label htmlFor="ai-url">{t('set.ai_url')}</label>
          <input id="ai-url" className="input" inputMode="url" value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ai-model">{t('set.ai_model')}</label>
          <input id="ai-model" className="input" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ai-key">{t('set.ai_key')}</label>
          <input id="ai-key" className="input" type="password" autoComplete="off" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} placeholder="sk-…" />
          <span className="faint xs">{t('set.ai_key_d')}</span>
        </div>
        <Toggle
          label={t('set.ai_vision')}
          desc={t('set.ai_vision_d')}
          checked={ai.vision}
          onChange={(v) => {
            setAi({ ...ai, vision: v });
            void updateSettings({ ai: { ...ai, vision: v } });
            if (v) toast(t('set.ai_vision_warn'), 'warning', undefined, 7000);
          }}
          testId="ai-vision"
        />
        <div className="row">
          <button type="button" className="btn" onClick={() => void updateSettings({ ai: { ...ai, enabled: s.ai.enabled && Boolean(ai.apiKey) } }).then(() => toast(t('detail.saved'), 'success'))}>
            {t('common.save')}
          </button>
          {s.ai.apiKey && (
            <button type="button" className="btn danger" onClick={() => { setAi({ ...ai, apiKey: '', enabled: false }); void updateSettings({ categorizer: 'keywords', ai: { ...ai, apiKey: '', enabled: false } }); }}>
              {t('set.ai_forget')}
            </button>
          )}
        </div>
      </Section>

      <Section id="storage" title={t('set.storage')}>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{t('set.usage', { n: images.length })}</span>
            <span className="faint small" data-testid="storage-usage">
              {est?.usage !== undefined ? `${formatBytes(est.usage, s.lang)}${est.quota ? ` / ${formatBytes(est.quota, s.lang)}` : ''}` : t('set.usage_unknown')}
            </span>
          </div>
          {usagePct !== null && (
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usagePct)} aria-label={t('set.storage')}>
              <div style={{ width: `${Math.max(1, usagePct)}%` }} />
            </div>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small">{est?.persisted ? t('set.persisted') : t('set.not_persisted')}</span>
          {!native && !est?.persisted && navigator.storage?.persist && (
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                const ok = await navigator.storage.persist();
                toast(ok ? t('set.persist_ok') : t('set.persist_denied'), ok ? 'success' : 'warning');
                void refreshStorage();
              }}
            >
              {t('set.persist')}
            </button>
          )}
        </div>
        <p className="faint xs">{native ? t('set.storage_note_app') : t('set.storage_note')}</p>
      </Section>

      <Section id="backup" title={t('set.backup')}>
        <p className="small">{s.lastBackupAt ? t('set.last_backup', { date: formatDate(s.lastBackupAt, s.lang, true) }) : t('set.never_backed_up')}</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => void doExport('zip')} disabled={!!busy} data-testid="export-zip">
            <IconDownload /> {busy === 'zip' ? t('common.working') : t('set.export_zip')}
          </button>
          <button type="button" className="btn" onClick={() => void doExport('json')} disabled={!!busy} data-testid="export-json">
            <IconDownload /> {busy === 'json' ? t('common.working') : t('set.export_json')}
          </button>
          <button type="button" className="btn" onClick={() => restoreRef.current?.click()} disabled={!!busy} data-testid="restore">
            <IconUpload /> {busy === 'restore' ? t('common.working') : t('set.restore')}
          </button>
        </div>
        <p className="faint xs">{t('set.backup_note')}</p>
        <input
          ref={restoreRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="restore-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setRestoreFile(f);
          }}
        />
      </Section>

      <Section id="privacy" title={t('set.privacy')}>
        <div className="notice">
          <IconShield />
          <span>{t('set.privacy_body')}</span>
        </div>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>{t('set.privacy_1')}</li>
          <li>{t('set.privacy_2')}</li>
          <li>{t('set.privacy_3')}</li>
          <li>{t('set.privacy_4')}</li>
        </ul>
      </Section>

      <Section id="install" title={t('set.install')}>
        {native ? (
          <p className="small">{t('set.install_app')}</p>
        ) : (
        <>
        <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>{t('set.install_1')}</li>
          <li>{t('set.install_2')}</li>
          <li>{t('set.install_3')}</li>
          <li>{t('set.install_4')}</li>
        </ol>
        <p className="faint xs">{t('set.install_note')}</p>
        <p className="faint xs">
          {t('set.install_apk')}{' '}
          <a href={`${BRAND.repoUrl}/releases/latest`} target="_blank" rel="noopener noreferrer">
            {t('set.install_apk_link')}
          </a>
        </p>
        </>
        )}
      </Section>

      <Section id="about" title={t('set.about')}>
        <div className="notice">
          <IconInfo />
          <span>
            {BRAND.name} {BRAND.version} — {BRAND.description[s.lang]}
          </span>
        </div>
        <p className="small">
          {t('set.about_tech')} <a href={BRAND.repoUrl} target="_blank" rel="noreferrer">{t('set.source')}</a>
        </p>
        <p className="faint xs">{t('set.licenses')}</p>
      </Section>

      <Section id="danger" title={t('set.danger')}>
        <button type="button" className="btn danger" style={{ alignSelf: 'flex-start' }} onClick={() => void wipe()} data-testid="wipe">
          <IconTrash /> {t('set.wipe')}
        </button>
      </Section>

      {restoreFile && (
        <Sheet
          title={t('set.restore_title')}
          onClose={() => setRestoreFile(null)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setRestoreFile(null)}>{t('common.cancel')}</button>
              <button type="button" className="btn danger" onClick={() => void doRestore('replace')} data-testid="restore-replace">{t('set.replace')}</button>
              <button type="button" className="btn primary" onClick={() => void doRestore('merge')} data-testid="restore-merge">{t('set.merge')}</button>
            </>
          }
        >
          <p className="small">{t('set.restore_body', { name: restoreFile.name, size: formatBytes(restoreFile.size, s.lang) })}</p>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>{t('set.merge_d')}</li>
            <li>{t('set.replace_d')}</li>
          </ul>
        </Sheet>
      )}
    </div>
  );
}
