import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Person, TimelineEntry } from '../../shared/types';
import { imageUrl } from '../api';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { FilterPanel } from '../components/FilterPanel';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/PersonChips';
import { YearNav, useActiveYear } from '../components/YearNav';
import { config } from '../config';
import { albumTitle, formatDate, t } from '../i18n';
import { groupByYear, isFiltering, yearsOf, type Filters } from '../lib/filter';
import { href, linkClick } from '../router';

interface Props {
  all: TimelineEntry[];
  visible: TimelineEntry[]; // after filters
  people: Person[];
  filters: Filters;
  onFilters: (f: Filters) => void;
}

export function Timeline({ all, visible, people, filters, onFilters }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const years = useMemo(() => groupByYear(visible), [visible]);
  const allYears = useMemo(() => yearsOf(all), [all]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  useActiveYear(years, setActiveYear);
  const filtering = isFiltering(filters);
  const filterCount = filters.people.length + (filters.fromYear !== null || filters.toYear !== null ? 1 : 0);

  useEffect(() => {
    document.body.classList.toggle('sheet-open', sheetOpen);
  }, [sheetOpen]);

  return (
    <div class="app">
      <header class="appbar">
        <div class="appbar-row">
          <a class="brand" href={href.timeline()}>
            <span class="brand-mark" aria-hidden="true">
              <Icon name="image" size={20} />
            </span>
            <span class="brand-title">{albumTitle}</span>
          </a>
          <AddPhotosButton class="btn btn-primary header-add" />
        </div>
        {all.length > 0 && (
          <div class="toolbar">
            <button
              type="button"
              class={filtering ? 'btn btn-quiet search-btn is-on' : 'btn btn-quiet search-btn'}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <Icon name="search" />
              <span>{t.filters}</span>
              {filterCount > 0 && <span class="badge">{filterCount}</span>}
            </button>
            <YearNav years={years} active={activeYear} variant="strip" />
          </div>
        )}
      </header>

      <div class="shell">
        <aside class={sheetOpen ? 'sidebar is-open' : 'sidebar'} aria-label={t.filters}>
          <div class="sheet-header">
            <h2>{t.filters}</h2>
            <button type="button" class="btn btn-icon btn-ghost" aria-label={t.close} onClick={() => setSheetOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <FilterPanel people={people} years={allYears} filters={filters} onChange={onFilters} />
          <div class="sheet-footer">
            <button type="button" class="btn btn-primary btn-block" onClick={() => setSheetOpen(false)}>
              {t.showResults(visible.length)}
            </button>
          </div>
        </aside>
        {sheetOpen && <div class="backdrop sheet-backdrop" onClick={() => setSheetOpen(false)} />}

        <main class="content">
          {config.welcome && !filtering && <p class="welcome">{config.welcome}</p>}

          {filtering && (
            <div class="active-filters">
              {filters.people.map((id) => (
                <button
                  key={id}
                  type="button"
                  class="pill"
                  aria-label={t.removeFilter(nameOf.get(id) ?? id)}
                  onClick={() => onFilters({ ...filters, people: filters.people.filter((p) => p !== id) })}
                >
                  <Avatar name={nameOf.get(id) ?? id} />
                  {nameOf.get(id) ?? id}
                  <Icon name="close" size={18} />
                </button>
              ))}
              {(filters.fromYear !== null || filters.toYear !== null) && (
                <button type="button" class="pill" onClick={() => onFilters({ ...filters, fromYear: null, toYear: null })}>
                  <Icon name="calendar" size={18} />
                  {filters.fromYear ?? '…'} – {filters.toYear ?? '…'}
                  <Icon name="close" size={18} />
                </button>
              )}
              <span class="result-count">{t.photoCount(visible.length)}</span>
            </div>
          )}

          {all.length === 0 && <EmptyAlbum />}
          {all.length > 0 && visible.length === 0 && <p class="empty-note">{t.noMatch}</p>}

          {years.map((y) => (
            <section key={y.year} class="year-section" id={`year-${y.year}`} data-year={y.year}>
              <h2 class="year-title">
                <span class="year-num">{y.year}</span>
                <span class="year-count">{t.photoCount(y.photos.length)}</span>
              </h2>
              <div class="grid">
                {y.photos.map((p) => (
                  <Tile key={p.id} photo={p} alt={[formatDate(p.t, false), ...p.p.map((id) => nameOf.get(id) ?? id)].join(', ')} />
                ))}
              </div>
            </section>
          ))}
        </main>

        <YearNav years={years} active={activeYear} variant="rail" />
      </div>

      {all.length > 0 && (
        <div class="fab-bar">
          <AddPhotosButton class="btn btn-primary btn-fab" />
        </div>
      )}
    </div>
  );
}

/** One thumbnail, sized to keep the photo's own shape (see .grid in styles.css). */
function Tile({ photo, alt }: { photo: TimelineEntry; alt: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (img.current?.complete) setLoaded(true); // already in the browser cache
  }, []);
  // Very tall or very wide photos are cropped a little so rows stay tidy.
  const ratio = Math.min(2.2, Math.max(0.6, photo.w / photo.h));
  return (
    <a class="tile" href={href.photo(photo.id)} onClick={linkClick} style={{ '--r': ratio.toFixed(3) }}>
      <img
        ref={img}
        onLoad={() => setLoaded(true)}
        class={loaded ? 'is-loaded' : undefined}
        src={imageUrl(photo.id, 'thumb')}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

function EmptyAlbum() {
  return (
    <div class="empty">
      <svg class="empty-art" viewBox="0 0 220 160" aria-hidden="true">
        <g transform="rotate(-8 80 90)">
          <rect x="30" y="30" width="100" height="112" rx="6" class="print" />
          <rect x="40" y="40" width="80" height="72" rx="3" class="print-photo print-photo-2" />
        </g>
        <g transform="rotate(7 140 80)">
          <rect x="90" y="18" width="100" height="112" rx="6" class="print" />
          <rect x="100" y="28" width="80" height="72" rx="3" class="print-photo" />
          <circle cx="160" cy="48" r="9" class="print-sun" />
          <path d="M100 100 L128 70 L146 88 L160 76 L180 100 Z" class="print-hill" />
        </g>
      </svg>
      <h2>{t.emptyTitle}</h2>
      <p>{t.emptyText}</p>
      <AddPhotosButton class="btn btn-primary btn-big" />
    </div>
  );
}
