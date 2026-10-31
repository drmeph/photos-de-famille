import { describe, expect, it } from 'vitest';
import { configScript, manifestResponse } from '../server/config';
import { DEFAULT_CONFIG, contrastWithWhite, parseConfig, resolveLanguage, titleFor } from '../shared/config';

describe('parseConfig', () => {
  it('uses the defaults when nothing is set', () => {
    expect(parseConfig({})).toEqual({ config: DEFAULT_CONFIG, warnings: [] });
  });

  it('reads and tidies every setting', () => {
    const { config, warnings } = parseConfig({
      ALBUM_TITLE: '  Album   de la famille Martin ',
      ALBUM_LANGUAGE: 'FR',
      ALBUM_COLOR: '#253',
      ALBUM_WELCOME: 'Bienvenue !\nAjoutez vos souvenirs.',
    });
    expect(warnings).toEqual([]);
    expect(config).toEqual({
      title: 'Album de la famille Martin',
      language: 'fr',
      color: '#225533',
      welcome: 'Bienvenue !\nAjoutez vos souvenirs.',
    });
  });

  it('falls back to the default and warns on invalid values', () => {
    const { config, warnings } = parseConfig({
      ALBUM_TITLE: 'x'.repeat(61),
      ALBUM_LANGUAGE: 'klingon',
      ALBUM_COLOR: 'brown',
      ALBUM_WELCOME: 'x'.repeat(501),
    });
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnings).toHaveLength(4);
  });

  it('darkens colors too pale to read on white, keeping their hue', () => {
    const { config, warnings } = parseConfig({ ALBUM_COLOR: '#2e8b57' }); // sea green: contrast 4.1
    expect(config.color).not.toBe('#2e8b57');
    expect(contrastWithWhite(config.color)).toBeGreaterThanOrEqual(4.5);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(config.color.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r); // still green
    expect(g).toBeGreaterThan(b);
    expect(warnings[0]).toContain('too light');
    expect(contrastWithWhite(parseConfig({ ALBUM_COLOR: '#ffd700' }).config.color)).toBeGreaterThanOrEqual(4.5); // gold
    expect(contrastWithWhite('#000000')).toBeCloseTo(21);
    expect(contrastWithWhite(DEFAULT_CONFIG.color)).toBeGreaterThan(4.5);
  });

  it('ignores quotes around the color', () => {
    expect(parseConfig({ ALBUM_COLOR: '"#1f4e79"' }).config.color).toBe('#1f4e79');
    expect(parseConfig({ ALBUM_COLOR: " '#1f4e79' " }).config.color).toBe('#1f4e79');
  });

  it('treats empty values as unset', () => {
    expect(parseConfig({ ALBUM_TITLE: '  ', ALBUM_COLOR: '' }).config).toEqual(DEFAULT_CONFIG);
  });
});

describe('language and title', () => {
  it('follows the browser in auto mode, defaulting to English', () => {
    expect(resolveLanguage('auto', 'fr-CA')).toBe('fr');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'de-DE')).toBe('en');
    expect(resolveLanguage('auto', undefined)).toBe('en');
    expect(resolveLanguage('fr', 'en-US')).toBe('fr');
  });

  it('uses the family title or a default in the visitor language', () => {
    expect(titleFor(DEFAULT_CONFIG, 'fr')).toBe('Album de famille');
    expect(titleFor({ ...DEFAULT_CONFIG, title: 'Les Martin' }, 'en')).toBe('Les Martin');
  });
});

describe('embedding in the page', () => {
  it('cannot be used to break out of the script tag', () => {
    const html = configScript({ ...DEFAULT_CONFIG, welcome: '</script><script>alert(1)</script>' });
    expect(html.match(/<\/script>/g)).toHaveLength(1); // only the real closing tag
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(json).welcome).toBe('</script><script>alert(1)</script>');
  });

  it('builds a home-screen manifest with the family name and color', async () => {
    const config = { ...DEFAULT_CONFIG, title: 'Famille Martin', color: '#1f4e79' };
    const res = manifestResponse(config, new Request('https://album.test/manifest.webmanifest'));
    const manifest = (await res.json()) as Record<string, unknown>;
    expect(manifest).toMatchObject({ name: 'Famille Martin', short_name: 'Album', theme_color: '#1f4e79', lang: 'en' });
  });
});
