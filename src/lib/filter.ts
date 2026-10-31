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

export interface YearGroup {
  year: string; // "1985"
  photos: TimelineEntry[];
}

/** Photos must already be sorted (newest first). */
export function groupByYear(photos: TimelineEntry[]): YearGroup[] {
  const years: YearGroup[] = [];
  for (const e of photos) {
    const year = e.t.slice(0, 4);
    const last = years[years.length - 1];
    if (last?.year === year) last.photos.push(e);
    else years.push({ year, photos: [e] });
  }
  return years;
}
