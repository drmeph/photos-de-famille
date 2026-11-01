import { t } from '../i18n';
import { useStore } from '../lib/store';
import { updateAvailable } from '../lib/version';
import { Icon } from './Icon';

/** "A new version is available — Refresh", when it couldn't reload by itself. */
export function UpdateBanner() {
  const show = useStore(updateAvailable);
  if (!show) return null;
  return (
    <div class="update-banner" role="status">
      <Icon name="retry" />
      <p>{t.updateAvailable}</p>
      <button type="button" class="btn btn-primary btn-small" onClick={() => location.reload()}>
        {t.refresh}
      </button>
      <button type="button" class="btn btn-icon btn-ghost btn-small" aria-label={t.later} onClick={() => updateAvailable.set(false)}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
