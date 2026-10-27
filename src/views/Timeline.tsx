import { useMemo, useState } from 'preact/hooks';
import type { Person, TimelineEntry } from '../../shared/types';
import { imageUrl } from '../api';
import { AddPhotosButton } from '../components/AddPhotosButton';
import { FilterPanel } from '../components/FilterPanel';
import { formatDate, formatMonth, t } from '../i18n';
import { groupByMonth, isFiltering, yearsOf, type Filters } from '../lib/filter';
import { href, linkClick } from '../router';

interface Props {
  all: TimelineEntry[];
  visible: TimelineEntry[]; // after filters
  people: Person[];
  filters: Filters;
  onFilters: (f: Filters) => void;
}

export function Timeline({ all, visible, people, filters, onFilters }: Props) {
  const [showFilters, setShowFilters] = useState(isFiltering(filters));
  const groups = useMemo(() => groupByMonth(visible), [visible]);
  const allYears = useMemo(() => yearsOf(all), [all]);
  const visibleYears = useMemo(() => yearsOf(visible), [visible]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  const jumpToYear = (year: string) => {
    document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main class="timeline">
      <header class="topbar">
        <h1>{t.appTitle}</h1>
        <button
          type="button"
          class={showFilters || isFiltering(filters) ? 'btn btn-on' : 'btn'}
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? t.hideFilters : `🔍 ${t.filters}`}
        </button>
      </header>

      {showFilters && <FilterPanel people={people} years={allYears} filters={filters} onChange={onFilters} />}

      {isFiltering(filters) && (
        <p class="filter-summary">
          {t.photoCount(visible.length)}
          {filters.people.length > 0 && ` · ${filters.people.map((id) => nameOf.get(id) ?? id).join(', ')}`}
          {(filters.fromYear || filters.toYear) && ` · ${filters.fromYear ?? '…'}–${filters.toYear ?? '…'}`}
        </p>
      )}

      {visibleYears.length > 1 && (
        <label class="year-jump">
          <span>{t.jumpToYear}</span>
          <select value="" onChange={(e) => jumpToYear(e.currentTarget.value)}>
            <option value="" disabled>
              …
            </option>
            {visibleYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}

      {all.length === 0 && <p class="empty">{t.emptyAlbum}</p>}
      {all.length > 0 && visible.length === 0 && <p class="empty">{t.noMatch}</p>}

      {groups.map((g, i) => {
        const year = g.key.slice(0, 4);
        const firstOfYear = i === 0 || groups[i - 1].key.slice(0, 4) !== year;
        return (
          <section key={g.key} class="month" id={firstOfYear ? `year-${year}` : undefined}>
            <h2 class="month-title">{formatMonth(g.key)}</h2>
            <div class="grid">
              {g.photos.map((p) => (
                <a key={p.id} href={href.photo(p.id)} onClick={linkClick} class="thumb">
                  <img
                    src={imageUrl(p.id, 'thumb')}
                    alt={[formatDate(p.t, false), ...p.p.map((id) => nameOf.get(id) ?? id)].join(', ')}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ))}
            </div>
          </section>
        );
      })}

      <div class="bottombar">
        <AddPhotosButton />
      </div>
    </main>
  );
}
