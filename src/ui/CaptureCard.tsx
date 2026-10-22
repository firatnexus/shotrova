import { useState } from 'react';
import { useAppState, setState, getState } from '../lib/store';
import { useT } from '../i18n';
import { toast } from '../lib/toast';
import {
  openBatterySettings,
  openPermissionSettings,
  requestCapturePermissions,
  requestNotificationPermission,
  setNativeAutoCapture,
} from '../native/bridge';
import { deriveCaptureUiState, refreshCaptureStatus } from '../auto/capture';
import { updateSettings } from '../lib/actions';
import { href } from './router';

/** Formats bytes like "12,4 MB" in the current locale. */
function fmtBytes(n: number, lang: string): string {
  if (!n) return '0';
  const units = lang === 'tr' ? ['B', 'KB', 'MB', 'GB'] : ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 })} ${units[i]}`;
}

/**
 * Home screen status card: "Otomatik algılama: Açık / Kapalı / İzin eksik /
 * Pil kısıtı var" with a one-tap fix for each problem state. Honest by design —
 * the card shows the native layer's real state, never an assumption.
 */
export function CaptureStatusCard() {
  const t = useT();
  const status = useAppState((s) => s.captureStatus);
  const lang = useAppState((s) => s.settings.lang);
  const [busy, setBusy] = useState(false);
  const ui = deriveCaptureUiState(status);

  if (ui === 'unsupported') return null; // browser build: manual import only

  const fix = async (fn: () => unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refreshCaptureStatus();
    } catch {
      toast(t('common.working'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const stateLabel: Record<string, string> = {
    on: t('cap.status.on'),
    off: t('cap.status.off'),
    no_media: t('cap.status.no_media'),
    partial_media: t('cap.status.partial_media'),
    no_notifications: t('cap.status.no_notifications'),
    battery_restricted: t('cap.status.battery_restricted'),
  };
  const stateClass: Record<string, string> = {
    on: 'ok',
    off: '',
    no_media: 'warn',
    partial_media: 'warn',
    no_notifications: 'warn',
    battery_restricted: 'warn',
  };

  return (
    <section className="card stack" data-testid="capture-status" aria-labelledby="cap-h" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="cap-h" style={{ margin: 0 }}>{t('cap.status.title')}</h2>
        <span className={`badge ${stateClass[ui] ?? ''}`} data-testid="capture-state">{stateLabel[ui]}</span>
      </div>
      <p className="faint" style={{ margin: 0 }}>
        {ui === 'partial_media' ? t('cap.card.body_partial') : ui === 'on' ? t('cap.card.body_on') : t('cap.card.body_off')}
      </p>
      {status && status.pendingCount > 0 && (
        <p className="muted" style={{ margin: 0 }} role="status">
          {t('cap.pending', { n: status.pendingCount })}
        </p>
      )}
      <div className="row wrap" style={{ gap: 8 }}>
        {ui === 'off' && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void fix(() => openSetup())}>
            {t('cap.fix.enable')}
          </button>
        )}
        {ui === 'on' && (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void fix(() => setNativeAutoCapture(false).then(() => updateSettings({ capture: { enabled: false } })))}>
            {t('cap.fix.disable')}
          </button>
        )}
        {(ui === 'no_media' || ui === 'partial_media') && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void fix(() => requestCapturePermissions())}>
            {ui === 'partial_media' ? t('cap.fix.grant_full') : t('cap.fix.grant_media')}
          </button>
        )}
        {ui === 'partial_media' && (
          <button type="button" className="btn" disabled={busy} onClick={() => void fix(() => openPermissionSettings())}>
            {t('cap.background.open_perms')}
          </button>
        )}
        {ui === 'no_notifications' && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void fix(() => requestNotificationPermission())}>
            {t('cap.fix.grant_notifications')}
          </button>
        )}
        {ui === 'battery_restricted' && (
          <button type="button" className="btn" disabled={busy} onClick={() => void fix(() => openBatterySettings())}>
            {t('cap.fix.battery')}
          </button>
        )}
        <a className="btn ghost" href={href('/background')}>{t('cap.background.title')}</a>
      </div>
      {status && status.lastScanAt > 0 && (
        <span className="faint xs">
          {t('cap.last_scan', { time: new Date(status.lastScanAt).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })}
          {status.stagedBytes > 0 ? ` · ${t('cap.staged_bytes', { size: fmtBytes(status.stagedBytes, lang) })}` : ''}
        </span>
      )}
    </section>
  );
}

/** Opens the first-run consent/setup sheet (also reachable from settings). */
export function openSetup(): void {
  setState({ captureSetupOpen: true });
}

/**
 * First-run consent screen for automatic capture. Explains each permission in
 * Turkish BEFORE asking, and what exactly the AI receives. Opt-in only:
 * nothing runs in the background until the user finishes this sheet.
 */
export function CaptureSetupSheet() {
  const t = useT();
  const open = useAppState((s) => s.captureSetupOpen);
  const aiEnabled = useAppState((s) => s.settings.ai.enabled);
  const aiVision = useAppState((s) => s.settings.ai.vision);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'off' | 'text' | 'vision'>(aiEnabled ? (aiVision ? 'vision' : 'text') : 'off');

  if (!open) return null;

  const close = () => setState({ captureSetupOpen: false });

  const start = async (withAi: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      // Explain -> ask: permissions only now that the user pressed start.
      await requestCapturePermissions();
      // AI consent: enable analysis + the chosen send mode.
      const cur = getState().settings;
      await updateSettings({
        capture: { ...cur.capture, enabled: true, aiConsent: withAi, autoAnalyze: withAi },
        ...(withAi ? { ai: { ...cur.ai, enabled: true, vision: mode === 'vision' } } : {}),
      });
      await setNativeAutoCapture(true, getState().settings.capture?.storageMode);
      await refreshCaptureStatus();
      close();
      toast(t('cap.status.on'), 'success');
    } catch {
      toast(t('common.working'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="capsetup-h" style={{ alignItems: 'center' }}>
      <div className="card stack" style={{ width: 'min(92vw, 560px)', maxHeight: '88vh', overflow: 'auto', gap: 12 }} data-testid="capture-setup">
        <h2 id="capsetup-h" style={{ margin: 0 }}>{t('cap.setup.title')}</h2>
        <p className="faint" style={{ margin: 0 }}>{t('cap.setup.intro')}</p>

        <div className="stack" style={{ gap: 6 }}>
          <strong>{t('cap.setup.perm_media_title')}</strong>
          <span className="faint">{t('cap.setup.perm_media_body')}</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>{t('cap.setup.perm_notif_title')}</strong>
          <span className="faint">{t('cap.setup.perm_notif_body')}</span>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <strong>{t('cap.setup.ai_title')}</strong>
          <span className="faint">{t('cap.setup.ai_body')}</span>
          {(['off', 'text', 'vision'] as const).map((m) => (
            <label key={m} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <input type="radio" name="cap-ai-mode" checked={mode === m} onChange={() => setMode(m)} />
              <span>{t(`cap.setup.ai_option_${m}`)}</span>
            </label>
          ))}
          <span className="faint xs">{t('cap.setup.ai_privacy')}</span>
        </div>

        <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={close} disabled={busy}>{t('cap.setup.later')}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void start(false)}>{t('cap.setup.start_noai')}</button>
          <button type="button" className="btn primary" disabled={busy || mode === 'off'} onClick={() => void start(true)}>{t('cap.setup.start')}</button>
        </div>
      </div>
    </div>
  );
}
