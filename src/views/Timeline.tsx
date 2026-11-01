import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Person, TimelineEntry } from '../../shared/types';
import { imageUrl } from '../api';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { FilterPanel } from '../components/FilterPanel';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/PersonChips';
import { YearNav, useActiveYear } from '../components/YearNav';
import { config } from '../config';
import { albumTitle, formatAddedDay, formatDate, formatMonthName, t } from '../i18n';
import { displayName, members as membersStore } from '../data';
import { groupByAddedDay, groupByYear, isFiltering, splitByUploader, yearsOf, type Filters, type SortMode } from '../lib/filter';
import { useStore } from '../lib/store';
import { layoutMonths, optionsFor, tileRatio } from '../lib/layout';
import { href, linkClick } from '../router';

interface Props {
  all: TimelineEntry[];
  visible: TimelineEntry[]; // after filters
  people: Person[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
}

export function Timeline({ all, visible, people, filters, onFilters, sort, onSort }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const byDate = sort === 'date';
  const years = useMemo(() => (byDate ? groupByYear(visible) : []), [visible, byDate]);
  const days = useMemo(
    () =>
      byDate
        ? []
        : groupByAddedDay(visible).map((d) => ({
            ...d,
            // Within a day, one group per person who added photos: "par Mamie", "par Kevin"…
            groups: splitByUploader(d.photos).map((g) => ({ key: `${d.key}|${g.by}`, by: g.by, photos: g.photos })),
          })),
    [visible, byDate],
  );
  const names = useStore(membersStore);
  const uploaderLabel = (key: string, width: number) => {
    const group = days.flatMap((d) => d.groups).find((g) => g.key === key);
    if (!group?.by) return '';
    const name = displayName(group.by, names);
    const full = `${t.byName(name)} · ${t.photoCount(group.photos.length)}`;
    if (full.length * 9.5 <= width) return full;
    return t.byName(name).length * 9.5 <= width ? t.byName(name) : name;
  };
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

      <div class={byDate ? 'shell' : 'shell is-recent'}>
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

          {all.length > 0 && <SortToggle sort={sort} onSort={onSort} />}

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
                <PhotoGroups groups={y.months} width={width} nameOf={nameOf} label={monthLabel} />
              </section>
            ))}
            {days.map((d) => (
              <section key={d.key || 'earlier'} class="day-section">
                <h2 class="day-title">
                  <span>{formatAddedDay(d.key)}</span>
                  <span class="year-count">{t.photoCount(d.photos.length)}</span>
                </h2>
                <PhotoGroups groups={d.groups} width={width} nameOf={nameOf} label={uploaderLabel} showYear />
              </section>
            ))}
          </div>
        </main>

        {byDate && <YearNav years={years} active={activeYear} variant="rail" />}
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

/** "Par date" / "Derniers ajouts": two big buttons at the top of the album. */
function SortToggle({ sort, onSort }: { sort: SortMode; onSort: (s: SortMode) => void }) {
  const choose = (s: SortMode) => {
    if (s === sort) return;
    onSort(s);
    window.scrollTo({ top: 0 });
  };
  return (
    <div class="sort-toggle" role="group" aria-label={t.sortBy}>
      <button type="button" aria-pressed={sort === 'date'} onClick={() => choose('date')}>
        <Icon name="calendar" size={20} />
        <span>{t.sortDate}</span>
      </button>
      <button type="button" aria-pressed={sort === 'added'} onClick={() => choose('added')}>
        <Icon name="clock" size={20} />
        <span>{t.sortAdded}</span>
      </button>
    </div>
  );
}

/** Month names above each month, abbreviated only when the full name wouldn't fit (≈11px per letter). */
function monthLabel(key: string, width: number) {
  const name = formatMonthName(key);
  return name.length * 11 > width ? formatMonthName(key, true) : name;
}

interface PhotoGroupsProps {
  groups: { key: string; photos: TimelineEntry[] }[];
  width: number;
  nameOf: Map<string, string>;
  /** Title above each group (the month name), given the width the layout gave it. */
  label?: (key: string, width: number) => string;
  /** Show the year each photo was taken on its thumbnail ("Derniers ajouts" view). */
  showYear?: boolean;
}

/** Groups of photos laid out in lines (see lib/layout.ts): small groups share a line. */
function PhotoGroups({ groups, width, nameOf, label, showYear = false }: PhotoGroupsProps) {
  const o = optionsFor(width);
  const lines = useMemo(() => layoutMonths(groups.map((g) => ({ key: g.key, ratios: g.photos.map(tileRatio) })), o), [groups, width]);
  const byKey = new Map(groups.map((g) => [g.key, g.photos]));
  return (
    <div class="year-photos">
      {lines.map((line) => (
        <div key={line[0].key} class="month-line" style={{ gap: `${o.monthGap}px` }}>
          {line.map((m) => {
            const photos = byKey.get(m.key)!;
            return (
              <div key={m.key} class="month" style={{ width: `${m.width}px` }}>
                {label && (
                  <h3 class="month-title" title={label(m.key, Infinity)}>
                    {label(m.key, m.width)}
                  </h3>
                )}
                {m.rows.map((row, i) => (
                  <div key={i} class="month-row" style={{ gap: `${o.gap}px`, marginTop: i ? `${o.gap}px` : undefined }}>
                    {row.map(({ index, width, height }) => {
                      const p = photos[index];
                      const alt = [formatDate(p.t, false), ...p.p.map((id) => nameOf.get(id) ?? id), p.c ? t.commentCount(p.c) : '']
                        .filter(Boolean)
                        .join(', ');
                      return <Tile key={p.id} photo={p} alt={alt} width={width} height={height} showYear={showYear} />;
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
function Tile(props: { photo: TimelineEntry; alt: string; width: number; height: number; showYear: boolean }) {
  const { photo, alt, width, height, showYear } = props;
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
      {showYear && (
        <span class="tile-year" aria-hidden="true">
          {photo.t.slice(0, 4)}
        </span>
      )}
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
