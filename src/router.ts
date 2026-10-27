import { useEffect, useState } from 'preact/hooks';

// Hash-based routes work on any static host and keep the browser Back button useful:
//   #/            timeline
//   #/photo/<id>  one photo (shown over the timeline, so the scroll position is kept)
//   #/upload      upload progress
export type Route = { name: 'timeline' } | { name: 'photo'; id: string } | { name: 'upload' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const photo = /^\/photo\/([a-f0-9]+)$/.exec(path);
  if (photo) return { name: 'photo', id: photo[1] };
  if (path === '/upload') return { name: 'upload' };
  return { name: 'timeline' };
}

export const href = {
  timeline: () => '#/',
  photo: (id: string) => `#/photo/${id}`,
  upload: () => '#/upload',
};

/** In-app navigation. Entries we push are marked so goBack() knows Back stays inside the app. */
export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(history.state, '', to);
  else history.pushState({ fromApp: true }, '', to);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** onClick for <a href="#/..."> links, so they go through navigate(). */
export function linkClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.currentTarget as HTMLAnchorElement;
  e.preventDefault();
  navigate(a.getAttribute('href')!);
}

/** Go back if the previous page is ours (keeps history tidy), else go to the timeline. */
export function goBack() {
  if (history.state?.fromApp) history.back();
  else navigate(href.timeline(), true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return route;
}
