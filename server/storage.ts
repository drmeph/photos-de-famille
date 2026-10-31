// R2 layout:
//   originals/<id>   the file exactly as uploaded (JPEG, HEIC, PNG...)
//   display/<id>     JPEG, long edge <= 2048px, shown on the photo page
//   thumbs/<id>      JPEG, long edge <= 480px, shown in the timeline
//   meta/<id>.json   PhotoMeta — the source of truth for one photo
//   index.json       TimelineIndex — derived from meta/, rebuilt with rebuildIndex()
//   people.json      PeopleFile — the list of family members you can tag
//   members.json     MembersFile — the display name each signed-in person chose (for comments)

import type { Variant } from '../shared/types';

export const INDEX_KEY = 'index.json';
export const PEOPLE_KEY = 'people.json';
export const MEMBERS_KEY = 'members.json';
export const META_PREFIX = 'meta/';

const VARIANT_PREFIX: Record<Variant, string> = {
  original: 'originals/',
  display: 'display/',
  thumb: 'thumbs/',
};

export const imageKey = (variant: Variant, id: string) => VARIANT_PREFIX[variant] + id;
export const metaKey = (id: string) => `${META_PREFIX}${id}.json`;

export class ConflictError extends Error {}

export async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

/**
 * Read-modify-write a JSON object with optimistic concurrency: the write only
 * succeeds if nobody else wrote the object since we read it; otherwise retry.
 *
 * `mutate` receives the current value (or `initial()` if the object does not
 * exist yet) and returns the new value, or `null` to leave it unchanged.
 *
 * Note: the very first write of an object is unconditional, so two writes racing
 * to *create* index.json could lose one entry. POST /api/admin/rebuild-index fixes that.
 */
export async function updateJson<T>(
  bucket: R2Bucket,
  key: string,
  initial: () => T,
  mutate: (current: T) => T | null,
  attempts = 8,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const obj = await bucket.get(key);
    const current = obj ? ((await obj.json()) as T) : initial();
    const next = mutate(current);
    if (next === null) return current;
    const body = JSON.stringify(next);
    const opts: R2PutOptions = { httpMetadata: { contentType: 'application/json' } };
    if (obj) opts.onlyIf = { etagMatches: obj.etag };
    const written = await bucket.put(key, body, opts);
    if (written) return next;
    // Precondition failed: someone else wrote in between. Back off a little and retry.
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80 * (i + 1)));
  }
  throw new ConflictError(`Too many concurrent updates to ${key}`);
}
