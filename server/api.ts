// All /api/* routes. Kept framework-free so it can be unit-tested with a fake R2 bucket.
//
//   GET   /api/me                          -> { user, name }
//   PUT   /api/me            {name}        -> { user, name } (display name shown with comments)
//   GET   /api/timeline                    -> TimelineIndex (index.json)
//   GET   /api/people                      -> PeopleFile
//   POST  /api/people        {name}        -> Person (existing one if the name is already there)
//   PUT   /api/photos/:id/:variant  <bytes> upload one image variant (before finalizing)
//   POST  /api/photos/:id    CreatePhotoRequest -> PhotoMeta (finalize an upload)
//   GET   /api/photos/:id                  -> PhotoMeta
//   PATCH /api/photos/:id    UpdatePhotoRequest -> PhotoMeta
//   GET   /api/photos/:id/:variant         -> image bytes (?download=1 for the original as attachment)
//   POST  /api/photos/:id/comments  {text} -> PhotoMeta (needs a display name, see PUT /api/me)
//   DELETE /api/photos/:id/comments/:cid   -> PhotoMeta (only the comment's author)
//   POST  /api/admin/rebuild-index         -> { count } (regenerate index.json from meta/*.json)
//
// Uploads are raw PUTs streamed straight into R2 (no multipart parsing), which keeps
// CPU time per request tiny and fits the Workers free plan.

import {
  COMMENT_MAX,
  LOCAL_DATETIME_RE,
  NAME_MAX,
  PHOTO_ID_RE,
  VARIANTS,
  compareEntries,
  toTimelineEntry,
  type CreatePhotoRequest,
  type Comment,
  type HistoryEntry,
  type MembersFile,
  type PeopleFile,
  type Person,
  type PhotoMeta,
  type TimelineIndex,
  type UpdatePhotoRequest,
  type Variant,
} from '../shared/types';
import type { Env } from './env';
import {
  ConflictError,
  INDEX_KEY,
  MEMBERS_KEY,
  META_PREFIX,
  PEOPLE_KEY,
  imageKey,
  metaKey,
  readJson,
  updateJson,
} from './storage';

const MB = 1024 * 1024;
const MAX_BYTES: Record<Variant, number> = { original: 95 * MB, display: 10 * MB, thumb: 2 * MB };
// SVG and other script-capable types are deliberately not allowed.
const ORIGINAL_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);
const HISTORY_MAX = 50;
const COMMENTS_MAX = 500; // per photo; far beyond what a family writes
const COMMENT_ID_RE = /^[a-f0-9-]{8,36}$/;
const PERSON_ID_RE = /^[a-z0-9-]{1,64}$/;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

export async function handleApi(request: Request, env: Env, user: string): Promise<Response> {
  try {
    return await route(request, env, user);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof ConflictError) return json({ error: err.message }, 409);
    console.error(err);
    return json({ error: 'Internal error' }, 500);
  }
}

async function route(request: Request, env: Env, user: string): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  const bucket = env.PHOTOS;

  if (parts[0] === 'me' && parts.length === 1) {
    if (method === 'GET') return json({ user, name: await displayName(bucket, user) });
    if (method === 'PUT') return json({ user, name: await setDisplayName(bucket, user, await readBody(request)) });
  }

  if (parts[0] === 'photos' && parts[2] === 'comments' && PHOTO_ID_RE.test(parts[1] ?? '')) {
    if (parts.length === 3 && method === 'POST') return json(await addComment(bucket, parts[1], await readBody(request), user), 201);
    if (parts.length === 4 && method === 'DELETE') return json(await deleteComment(bucket, parts[1], parts[3], user));
  }

  if (parts[0] === 'timeline' && parts.length === 1 && method === 'GET') {
    return serveJsonObject(request, bucket, INDEX_KEY, { v: 1, photos: [] } satisfies TimelineIndex);
  }

  if (parts[0] === 'people' && parts.length === 1) {
    if (method === 'GET') return serveJsonObject(request, bucket, PEOPLE_KEY, { v: 1, people: [] } satisfies PeopleFile);
    if (method === 'POST') return json(await addPerson(bucket, await readBody(request)), 201);
  }

  if (parts[0] === 'photos' && (parts.length === 2 || parts.length === 3)) {
    const id = parts[1];
    if (!PHOTO_ID_RE.test(id)) throw new HttpError(400, 'Bad photo id');
    if (parts.length === 2) {
      if (method === 'GET') return json(await getMeta(bucket, id));
      if (method === 'POST') return createPhoto(bucket, id, await readBody(request), user);
      if (method === 'PATCH') return json(await updatePhoto(bucket, id, await readBody(request), user));
    } else {
      const variant = parts[2] as Variant;
      if (!VARIANTS.includes(variant)) throw new HttpError(404, 'Unknown variant');
      if (method === 'PUT') return uploadVariant(request, bucket, id, variant);
      if (method === 'GET' || method === 'HEAD') return serveImage(request, bucket, id, variant, url);
    }
  }

  if (parts[0] === 'admin' && parts[1] === 'rebuild-index' && parts.length === 2 && method === 'POST') {
    return json({ count: await rebuildIndex(bucket) });
  }

  throw new HttpError(404, 'Not found');
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Expected a JSON object');
}

/** Stream a JSON object from R2 with ETag revalidation (cheap: no parsing). */
async function serveJsonObject(request: Request, bucket: R2Bucket, key: string, empty: unknown) {
  const obj = await bucket.get(key, { onlyIf: request.headers });
  if (!obj) return json(empty);
  const headers = { ETag: obj.httpEtag, 'Cache-Control': 'no-cache' };
  if (!('body' in obj)) return new Response(null, { status: 304, headers }); // If-None-Match hit
  return new Response(obj.body, { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

// ---------------------------------------------------------------- people

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'personne';
}

async function addPerson(bucket: R2Bucket, body: Record<string, unknown>): Promise<Person> {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 60) throw new HttpError(400, 'Name must be 1-60 characters');
  let result: Person | undefined;
  await updateJson<PeopleFile>(
    bucket,
    PEOPLE_KEY,
    () => ({ v: 1, people: [] }),
    (file) => {
      const existing = file.people.find((p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        result = existing;
        return null;
      }
      const base = slugify(name);
      let id = base;
      for (let n = 2; file.people.some((p) => p.id === id); n++) id = `${base}-${n}`;
      result = { id, name };
      const people = [...file.people, result].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      return { ...file, people };
    },
  );
  return result!;
}

async function knownPersonIds(bucket: R2Bucket): Promise<Set<string>> {
  const file = await readJson<PeopleFile>(bucket, PEOPLE_KEY);
  return new Set(file?.people.map((p) => p.id) ?? []);
}

/** Validate a list of person ids. With `known`, every id must also exist in people.json. */
function personIdList(value: unknown, known: Set<string> | null, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, `${field} must be a list`);
  for (const id of value) {
    if (typeof id !== 'string' || !PERSON_ID_RE.test(id) || (known && !known.has(id))) {
      throw new HttpError(400, `Unknown person in ${field}`);
    }
  }
  return [...new Set(value as string[])];
}

// ---------------------------------------------------------------- photos

async function getMeta(bucket: R2Bucket, id: string): Promise<PhotoMeta> {
  const meta = await readJson<PhotoMeta>(bucket, metaKey(id));
  if (!meta) throw new HttpError(404, 'Photo not found');
  return meta;
}

async function uploadVariant(request: Request, bucket: R2Bucket, id: string, variant: Variant) {
  const length = Number(request.headers.get('Content-Length'));
  if (!request.body || !Number.isFinite(length) || length <= 0) throw new HttpError(411, 'Content-Length required');
  if (length > MAX_BYTES[variant]) throw new HttpError(413, 'File too large');
  const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const allowed = variant === 'original' ? ORIGINAL_TYPES.has(contentType) : contentType === 'image/jpeg';
  if (!allowed) throw new HttpError(415, `Unsupported type: ${contentType || 'none'}`);
  // Images of a finalized photo are immutable (ids are content hashes).
  if (await bucket.head(metaKey(id))) throw new HttpError(409, 'Photo already exists');

  await bucket.put(imageKey(variant, id), request.body, { httpMetadata: { contentType } });
  return json({ ok: true }, 201);
}

function validateCreate(body: Record<string, unknown>): CreatePhotoRequest {
  const { takenAt, dateSource, width, height, originalName } = body;
  if (typeof takenAt !== 'string' || !LOCAL_DATETIME_RE.test(takenAt)) throw new HttpError(400, 'Bad takenAt');
  if (dateSource !== 'exif' && dateSource !== 'upload') throw new HttpError(400, 'Bad dateSource');
  const dim = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 20000;
  if (!dim(width) || !dim(height)) throw new HttpError(400, 'Bad dimensions');
  if (typeof originalName !== 'string' || originalName.length > 255) throw new HttpError(400, 'Bad originalName');
  return { takenAt, dateSource, width: width as number, height: height as number, originalName, people: body.people as string[] };
}

async function createPhoto(bucket: R2Bucket, id: string, body: Record<string, unknown>, user: string) {
  const req = validateCreate(body);
  const people = req.people === undefined ? [] : personIdList(req.people, await knownPersonIds(bucket), 'people');

  const existing = await readJson<PhotoMeta>(bucket, metaKey(id));
  if (existing) return json({ ...existing, duplicate: true }, 200);

  const [original, display, thumb] = await Promise.all(VARIANTS.map((v) => bucket.head(imageKey(v, id))));
  if (!original || !display || !thumb) throw new HttpError(400, 'Upload all image variants first');

  const now = new Date().toISOString();
  const meta: PhotoMeta = {
    id,
    takenAt: req.takenAt,
    dateSource: req.dateSource,
    width: req.width,
    height: req.height,
    people,
    caption: '',
    original: {
      name: req.originalName,
      contentType: original.httpMetadata?.contentType ?? 'application/octet-stream',
      size: original.size,
    },
    uploadedAt: now,
    uploadedBy: user,
    history: [{ at: now, by: user, action: 'upload' }],
    comments: [],
  };
  await bucket.put(metaKey(id), JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } });
  await upsertIndexEntry(bucket, meta);
  return json(meta, 201);
}

async function updatePhoto(bucket: R2Bucket, id: string, body: Record<string, unknown>, user: string) {
  const req = body as UpdatePhotoRequest;
  const add = req.addPeople === undefined ? [] : personIdList(req.addPeople, await knownPersonIds(bucket), 'addPeople');
  // Removing someone who is no longer in people.json must stay possible, so only check the format.
  const remove = personIdList(req.removePeople, null, 'removePeople');
  if (req.takenAt !== undefined && (typeof req.takenAt !== 'string' || !LOCAL_DATETIME_RE.test(req.takenAt))) {
    throw new HttpError(400, 'Bad takenAt');
  }
  if (req.caption !== undefined && (typeof req.caption !== 'string' || req.caption.length > 2000)) {
    throw new HttpError(400, 'Bad caption');
  }

  const meta = await updateJson<PhotoMeta>(
    bucket,
    metaKey(id),
    () => {
      throw new HttpError(404, 'Photo not found');
    },
    (m) => {
      const changes: string[] = [];
      let people = m.people;
      for (const p of add) if (!people.includes(p)) (people = [...people, p]), changes.push(`+${p}`);
      for (const p of remove) if (people.includes(p)) (people = people.filter((x) => x !== p)), changes.push(`-${p}`);
      let { takenAt, dateSource, caption } = m;
      if (req.takenAt !== undefined && req.takenAt !== takenAt) {
        takenAt = req.takenAt;
        dateSource = 'manual';
        changes.push(`date:${takenAt}`);
      }
      if (req.caption !== undefined && req.caption.trim() !== caption) {
        caption = req.caption.trim();
        changes.push('caption');
      }
      if (changes.length === 0) return null;
      const entry: HistoryEntry = { at: new Date().toISOString(), by: user, action: changes.join(' ') };
      const history = [...m.history, entry].slice(-HISTORY_MAX);
      return { ...m, people, takenAt, dateSource, caption, history };
    },
  );
  await upsertIndexEntry(bucket, meta);
  return meta;
}

// ---------------------------------------------------------------- display names & comments

/** The name someone chose, or, in shared-password mode, the name they signed in with. */
async function displayName(bucket: R2Bucket, user: string): Promise<string | null> {
  const members = await readJson<MembersFile>(bucket, MEMBERS_KEY);
  return members?.names[user] ?? (user.includes('@') ? null : user);
}

async function setDisplayName(bucket: R2Bucket, user: string, body: Record<string, unknown>): Promise<string> {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > NAME_MAX) throw new HttpError(400, `Name must be 1-${NAME_MAX} characters`);
  await updateJson<MembersFile>(
    bucket,
    MEMBERS_KEY,
    () => ({ v: 1, names: {} }),
    (file) => (file.names[user] === name ? null : { ...file, names: { ...file.names, [user]: name } }),
  );
  return name;
}

async function addComment(bucket: R2Bucket, id: string, body: Record<string, unknown>, user: string) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > COMMENT_MAX) throw new HttpError(400, `Comment must be 1-${COMMENT_MAX} characters`);
  const name = await displayName(bucket, user);
  if (!name) throw new HttpError(400, 'Choose a display name first');
  const comment: Comment = { id: crypto.randomUUID(), by: user, name, at: new Date().toISOString(), text };
  const meta = await updateJson<PhotoMeta>(
    bucket,
    metaKey(id),
    () => {
      throw new HttpError(404, 'Photo not found');
    },
    (m) => {
      const comments = m.comments ?? [];
      if (comments.length >= COMMENTS_MAX) throw new HttpError(409, 'Too many comments on this photo');
      return { ...m, comments: [...comments, comment] };
    },
  );
  await upsertIndexEntry(bucket, meta);
  return meta;
}

async function deleteComment(bucket: R2Bucket, id: string, commentId: string, user: string) {
  if (!COMMENT_ID_RE.test(commentId)) throw new HttpError(400, 'Bad comment id');
  const meta = await updateJson<PhotoMeta>(
    bucket,
    metaKey(id),
    () => {
      throw new HttpError(404, 'Photo not found');
    },
    (m) => {
      const comment = m.comments?.find((c) => c.id === commentId);
      if (!comment) return null; // already gone: nothing to do
      if (comment.by !== user) throw new HttpError(403, 'Only the author can delete a comment');
      return { ...m, comments: m.comments!.filter((c) => c.id !== commentId) };
    },
  );
  await upsertIndexEntry(bucket, meta);
  return meta;
}

async function upsertIndexEntry(bucket: R2Bucket, meta: PhotoMeta) {
  const entry = toTimelineEntry(meta);
  await updateJson<TimelineIndex>(
    bucket,
    INDEX_KEY,
    () => ({ v: 1, photos: [] }),
    (index) => {
      const old = index.photos.find((p) => p.id === meta.id);
      if (old && JSON.stringify(old) === JSON.stringify(entry)) return null;
      const photos = index.photos.filter((p) => p.id !== meta.id);
      photos.push(entry);
      photos.sort(compareEntries);
      return { ...index, photos };
    },
  );
}

/** Regenerate index.json from every meta/<id>.json. Safe to run any time. */
export async function rebuildIndex(bucket: R2Bucket): Promise<number> {
  const metas: PhotoMeta[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: META_PREFIX, cursor });
    const batch = await Promise.all(page.objects.map((o) => readJson<PhotoMeta>(bucket, o.key)));
    for (const m of batch) if (m) metas.push(m);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const index: TimelineIndex = { v: 1, photos: metas.map(toTimelineEntry).sort(compareEntries) };
  await bucket.put(INDEX_KEY, JSON.stringify(index), { httpMetadata: { contentType: 'application/json' } });
  return index.photos.length;
}

// ---------------------------------------------------------------- images

async function serveImage(request: Request, bucket: R2Bucket, id: string, variant: Variant, url: URL) {
  const obj = await bucket.get(imageKey(variant, id), { onlyIf: request.headers });
  if (!obj) throw new HttpError(404, 'Image not found');
  const headers = new Headers({
    ETag: obj.httpEtag,
    // Ids are content hashes, so an image never changes: cache it forever, but only in this browser.
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  if (variant === 'original' && url.searchParams.has('download')) {
    const meta = await readJson<PhotoMeta>(bucket, metaKey(id));
    const name = meta?.original.name || `${id}.jpg`;
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  if (request.method === 'HEAD') return new Response(null, { headers });
  return new Response(obj.body, { headers });
}
