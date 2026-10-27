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

export interface MonthGroup {
  key: string; // "2019-07"
  photos: TimelineEntry[];
}

/** Photos must already be sorted (newest first, as in index.json). */
export function groupByMonth(photos: TimelineEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const e of photos) {
    const key = e.t.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.photos.push(e);
    else groups.push({ key, photos: [e] });
  }
  return groups;
}

/** Distinct years, newest first. */
export function yearsOf(photos: TimelineEntry[]): number[] {
  return [...new Set(photos.map(yearOf))].sort((a, b) => b - a);
}
