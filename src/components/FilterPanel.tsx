import type { Person } from '../../shared/types';
import { t } from '../i18n';
import { NO_FILTERS, type Filters } from '../lib/filter';
import { PersonChips } from './PersonChips';

interface Props {
  people: Person[];
  years: number[]; // newest first
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function FilterPanel({ people, years, filters, onChange }: Props) {
  const togglePerson = (id: string) =>
    onChange({
      ...filters,
      people: filters.people.includes(id) ? filters.people.filter((p) => p !== id) : [...filters.people, id],
    });
  const yearSelect = (value: number | null, set: (y: number | null) => void, label: string) => (
    <label class="year-select">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => set(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
        <option value="">{t.anyYear}</option>
        {[...years].reverse().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section class="panel filter-panel" aria-label={t.filters}>
      <h2>{t.whoFilter}</h2>
      <PersonChips people={people} selected={filters.people} onToggle={togglePerson} />
      <h2>{t.date}</h2>
      <div class="year-range">
        {yearSelect(filters.fromYear, (fromYear) => onChange({ ...filters, fromYear }), t.fromYear)}
        {yearSelect(filters.toYear, (toYear) => onChange({ ...filters, toYear }), t.toYear)}
      </div>
      <button type="button" class="btn" onClick={() => onChange(NO_FILTERS)}>
        {t.clearFilters}
      </button>
    </section>
  );
}
