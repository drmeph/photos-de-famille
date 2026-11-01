// Noticing new releases. Phones often resume the album from memory instead of reloading it
// (especially when added to the home screen, where there's no address bar or pull-to-refresh),
// so an open page could keep running an old version for days. Each build has an id
// (__APP_VERSION__, see vite.config.ts) and publishes it in /version.json; we compare the two.

import { createStore } from './store';

/** True once a newer version is known to be deployed: the app then offers a refresh. */
export const updateAvailable = createStore(false);

const CHECK_EVERY_MS = 15 * 60 * 1000;

async function newVersionIsOut(): Promise<boolean> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const { version } = (await res.json()) as { version?: unknown };
    return typeof version === 'string' && version !== __APP_VERSION__;
  } catch {
    return false; // offline, or signed out: try again later
  }
}

/**
 * Check when the album comes back on screen and every 15 minutes while it's open.
 * Coming back with nothing in progress: reload right away (nobody has to do anything).
 * Otherwise (`isBusy`: an upload, a comment being typed…): show the refresh banner instead.
 */
export function watchForUpdates(isBusy: () => boolean) {
  const check = async (comingBack: boolean) => {
    if (updateAvailable.get() || !(await newVersionIsOut())) return;
    if (comingBack && !isBusy()) location.reload();
    else updateAvailable.set(true);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check(true);
  });
  // Safari restores pages from its back/forward cache without a visibility change.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) void check(true);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void check(false);
  }, CHECK_EVERY_MS);
  // After a release, an old page can't load the code it fetches on demand (HEIC converter,
  // EXIF reader): the files of the previous version are gone. Offer the refresh.
  window.addEventListener('vite:preloadError', () => updateAvailable.set(true));
}
