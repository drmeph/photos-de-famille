import { DEFAULT_CONFIG, type AlbumConfig } from '../shared/config';

/** Settings embedded in the page by the server (server/config.ts). Defaults if missing,
 *  e.g. when the built files are opened without the Pages Functions. */
function readConfig(): AlbumConfig {
  try {
    const text = document.getElementById('album-config')?.textContent;
    if (text) return { ...DEFAULT_CONFIG, ...JSON.parse(text) };
  } catch {
    // fall through to defaults
  }
  return DEFAULT_CONFIG;
}

export const config = readConfig();
