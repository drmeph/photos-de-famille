// Timeline layout. Photos keep their own shape and are grouped by month:
// - months with few photos sit side by side on one line, all at the same height,
//   so sparse years (old scans, one photo here and there) stay compact;
// - a month too wide for one line gets its own justified rows.
// Pure functions, so the layout can be unit-tested without a browser.

import type { TimelineEntry } from '../../shared/types';

export interface LayoutOptions {
  width: number; // available width in px
  target: number; // preferred row height in px
  gap: number; // between photos
  monthGap: number; // between months on the same line
}

export interface PlacedPhoto {
  index: number; // position in the month's photo list
  width: number;
  height: number;
}

export interface PlacedMonth {
  key: string;
  width: number;
  rows: PlacedPhoto[][];
}

export type Line = PlacedMonth[];

/** Very tall or very wide photos are cropped a little so rows stay tidy. */
export const tileRatio = (e: TimelineEntry) => Math.min(2.2, Math.max(0.6, e.w / e.h));

/** Lines may grow taller than the target to fill the width, but not by more than this. */
const MAX_STRETCH = 1.25;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const naturalWidth = (ratios: number[], o: LayoutOptions) => sum(ratios) * o.target + o.gap * (ratios.length - 1);

export function layoutMonths(months: { key: string; ratios: number[] }[], o: LayoutOptions): Line[] {
  const lines: Line[] = [];
  let pending: { key: string; ratios: number[] }[] = [];
  let pendingWidth = 0;

  const flush = () => {
    if (pending.length) lines.push(fitLine(pending, o));
    pending = [];
    pendingWidth = 0;
  };

  for (const month of months) {
    const w = naturalWidth(month.ratios, o);
    if (w > o.width) {
      flush();
      lines.push([bigMonth(month, o)]);
      continue;
    }
    const added = (pending.length ? o.monthGap : 0) + w;
    if (pendingWidth + added > o.width) flush();
    pendingWidth += (pending.length ? o.monthGap : 0) + w;
    pending.push(month);
  }
  flush();
  return lines;
}

/** Several small months on one line, scaled together to fill the width (within limits). */
function fitLine(months: { key: string; ratios: number[] }[], o: LayoutOptions): Line {
  const ratios = months.flatMap((m) => m.ratios);
  const gaps = sum(months.map((m) => o.gap * (m.ratios.length - 1))) + o.monthGap * (months.length - 1);
  let height = (o.width - gaps) / sum(ratios);
  if (height > o.target * MAX_STRETCH) height = o.target; // too few photos to fill the line: leave it short
  return months.map((m) => ({
    key: m.key,
    width: sum(m.ratios) * height + o.gap * (m.ratios.length - 1),
    rows: [m.ratios.map((r, index) => ({ index, width: r * height, height }))],
  }));
}

/** One month wider than the line: justified rows; the last row keeps the target height. */
function bigMonth(month: { key: string; ratios: number[] }, o: LayoutOptions): PlacedMonth {
  const rows: PlacedPhoto[][] = [];
  let start = 0;
  const place = (end: number, height: number) => {
    rows.push(month.ratios.slice(start, end).map((r, i) => ({ index: start + i, width: r * height, height })));
    start = end;
  };
  for (let i = 0; i < month.ratios.length; i++) {
    const row = month.ratios.slice(start, i + 1);
    if (naturalWidth(row, o) >= o.width) place(i + 1, (o.width - o.gap * (row.length - 1)) / sum(row));
  }
  if (start < month.ratios.length) {
    const row = month.ratios.slice(start);
    place(month.ratios.length, Math.min(o.target, (o.width - o.gap * (row.length - 1)) / sum(row)));
  }
  return { key: month.key, width: o.width, rows };
}

/** Row height and spacing that suit the available width (phone, tablet, desktop). */
export function optionsFor(width: number): LayoutOptions {
  const gap = width < 600 ? 6 : 8;
  return { width, target: Math.min(240, Math.max(120, width / 4.6)), gap, monthGap: gap * 3 };
}
