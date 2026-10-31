import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Person, TimelineEntry } from '../../shared/types';
import { imageUrl } from '../api';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { FilterPanel } from '../components/FilterPanel';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/PersonChips';
import { YearNav, useActiveYear } from '../components/YearNav';
import { config } from '../config';
import { albumTitle, formatDate, formatMonthName, t } from '../i18n';
import { groupByYear, isFiltering, yearsOf, type Filters, type YearGroup } from '../lib/filter';
import { layoutMonths, optionsFor, tileRatio } from '../lib/layout';
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
  const photosBox = useRef<HTMLDivElement>(null);
  const width = useWidth(photosBox);
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

          <div ref={photosBox}>
            {years.map((y) => (
              <section key={y.year} class="year-section" id={`year-${y.year}`} data-year={y.year}>
                <h2 class="year-title">
                  <span class="year-num">{y.year}</span>
                  <span class="year-count">{t.photoCount(y.photos.length)}</span>
                </h2>
                <YearPhotos year={y} width={width} nameOf={nameOf} />
              </section>
            ))}
          </div>
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

/** Width of an element, kept up to date when the window or layout changes. */
function useWidth(ref: { current: HTMLElement | null }): number {
  // A first guess from the window size (paddings, sidebar, year column), refined once measured.
  const [width, setWidth] = useState(() => {
    const w = window.innerWidth;
    return w < 700 ? w - 32 : w < 1100 ? w - 56 : w - 320 - 150 - 88;
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return width;
}

/** One year's photos, grouped by month (see lib/layout.ts for how lines are built). */
function YearPhotos({ year, width, nameOf }: { year: YearGroup; width: number; nameOf: Map<string, string> }) {
  const o = optionsFor(width);
  const lines = useMemo(
    () => layoutMonths(year.months.map((m) => ({ key: m.key, ratios: m.photos.map(tileRatio) })), o),
    [year, width],
  );
  const months = new Map(year.months.map((m) => [m.key, m.photos]));
  return (
    <div class="year-photos">
      {lines.map((line) => (
        <div key={line[0].key} class="month-line" style={{ gap: `${o.monthGap}px` }}>
          {line.map((m) => {
            const photos = months.get(m.key)!;
            const name = formatMonthName(m.key);
            return (
              <div key={m.key} class="month" style={{ width: `${m.width}px` }}>
                <h3 class="month-title" title={name}>
                  {/* Abbreviate only when the full name wouldn't fit (≈11px per letter at this size). */}
                  {name.length * 11 > m.width ? formatMonthName(m.key, true) : name}
                </h3>
                {m.rows.map((row, i) => (
                  <div key={i} class="month-row" style={{ gap: `${o.gap}px`, marginTop: i ? `${o.gap}px` : undefined }}>
                    {row.map(({ index, width, height }) => {
                      const p = photos[index];
                      const alt = [formatDate(p.t, false), ...p.p.map((id) => nameOf.get(id) ?? id), p.c ? t.commentCount(p.c) : '']
                        .filter(Boolean)
                        .join(', ');
                      return <Tile key={p.id} photo={p} alt={alt} width={width} height={height} />;
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** One thumbnail, at the size the layout gave it. */
function Tile({ photo, alt, width, height }: { photo: TimelineEntry; alt: string; width: number; height: number }) {
  const img = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (img.current?.complete) setLoaded(true); // already in the browser cache
  }, []);
  return (
    <a class="tile" href={href.photo(photo.id)} onClick={linkClick} style={{ width: `${width}px`, height: `${height}px` }}>
      <img
        ref={img}
        onLoad={() => setLoaded(true)}
        class={loaded ? 'is-loaded' : undefined}
        src={imageUrl(photo.id, 'thumb')}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      {photo.c ? (
        <span class="tile-badge" aria-hidden="true">
          <Icon name="message" size={15} />
          {photo.c}
        </span>
      ) : null}
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
