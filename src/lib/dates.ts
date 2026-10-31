import type { LocalDateTime } from '../../shared/types';

export function toLocalDateTime(d: Date): LocalDateTime {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "2019:07:14 15:32:10" (EXIF) -> "2019-07-14T15:32:10". Returns null for missing/garbage dates. */
export function parseExifDate(raw: unknown): LocalDateTime | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (+y < 1826 || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null; // "0000:00:00 00:00:00" etc.
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}
