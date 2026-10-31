import { describe, expect, it } from 'vitest';
import { applyFilters, groupByYear, yearsOf } from '../src/lib/filter';
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
