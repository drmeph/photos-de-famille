import { useState } from 'preact/hooks';
import { NAME_MAX } from '../../shared/types';
import { setMyName } from '../data';
import { albumTitle, t } from '../i18n';
import { Icon } from './Icon';

/**
 * Shown the first time someone signs in: asks for the first name shown on the photos they add
 * and with their comments. "Later" hides it until the next visit.
 */
export function WelcomeName({ onLater }: { onLater: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await setMyName(name.trim()); // once saved, the app stops showing this window
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div class="modal-layer">
      <div class="backdrop" />
      <div class="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <form class="welcome-form" onSubmit={submit}>
          <div class="modal-body welcome-body">
            <span class="brand-mark welcome-mark" aria-hidden="true">
              <Icon name="image" size={28} />
            </span>
            <p class="muted">{albumTitle}</p>
            <h1 id="welcome-title">{t.welcomeTitle}</h1>
            <p>{t.welcomeText}</p>
            <label class="field">
              <span class="field-label">{t.yourName}</span>
              <input
                class="input"
                type="text"
                value={name}
                maxLength={NAME_MAX}
                autoComplete="given-name"
                autoCapitalize="words"
                autoFocus
                required
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </label>
            {failed && <p class="error">{t.errorGeneric}</p>}
          </div>
          <footer class="modal-footer">
            <button type="submit" class="btn btn-primary btn-block" disabled={busy || !name.trim()}>
              {t.continue}
            </button>
            <button type="button" class="btn btn-ghost btn-block" onClick={onLater}>
              {t.later}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
