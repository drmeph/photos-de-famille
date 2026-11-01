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

/** 'date': by when the photo was taken (the timeline). 'added': latest uploads first. */
export type SortMode = 'date' | 'added';

/** Latest uploads first. Entries without an upload date (not backfilled yet) go last. */
export function sortByAdded(photos: TimelineEntry[]): TimelineEntry[] {
  return [...photos].sort((a, b) => {
    if ((a.u ?? '') !== (b.u ?? '')) return (a.u ?? '') < (b.u ?? '') ? 1 : -1;
    return a.t !== b.t ? (a.t < b.t ? 1 : -1) : a.id < b.id ? -1 : 1;
  });
}

export interface DayGroup {
  key: string; // local date "2026-10-31", or "" when the upload date is unknown
  photos: TimelineEntry[];
}

/** Group photos already sorted by sortByAdded, by the day (in the viewer's timezone) they were added. */
export function groupByAddedDay(photos: TimelineEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of photos) {
    const key = e.u ? localDay(new Date(e.u)) : '';
    const last = groups[groups.length - 1];
    if (last?.key === key) last.photos.push(e);
    else groups.push({ key, photos: [e] });
  }
  return groups;
}

export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
