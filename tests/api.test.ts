import { beforeEach, describe, expect, it } from 'vitest';
import { backfillUploadDates, handleApi, rebuildIndex, slugify } from '../server/api';
import type { Env } from '../server/env';
import { INDEX_KEY, metaKey } from '../server/storage';
import type { PeopleFile, PhotoMeta, TimelineIndex } from '../shared/types';
import { FakeR2, asBucket } from './fake-r2';

const ID = 'a'.repeat(20);
const ID2 = 'b'.repeat(20);
let r2: FakeR2;
let env: Env;

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, user = 'mamie@example.com') {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body instanceof Uint8Array) {
    init.body = body;
    (init.headers as Record<string, string>)['Content-Length'] = String(body.byteLength);
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return handleApi(new Request(`https://album.test/api/${path}`, init), env, user);
}

async function uploadPhoto(id: string, takenAt = '2019-07-14T15:32:10') {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
  for (const v of ['thumb', 'display'] as const) {
    expect((await req('PUT', `photos/${id}/${v}`, bytes, { 'Content-Type': 'image/jpeg' })).status).toBe(201);
  }
  expect((await req('PUT', `photos/${id}/original`, bytes, { 'Content-Type': 'image/heic' })).status).toBe(201);
  const res = await req('POST', `photos/${id}`, {
    takenAt,
    dateSource: 'exif',
    width: 2048,
    height: 1536,
    originalName: 'IMG_0001.HEIC',
  });
  return res;
}

beforeEach(() => {
  r2 = new FakeR2();
  env = { PHOTOS: asBucket(r2) };
});

describe('timeline', () => {
  it('is empty before any upload', async () => {
    const res = await req('GET', 'timeline');
    expect(await res.json()).toEqual({ v: 1, photos: [] });
  });

  it('lists uploaded photos newest first', async () => {
    expect((await uploadPhoto(ID, '1985-06-01T10:00:00')).status).toBe(201);
    expect((await uploadPhoto(ID2, '2020-01-01T10:00:00')).status).toBe(201);
    const index = (await (await req('GET', 'timeline')).json()) as TimelineIndex;
    expect(index.photos.map((p) => p.id)).toEqual([ID2, ID]);
    expect(index.photos[1]).toEqual({ id: ID, t: '1985-06-01T10:00:00', w: 2048, h: 1536, p: [], u: expect.any(String) });
  });

  it('answers 304 when the index has not changed', async () => {
    await uploadPhoto(ID);
    const first = await req('GET', 'timeline');
    const etag = first.headers.get('ETag')!;
    const second = await req('GET', 'timeline', undefined, { 'If-None-Match': etag });
    expect(second.status).toBe(304);
  });
});

describe('upload', () => {
  it('stores metadata with the uploader and original info', async () => {
    const meta = (await (await uploadPhoto(ID)).json()) as PhotoMeta;
    expect(meta.uploadedBy).toBe('mamie@example.com');
    expect(meta.original).toEqual({ name: 'IMG_0001.HEIC', contentType: 'image/heic', size: 6 });
    expect(meta.dateSource).toBe('exif');
  });

  it('refuses to finalize before all variants are uploaded', async () => {
    const res = await req('POST', `photos/${ID}`, {
      takenAt: '2019-07-14T15:32:10',
      dateSource: 'exif',
      width: 10,
      height: 10,
      originalName: 'x.jpg',
    });
    expect(res.status).toBe(400);
  });

  it('reports a duplicate instead of creating it twice', async () => {
    await uploadPhoto(ID);
    const again = await req('POST', `photos/${ID}`, {
      takenAt: '2000-01-01T00:00:00',
      dateSource: 'upload',
      width: 10,
      height: 10,
      originalName: 'x.jpg',
    });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { duplicate: boolean }).duplicate).toBe(true);
  });

  it('does not let images of an existing photo be overwritten', async () => {
    await uploadPhoto(ID);
    const res = await req('PUT', `photos/${ID}/display`, new Uint8Array([1]), { 'Content-Type': 'image/jpeg' });
    expect(res.status).toBe(409);
  });

  it('rejects dangerous or wrong content types', async () => {
    const bytes = new Uint8Array([1]);
    expect((await req('PUT', `photos/${ID}/original`, bytes, { 'Content-Type': 'image/svg+xml' })).status).toBe(415);
    expect((await req('PUT', `photos/${ID}/thumb`, bytes, { 'Content-Type': 'image/png' })).status).toBe(415);
    expect((await req('PUT', `photos/${ID}/original`, bytes, { 'Content-Type': 'text/html' })).status).toBe(415);
  });

  it('rejects bad ids and bad dates', async () => {
    expect((await req('GET', 'photos/../index')).status).toBe(404);
    expect((await req('GET', 'photos/XYZ')).status).toBe(400);
    const res = await req('POST', `photos/${ID}`, { takenAt: 'yesterday', dateSource: 'exif', width: 1, height: 1, originalName: 'a' });
    expect(res.status).toBe(400);
  });

  it('serves images with long-lived private caching and nosniff', async () => {
    await uploadPhoto(ID);
    const res = await req('GET', `photos/${ID}/thumb`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const dl = await req('GET', `photos/${ID}/original?download=1`);
    expect(dl.headers.get('Content-Disposition')).toContain('IMG_0001.HEIC');
  });
});

describe('people and tagging', () => {
  it('adds people once, case-insensitively, with readable ids', async () => {
    const a = await (await req('POST', 'people', { name: '  Mamie   Jeanne ' })).json();
    const b = await (await req('POST', 'people', { name: 'mamie jeanne' })).json();
    const c = (await (await req('POST', 'people', { name: 'Mamie-Jeanne' })).json()) as { id: string };
    expect(a).toEqual({ id: 'mamie-jeanne', name: 'Mamie Jeanne' });
    expect(b).toEqual(a);
    expect(c.id).toBe('mamie-jeanne-2');
    const file = (await (await req('GET', 'people')).json()) as PeopleFile;
    expect(file.people).toHaveLength(2);
  });

  it('tags and untags, updating meta, index and history', async () => {
    await uploadPhoto(ID);
    await req('POST', 'people', { name: 'Léa' });
    await req('POST', 'people', { name: 'Paul' });

    let meta = (await (await req('PATCH', `photos/${ID}`, { addPeople: ['lea', 'paul'] })).json()) as PhotoMeta;
    expect(meta.people).toEqual(['lea', 'paul']);
    meta = (await (await req('PATCH', `photos/${ID}`, { removePeople: ['lea'] })).json()) as PhotoMeta;
    expect(meta.people).toEqual(['paul']);
    expect(meta.history.map((h) => h.action)).toEqual(['upload', '+lea +paul', '-lea']);
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos[0].p).toEqual(['paul']);
  });

  it('refuses tags for people who do not exist', async () => {
    await uploadPhoto(ID);
    expect((await req('PATCH', `photos/${ID}`, { addPeople: ['nobody'] })).status).toBe(400);
  });

  it('does not lose a tag when two people tag the same photo at the same time', async () => {
    await uploadPhoto(ID);
    await req('POST', 'people', { name: 'Léa' });
    await req('POST', 'people', { name: 'Paul' });
    // Simulate: while the first PATCH is between its read and its write, the second one lands.
    let raced = false;
    r2.beforePut = async (key) => {
      if (key === `meta/${ID}.json` && !raced) {
        raced = true;
        r2.beforePut = undefined;
        await req('PATCH', `photos/${ID}`, { addPeople: ['paul'] });
      }
    };
    const res = await req('PATCH', `photos/${ID}`, { addPeople: ['lea'] });
    expect(res.status).toBe(200);
    const meta = (await (await req('GET', `photos/${ID}`)).json()) as PhotoMeta;
    expect(meta.people.sort()).toEqual(['lea', 'paul']);
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos[0].p.sort()).toEqual(['lea', 'paul']);
  });

  it('marks a corrected date as manual and re-sorts the timeline', async () => {
    await uploadPhoto(ID, '2024-01-01T00:00:00');
    await uploadPhoto(ID2, '2023-01-01T00:00:00');
    const meta = (await (await req('PATCH', `photos/${ID}`, { takenAt: '1962-05-12T00:00:00' })).json()) as PhotoMeta;
    expect(meta.dateSource).toBe('manual');
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos.map((p) => p.id)).toEqual([ID2, ID]);
  });
});

describe('rebuildIndex', () => {
  it('regenerates index.json from the per-photo metadata', async () => {
    await uploadPhoto(ID, '2001-01-01T00:00:00');
    await uploadPhoto(ID2, '2002-01-01T00:00:00');
    await uploadPhoto('c'.repeat(20), '2003-01-01T00:00:00');
    await r2.delete(INDEX_KEY);
    expect(await rebuildIndex(asBucket(r2))).toBe(3);
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos.map((p) => p.t.slice(0, 4))).toEqual(['2003', '2002', '2001']);
  });
});

describe('slugify', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('Grand-père Émile')).toBe('grand-pere-emile');
    expect(slugify('!!!')).toBe('personne');
  });
});

describe('display names and comments', () => {
  const asPapi = (method: string, path: string, body?: unknown) => req(method, path, body, {}, 'papi@example.com');

  it('stores the display name each person chooses', async () => {
    expect(await (await req('GET', 'me')).json()).toEqual({ user: 'mamie@example.com', name: null });
    await req('PUT', 'me', { name: '  Mamie   Rose ' });
    expect(await (await req('GET', 'me')).json()).toEqual({ user: 'mamie@example.com', name: 'Mamie Rose' });
    expect((await req('PUT', 'me', { name: '' })).status).toBe(400);
  });

  it('asks for a display name before the first comment', async () => {
    await uploadPhoto(ID);
    const res = await req('POST', `photos/${ID}/comments`, { text: 'Coucou' });
    expect(res.status).toBe(400);
  });

  it('adds comments, counts them in the timeline, and lets only the author delete', async () => {
    await uploadPhoto(ID);
    await req('PUT', 'me', { name: 'Mamie' });
    await asPapi('PUT', 'me', { name: 'Papi' });

    let meta = (await (await req('POST', `photos/${ID}/comments`, { text: '  Quel beau Noël !  ' })).json()) as PhotoMeta;
    meta = (await (await asPapi('POST', `photos/${ID}/comments`, { text: 'On était 14 à table.' })).json()) as PhotoMeta;
    expect(meta.comments!.map((c) => [c.name, c.text])).toEqual([
      ['Mamie', 'Quel beau Noël !'],
      ['Papi', 'On était 14 à table.'],
    ]);
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos[0].c).toBe(2);

    const mamies = meta.comments![0].id;
    expect((await asPapi('DELETE', `photos/${ID}/comments/${mamies}`)).status).toBe(403);
    meta = (await (await req('DELETE', `photos/${ID}/comments/${mamies}`)).json()) as PhotoMeta;
    expect(meta.comments!.map((c) => c.name)).toEqual(['Papi']);
    expect((r2.json(INDEX_KEY) as TimelineIndex).photos[0].c).toBe(1);
  });

  it('rejects empty or overly long comments', async () => {
    await uploadPhoto(ID);
    await req('PUT', 'me', { name: 'Mamie' });
    expect((await req('POST', `photos/${ID}/comments`, { text: '   ' })).status).toBe(400);
    expect((await req('POST', `photos/${ID}/comments`, { text: 'x'.repeat(2001) })).status).toBe(400);
  });

  it('keeps both comments when two people post at the same time', async () => {
    await uploadPhoto(ID);
    await req('PUT', 'me', { name: 'Mamie' });
    await asPapi('PUT', 'me', { name: 'Papi' });
    let raced = false;
    r2.beforePut = async (key) => {
      if (key === `meta/${ID}.json` && !raced) {
        raced = true;
        r2.beforePut = undefined;
        await asPapi('POST', `photos/${ID}/comments`, { text: 'Papi was here' });
      }
    };
    await req('POST', `photos/${ID}/comments`, { text: 'Mamie was here' });
    const meta = (await (await req('GET', `photos/${ID}`)).json()) as PhotoMeta;
    expect(meta.comments!.map((c) => c.text).sort()).toEqual(['Mamie was here', 'Papi was here']);
  });

  it('works on photos saved before comments existed', async () => {
    await uploadPhoto(ID);
    const old = r2.json(metaKey(ID)) as PhotoMeta;
    delete old.comments;
    await r2.put(metaKey(ID), JSON.stringify(old));
    await req('PUT', 'me', { name: 'Mamie' });
    const res = await req('POST', `photos/${ID}/comments`, { text: 'Toujours là' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as PhotoMeta).comments).toHaveLength(1);
  });
});

describe('shared-password mode', () => {
  it('uses the sign-in name as display name', async () => {
    const res = await handleApi(new Request('https://album.test/api/me'), env, 'Tante Hélène');
    expect(await res.json()).toEqual({ user: 'Tante Hélène', name: 'Tante Hélène' });
  });
});

describe('upload dates in the timeline', () => {
  it('records when each photo was added', async () => {
    await uploadPhoto(ID);
    const entry = (r2.json(INDEX_KEY) as TimelineIndex).photos[0];
    expect(entry.u).toBe((r2.json(metaKey(ID)) as PhotoMeta).uploadedAt);
  });

  it('fills in missing dates on old index entries, in batches', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(20));
    for (const id of ids) await uploadPhoto(id);
    // Simulate an index written before upload dates existed.
    const old = r2.json(INDEX_KEY) as TimelineIndex;
    await r2.put(INDEX_KEY, JSON.stringify({ ...old, photos: old.photos.map(({ u, ...rest }) => rest) }));

    expect(await backfillUploadDates(asBucket(r2), 2)).toBe(3);
    expect(await backfillUploadDates(asBucket(r2), 2)).toBe(1);
    expect(await backfillUploadDates(asBucket(r2), 2)).toBe(0);
    const photos = (r2.json(INDEX_KEY) as TimelineIndex).photos;
    for (const p of photos) expect(p.u).toBe((r2.json(metaKey(p.id)) as PhotoMeta).uploadedAt);
    const res = await req('POST', 'admin/backfill-uploads');
    expect(await res.json()).toEqual({ remaining: 0 });
  });
});
