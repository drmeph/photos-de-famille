import { describe, expect, it } from 'vitest';
import { layoutMonths, optionsFor, type Line } from '../src/lib/layout';

const o = { width: 1000, target: 200, gap: 8, monthGap: 24 };
const lineWidth = (line: Line) => line.reduce((w, m) => w + m.width, 0) + o.monthGap * (line.length - 1);
const rowWidth = (row: { width: number }[]) => row.reduce((w, p) => w + p.width, 0) + o.gap * (row.length - 1);

describe('timeline layout', () => {
  it('puts small months side by side, filling the line at one height', () => {
    const lines = layoutMonths(
      [
        { key: '2020-08', ratios: [1.5, 1] },
        { key: '2020-05', ratios: [0.75] },
        { key: '2020-03', ratios: [1.33] }, // 508 + 24 + 150 + 24 + 266 = 972px: fits
      ],
      o,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].map((m) => m.key)).toEqual(['2020-08', '2020-05', '2020-03']);
    expect(lineWidth(lines[0])).toBeCloseTo(1000);
    const heights = new Set(lines[0].flatMap((m) => m.rows.flat().map((p) => p.height.toFixed(3))));
    expect(heights.size).toBe(1);
  });

  it('starts a new line when the next month does not fit', () => {
    const lines = layoutMonths(
      [
        { key: 'a', ratios: [1.5, 1.5] }, // 608px
        { key: 'b', ratios: [1.5] }, // 300px: fits (608 + 24 + 300 = 932)
        { key: 'c', ratios: [1.5] }, // would make 1256px
      ],
      o,
    );
    expect(lines.map((l) => l.map((m) => m.key))).toEqual([['a', 'b'], ['c']]);
  });

  it('does not blow up a short line: it keeps the target height', () => {
    const [line] = layoutMonths([{ key: 'a', ratios: [1] }], o);
    expect(line[0].rows[0][0]).toEqual({ index: 0, width: 200, height: 200 });
  });

  it('gives a big month its own justified rows, with a natural last row', () => {
    const ratios = Array.from({ length: 11 }, () => 1.5);
    const [line, ...rest] = layoutMonths([{ key: 'big', ratios }], o);
    expect(rest).toHaveLength(0);
    const rows = line[0].rows;
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.slice(0, -1)) expect(rowWidth(row)).toBeCloseTo(1000);
    expect(rows.at(-1)!.every((p) => p.height === 200)).toBe(true);
    expect(rows.flat().map((p) => p.index)).toEqual(ratios.map((_, i) => i));
  });

  it('adapts row height to the screen', () => {
    expect(optionsFor(358).target).toBe(120);
    expect(optionsFor(1400).target).toBe(240);
    expect(optionsFor(800).target).toBeCloseTo(800 / 4.6);
  });
});
