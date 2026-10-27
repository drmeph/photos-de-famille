// Puts the family's settings into the page as it is served, so they apply without a rebuild
// and nothing family-specific has to live in the (public) source code.

import {
  parseConfig,
  resolveLanguage,
  titleFor,
  type AlbumConfig,
  type ConfigVars,
} from '../shared/config';

let warned = false;

export function getConfig(env: ConfigVars): AlbumConfig {
  const { config, warnings } = parseConfig(env);
  if (warnings.length && !warned) {
    warned = true; // once per Worker instance is enough to show up in the logs
    for (const w of warnings) console.warn(`[config] ${w}`);
  }
  return config;
}

/** JSON for an inline <script type="application/json">. Escaping "<" means a value can never close the tag. */
export function configScript(config: AlbumConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<script type="application/json" id="album-config">${json}</script>`;
}

const preferredLanguage = (request: Request) => request.headers.get('Accept-Language')?.split(',')[0];

/** Page requests are fetched unconditionally: a 304 would keep showing the old settings. */
export function isPageRequest(request: Request): boolean {
  return request.method === 'GET' && (request.headers.get('Accept') ?? '').includes('text/html');
}

export function withoutConditionalHeaders(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  return new Request(request, { headers });
}

/** Set the title, theme color and language of index.html and embed the settings for the app. */
export function personalizeHtml(response: Response, config: AlbumConfig, request: Request): Response {
  if (!(response.headers.get('Content-Type') ?? '').includes('text/html')) return response;
  const lang = resolveLanguage(config.language, preferredLanguage(request));
  const rewritten = new HTMLRewriter()
    .on('html', { element: (e) => void e.setAttribute('lang', lang) })
    .on('title', { element: (e) => void e.setInnerContent(titleFor(config, lang)) })
    .on('meta[name="theme-color"]', { element: (e) => void e.setAttribute('content', config.color) })
    .on('head', { element: (e) => void e.append(configScript(config), { html: true }) })
    .transform(response);
  const headers = new Headers(rewritten.headers);
  headers.delete('ETag');
  headers.delete('Content-Length');
  headers.set('Cache-Control', 'private, no-cache');
  return new Response(rewritten.body, { status: rewritten.status, headers });
}

/** The home-screen ("Add to Home Screen") name and colors. */
export function manifestResponse(config: AlbumConfig, request: Request): Response {
  const lang = resolveLanguage(config.language, preferredLanguage(request));
  const title = titleFor(config, lang);
  const manifest = {
    name: title,
    short_name: title.length <= 12 ? title : 'Album', // shown under the home-screen icon
    lang,
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf3',
    theme_color: config.color,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-cache' },
  });
}
