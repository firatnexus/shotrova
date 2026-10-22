import { useT } from '../../i18n';
import { openBatterySettings, openNotificationSettings, openPermissionSettings } from '../../native/bridge';
import { href } from '../router';

/**
 * "Arka plan çalışma ayarları": step-by-step Turkish guidance for keeping
 * automatic capture alive on Xiaomi/HyperOS, with buttons that open the
 * relevant system screens where possible. The limits paragraph is deliberately
 * honest: no promise of reliability after force-stop; the 15-minute floor is
 * a WorkManager constraint, and missed screenshots are caught up on next launch.
 */
export function BackgroundScreen() {
  const t = useT();
  const steps = ['cap.background.s1', 'cap.background.s2', 'cap.background.s3', 'cap.background.s4'];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card stack" aria-labelledby="bg-h" style={{ gap: 10 }}>
        <h1 id="bg-h" style={{ margin: 0, fontSize: '1.4rem' }}>{t('cap.background.title')}</h1>
        <p className="faint" style={{ margin: 0 }}>{t('cap.background.intro')}</p>
        <ol className="steps" style={{ margin: 0 }}>
          {steps.map((k) => (
            <li key={k}>
              <div><p style={{ margin: 0 }}>{t(k)}</p></div>
            </li>
          ))}
        </ol>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={() => void openBatterySettings()}>
            {t('cap.background.open_battery')}
          </button>
          <button type="button" className="btn" onClick={() => void openPermissionSettings()}>
            {t('cap.background.open_perms')}
          </button>
          <button type="button" className="btn" onClick={() => void openNotificationSettings()}>
            {t('cap.background.open_notifs')}
          </button>
          <a className="btn ghost" href={href('/settings')}>{t('nav.settings')}</a>
        </div>
      </section>
      <div className="notice" role="note">
        <span>{t('cap.background.limits')}</span>
      </div>
    </div>
  );
}
