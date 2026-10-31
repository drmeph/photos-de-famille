import type { TimelineEntry } from '../../shared/types';

export interface Filters {
  people: string[]; // photo must include *all* of these
  fromYear: number | null;
  toYear: number | null;
}

export const NO_FILTERS: Filters = { people: [], fromYear: null, toYear: null };

export const isFiltering = (f: Filters) => f.people.length > 0 || f.fromYear !== null || f.toYear !== null;

export const yearOf = (e: TimelineEntry) => Number(e.t.slice(0, 4));

export function applyFilters(photos: TimelineEntry[], f: Filters): TimelineEntry[] {
  if (!isFiltering(f)) return photos;
  return photos.filter(
    (e) =>
      (f.fromYear === null || yearOf(e) >= f.fromYear) &&
      (f.toYear === null || yearOf(e) <= f.toYear) &&
      f.people.every((p) => e.p.includes(p)),
  );
}

/** Distinct years, newest first. */
export function yearsOf(photos: TimelineEntry[]): number[] {
  return [...new Set(photos.map(yearOf))].sort((a, b) => b - a);
}

export interface MonthGroup {
  key: string; // "1985-12"
  photos: TimelineEntry[];
}

export interface YearGroup {
  year: string; // "1985"
  photos: TimelineEntry[];
  months: MonthGroup[];
}

/** Photos must already be sorted (newest first). */
export function groupByYear(photos: TimelineEntry[]): YearGroup[] {
  const years: YearGroup[] = [];
  for (const e of photos) {
    const year = e.t.slice(0, 4);
    const month = e.t.slice(0, 7);
    let y = years[years.length - 1];
    if (y?.year !== year) years.push((y = { year, photos: [], months: [] }));
    y.photos.push(e);
    const m = y.months[y.months.length - 1];
    if (m?.key === month) m.photos.push(e);
    else y.months.push({ key: month, photos: [e] });
  }
  return years;
}
