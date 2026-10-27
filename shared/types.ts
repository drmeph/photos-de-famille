// Types shared by the browser app (src/) and the Pages Functions (server/, functions/).

/** Image variants stored in R2 for every photo. */
export const VARIANTS = ['original', 'display', 'thumb'] as const;
export type Variant = (typeof VARIANTS)[number];

/** Long edge, in pixels, of the resized variants generated in the browser. */
export const DISPLAY_MAX = 2048;
export const THUMB_MAX = 480;

/**
 * A date/time as written on the photo, *without* timezone: "YYYY-MM-DDTHH:mm:ss".
 * EXIF dates have no timezone, so we keep the wall-clock time as-is.
 * Plain string comparison sorts these chronologically.
 */
export type LocalDateTime = string;

export type DateSource = 'exif' | 'upload' | 'manual';

export interface Person {
  id: string;
  name: string;
}

export interface PeopleFile {
  v: 1;
  people: Person[];
}

export interface HistoryEntry {
  at: string; // ISO timestamp (UTC)
  by: string; // email or name of the family member
  action: string; // human-readable, e.g. "+tag:mamie"
}

/** Full metadata for one photo, stored as meta/<id>.json in R2 (source of truth). */
export interface PhotoMeta {
  id: string;
  takenAt: LocalDateTime;
  dateSource: DateSource;
  width: number; // of the display variant
  height: number;
  people: string[]; // Person ids
  caption: string;
  original: { name: string; contentType: string; size: number };
  uploadedAt: string; // ISO
  uploadedBy: string;
  history: HistoryEntry[]; // most recent last, capped
}

/** Compact per-photo entry in the timeline index (index.json). */
export interface TimelineEntry {
  id: string;
  t: LocalDateTime;
  w: number;
  h: number;
  p: string[];
}

/** index.json: every photo, newest first. Rebuilt incrementally on each write. */
export interface TimelineIndex {
  v: 1;
  photos: TimelineEntry[];
}

/** Body of POST /api/photos/:id (finalize an upload). */
export interface CreatePhotoRequest {
  takenAt: LocalDateTime;
  dateSource: Exclude<DateSource, 'manual'>;
  width: number;
  height: number;
  originalName: string;
  people?: string[];
}

/** Body of PATCH /api/photos/:id. Tag changes are add/remove operations so two
 *  people tagging the same photo at once never overwrite each other. */
export interface UpdatePhotoRequest {
  addPeople?: string[];
  removePeople?: string[];
  takenAt?: LocalDateTime;
  caption?: string;
}

export const PHOTO_ID_RE = /^[a-f0-9]{20}$/;
export const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export function toTimelineEntry(m: PhotoMeta): TimelineEntry {
  return { id: m.id, t: m.takenAt, w: m.width, h: m.height, p: m.people };
}

/** Newest first; ties broken by id so the order is stable. */
export function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  if (a.t !== b.t) return a.t < b.t ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
