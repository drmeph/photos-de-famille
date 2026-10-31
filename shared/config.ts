// Per-family settings. Each deployment sets them as environment variables
// (see docs/CONFIGURATION.md); anything missing or invalid falls back to the default.

export const LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguageSetting = Language | 'auto';

export interface AlbumConfig {
  /** Header, browser tab and home-screen name. null: "Album de famille" / "Family album". */
  title: string | null;
  /** 'auto' follows each visitor's browser (French if it asks for French, else English). */
  language: LanguageSetting;
  /** Accent color "#rrggbb", darkened if needed so it reads as text on white. */
  color: string;
  /** Optional short message shown at the top of the timeline. '' = none. */
  welcome: string;
}

export const DEFAULT_CONFIG: AlbumConfig = {
  title: null,
  language: 'auto',
  color: '#7a4b2a',
  welcome: '',
};

export const DEFAULT_TITLES: Record<Language, string> = {
  fr: 'Album de famille',
  en: 'Family album',
};

/** The environment variables that hold the settings. */
export interface ConfigVars {
  ALBUM_TITLE?: string;
  ALBUM_LANGUAGE?: string;
  ALBUM_COLOR?: string;
  ALBUM_WELCOME?: string;
}

const TITLE_MAX = 60;
const WELCOME_MAX = 500;
/** WCAG AA for normal text: the color is used for button labels on white. */
const MIN_CONTRAST = 4.5;

export function parseConfig(vars: ConfigVars): { config: AlbumConfig; warnings: string[] } {
  const config = { ...DEFAULT_CONFIG };
  const warnings: string[] = [];

  const title = vars.ALBUM_TITLE?.trim().replace(/\s+/g, ' ');
  if (title) {
    if (title.length <= TITLE_MAX) config.title = title;
    else warnings.push(`ALBUM_TITLE is longer than ${TITLE_MAX} characters; using the default title`);
  }

  const language = vars.ALBUM_LANGUAGE?.trim().toLowerCase();
  if (language) {
    if (language === 'auto' || (LANGUAGES as readonly string[]).includes(language)) {
      config.language = language as LanguageSetting;
    } else {
      warnings.push(`ALBUM_LANGUAGE must be one of auto, ${LANGUAGES.join(', ')}; using auto`);
    }
  }

  const color = vars.ALBUM_COLOR?.trim().replace(/^(["'])(.*)\1$/, '$2').trim(); // tolerate "#2e8b57"
  if (color) {
    const hex = normalizeHex(color);
    if (!hex) warnings.push('ALBUM_COLOR must look like #7a4b2a; using the default color');
    else {
      config.color = readableOnWhite(hex);
      if (config.color !== hex) {
        warnings.push(`ALBUM_COLOR ${hex} is too light to read on white; using the darker ${config.color}`);
      }
    }
  }

  const welcome = vars.ALBUM_WELCOME?.trim();
  if (welcome) {
    if (welcome.length <= WELCOME_MAX) config.welcome = welcome;
    else warnings.push(`ALBUM_WELCOME is longer than ${WELCOME_MAX} characters; not shown`);
  }

  return { config, warnings };
}

/** Pick the language for one visitor from the setting and their browser's preference. */
export function resolveLanguage(setting: LanguageSetting, preferred: string | null | undefined): Language {
  if (setting !== 'auto') return setting;
  const primary = (preferred ?? '').trim().toLowerCase().slice(0, 2);
  return (LANGUAGES as readonly string[]).includes(primary) ? (primary as Language) : 'en';
}

export const titleFor = (config: AlbumConfig, lang: Language) => config.title ?? DEFAULT_TITLES[lang];

/** "#abc" or "#aabbcc" -> "#aabbcc"; anything else -> null. */
function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

/** The same color, darkened step by step until white text on it is readable (WCAG AA). */
export function readableOnWhite(hex: string): string {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let keep = 1; keep > 0; keep -= 0.04) {
    const candidate = '#' + rgb.map((c) => Math.round(c * keep).toString(16).padStart(2, '0')).join('');
    if (contrastWithWhite(candidate) >= MIN_CONTRAST) return candidate;
  }
  return '#000000';
}

/** WCAG contrast ratio between a "#rrggbb" color and white. */
export function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}
