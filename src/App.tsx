import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from './components/Icon';
import { loadMe, loadPeople, loadTimeline, people as peopleStore, timeline as timelineStore } from './data';
import { albumTitle, t } from './i18n';
import { applyFilters, NO_FILTERS, type Filters } from './lib/filter';
import { useStore } from './lib/store';
import { useRoute } from './router';
import { PhotoView } from './views/PhotoView';
import { Timeline } from './views/Timeline';
import { UploadView } from './views/UploadView';

const FILTERS_KEY = 'album.filters';

function loadFilters(): Filters {
  try {
    return { ...NO_FILTERS, ...JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? '{}') };
  } catch {
    return NO_FILTERS;
  }
}

export function App() {
  const route = useRoute();
  const timeline = useStore(timelineStore);
  const people = useStore(peopleStore);
  const [filters, setFilters] = useState(loadFilters);

  useEffect(() => {
    void loadTimeline();
    void loadPeople();
    void loadMe();
    // Pick up what others added while this tab sat in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadTimeline();
        void loadPeople();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      // private mode etc.: filters just won't survive a reload
    }
  }, [filters]);

  const all = timeline.status === 'ready' ? timeline.data : [];
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);

  if (timeline.status === 'loading') return <Skeleton />;
  if (timeline.status === 'error') {
    return (
      <div class="center-message">
        <Icon name="alert" size={40} />
        <p>{t.errorGeneric}</p>
        <button type="button" class="btn btn-primary btn-big" onClick={() => location.reload()}>
          <Icon name="retry" />
          <span>{t.retry}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* The timeline stays mounted under the overlays so its scroll position is kept. */}
      <Timeline all={all} visible={visible} people={people} filters={filters} onFilters={setFilters} />
      {route.name === 'photo' && <PhotoView id={route.id} list={visible} people={people} />}
      {route.name === 'upload' && <UploadView />}
    </>
  );
}

/** Shown while the album loads: the page's shape, gently shimmering. */
function Skeleton() {
  const widths = [1.5, 0.75, 1.33, 1, 1.78, 0.75, 1.33, 1.5, 1];
  return (
    <div class="app" aria-busy="true" aria-label={t.loading}>
      <header class="appbar">
        <div class="appbar-row">
          <span class="brand">
            <span class="brand-title">{albumTitle}</span>
          </span>
        </div>
      </header>
      <main class="content skeleton">
        <span class="skeleton-title" />
        <div class="grid">
          {widths.map((r, i) => (
            <span key={i} class="tile" style={{ '--r': r }} />
          ))}
        </div>
      </main>
    </div>
  );
}
