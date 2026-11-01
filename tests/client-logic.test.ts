import { describe, expect, it } from 'vitest';
import { applyFilters, groupByAddedDay, groupByYear, localDay, sortByAdded, splitByUploader, yearsOf } from '../src/lib/filter';
import { parseExifDate } from '../src/lib/dates';
import type { TimelineEntry } from '../shared/types';

const e = (id: string, t: string, p: string[] = []): TimelineEntry => ({ id, t, w: 1, h: 1, p });
const photos = [
  e('1', '2020-08-02T10:00:00', ['lea', 'paul']),
  e('2', '2020-08-01T10:00:00', ['lea']),
  e('3', '2020-03-01T10:00:00', []),
  e('4', '1985-12-24T20:00:00', ['paul']),
];

describe('filters', () => {
  it('requires every selected person', () => {
    expect(applyFilters(photos, { people: ['lea'], fromYear: null, toYear: null }).map((p) => p.id)).toEqual(['1', '2']);
    expect(applyFilters(photos, { people: ['lea', 'paul'], fromYear: null, toYear: null }).map((p) => p.id)).toEqual(['1']);
  });

  it('filters by an inclusive year range', () => {
    expect(applyFilters(photos, { people: [], fromYear: 1980, toYear: 1990 }).map((p) => p.id)).toEqual(['4']);
    expect(applyFilters(photos, { people: ['paul'], fromYear: 2020, toYear: null }).map((p) => p.id)).toEqual(['1']);
  });

  it('lists distinct years, newest first', () => {
    expect(yearsOf(photos)).toEqual([2020, 1985]);
  });

  it('groups by year, then month, keeping the order', () => {
    expect(groupByYear(photos).map((y) => [y.year, y.photos.map((p) => p.id), y.months.map((m) => m.key)])).toEqual([
      ['2020', ['1', '2', '3'], ['2020-08', '2020-03']],
      ['1985', ['4'], ['1985-12']],
    ]);
  });
});

describe('parseExifDate', () => {
  it('converts EXIF dates without shifting the timezone', () => {
    expect(parseExifDate('2019:07:14 15:32:10')).toBe('2019-07-14T15:32:10');
    expect(parseExifDate('2019-07-14T15:32:10+02:00')).toBe('2019-07-14T15:32:10');
  });

  it('ignores empty or bogus dates', () => {
    expect(parseExifDate('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDate('    ')).toBeNull();
    expect(parseExifDate(undefined)).toBeNull();
  });
});

describe('latest additions', () => {
  const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).toISOString();
  const added = [
    { ...e('old-scan', '1962-06-15T10:00:00'), u: at(2026, 10, 31, 20) },
    { ...e('summer', '2025-07-14T10:00:00'), u: at(2026, 10, 31, 9) },
    { ...e('xmas', '2024-12-24T10:00:00'), u: at(2026, 10, 27) },
    e('legacy', '2020-01-01T10:00:00'), // no upload date yet
  ];

  it('sorts by upload date, newest first, unknown last', () => {
    expect(sortByAdded([added[3], added[2], added[0], added[1]]).map((p) => p.id)).toEqual(['old-scan', 'summer', 'xmas', 'legacy']);
  });

  it('groups by the local day photos were added', () => {
    const groups = groupByAddedDay(sortByAdded(added));
    expect(groups.map((g) => [g.key, g.photos.map((p) => p.id)])).toEqual([
      ['2026-10-31', ['old-scan', 'summer']],
      ['2026-10-27', ['xmas']],
      ['', ['legacy']],
    ]);
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('who added what', () => {
  it('splits a day by uploader, most recent first, keeping order inside each group', () => {
    const day = [
      { ...e('1', '2020-01-01T00:00:00'), b: 'mamie@x' },
      { ...e('2', '2020-01-01T00:00:00'), b: 'kevin@x' },
      { ...e('3', '2020-01-01T00:00:00'), b: 'mamie@x' },
      e('4', '2020-01-01T00:00:00'),
    ];
    expect(splitByUploader(day).map((g) => [g.by, g.photos.map((p) => p.id)])).toEqual([
      ['mamie@x', ['1', '3']],
      ['kevin@x', ['2']],
      ['', ['4']],
    ]);
  });
});
