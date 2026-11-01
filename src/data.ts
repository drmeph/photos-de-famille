// App-wide data: the timeline index, the people list, and the upload queue.
import { compareEntries, toTimelineEntry, type Person, type PhotoMeta, type TimelineEntry } from '../shared/types';
import { api, type Me } from './api';
import { preparePhoto } from './lib/image';
import { createStore } from './lib/store';

export type LoadState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

export const timeline = createStore<LoadState<TimelineEntry[]>>({ status: 'loading' });
export const people = createStore<Person[]>([]);
export const me = createStore<Me | null>(null);
/** Display name each family member chose, by sign-in identity (email). */
export const members = createStore<Record<string, string>>({});

export async function loadMembers() {
  try {
    members.set((await api.members()).names);
  } catch {
    // Non-fatal: names fall back to the start of the email address.
  }
}

/** The name to show for a sign-in identity: the one they chose, else the part of the email before "@". */
export function displayName(user: string, names: Record<string, string>): string {
  return names[user] ?? user.split('@')[0];
}

export async function loadMe() {
  try {
    me.set(await api.me());
  } catch {
    // Non-fatal: comments will ask again when needed.
  }
}

export async function setMyName(name: string) {
  const updated = await api.setName(name);
  me.set(updated);
  if (updated.name) members.set((names) => ({ ...names, [updated.user]: updated.name! }));
}

export async function loadTimeline() {
  try {
    const index = await api.timeline();
    timeline.set({ status: 'ready', data: index.photos });
    if (index.photos.some((p) => !p.u || !p.b)) void backfillUploadInfo();
  } catch {
    // Keep showing what we have if this was only a refresh.
    if (timeline.get().status !== 'ready') timeline.set({ status: 'error' });
  }
}

let backfilling = false;

/** Albums started before "latest additions" existed lack the upload date and uploader in the
 *  timeline index. Ask the server to fill them in, a batch at a time, then reload. Runs once
 *  per session. */
async function backfillUploadInfo() {
  if (backfilling) return;
  backfilling = true;
  try {
    let previous = Infinity;
    for (;;) {
      const { remaining } = await api.backfillUploads();
      if (remaining === 0 || remaining >= previous) break; // done, or stuck: stop either way
      previous = remaining;
    }
    const index = await api.timeline();
    timeline.set({ status: 'ready', data: index.photos });
  } catch {
    backfilling = false; // try again on the next load
  }
}

export async function loadPeople() {
  try {
    people.set((await api.people()).people);
  } catch {
    // Non-fatal: tagging chips just stay empty until the next load.
  }
}

export async function addPerson(name: string): Promise<Person> {
  const person = await api.addPerson(name);
  people.set((list) =>
    list.some((p) => p.id === person.id)
      ? list
      : [...list, person].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );
  return person;
}

/** Reflect a photo change in the timeline right away, without refetching index.json. */
export function patchTimeline(meta: PhotoMeta) {
  const state = timeline.get();
  if (state.status !== 'ready') return;
  const data = [...state.data.filter((e) => e.id !== meta.id), toTimelineEntry(meta)].sort(compareEntries);
  timeline.set({ status: 'ready', data });
}

// ---------------------------------------------------------------- uploads

export interface UploadItem {
  key: number;
  file: File;
  status: 'waiting' | 'preparing' | 'uploading' | 'done' | 'duplicate' | 'failed';
  progress: number; // 0..1 while uploading
  id?: string;
  preview?: string; // object URL of the thumbnail
}

export const uploads = createStore<UploadItem[]>([]);
let nextKey = 1;
let running = false;

const isActive = (u: UploadItem) => u.status === 'waiting' || u.status === 'preparing' || u.status === 'uploading';
export const isUploading = () => uploads.get().some(isActive);

export function enqueueUploads(files: FileList | File[]) {
  const items: UploadItem[] = Array.from(files)
    .filter((f) => f.type.startsWith('image/') || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name))
    .map((file) => ({ key: nextKey++, file, status: 'waiting', progress: 0 }));
  uploads.set((list) => [...list, ...items]);
  void runQueue();
}

export function retryUpload(key: number) {
  updateItem(key, { status: 'waiting', progress: 0 });
  void runQueue();
}

export function clearFinishedUploads() {
  uploads.get().forEach((u) => !isActive(u) && u.preview && URL.revokeObjectURL(u.preview));
  uploads.set((list) => list.filter(isActive));
}

function updateItem(key: number, patch: Partial<UploadItem>) {
  uploads.set((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
}

/** One photo at a time: phones run out of memory decoding several big photos at once. */
async function runQueue() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const item = uploads.get().find((u) => u.status === 'waiting');
      if (!item) break;
      try {
        updateItem(item.key, { status: 'preparing' });
        const prepared = await preparePhoto(item.file);
        updateItem(item.key, { id: prepared.id, preview: item.preview ?? URL.createObjectURL(prepared.thumb) });
        if (await api.findPhoto(prepared.id)) {
          updateItem(item.key, { status: 'duplicate' });
          continue;
        }
        updateItem(item.key, { status: 'uploading' });
        const meta = await api.upload(prepared, (progress) => updateItem(item.key, { progress }));
        updateItem(item.key, { status: 'done', progress: 1 });
        patchTimeline(meta);
      } catch (err) {
        console.error(err);
        updateItem(item.key, { status: 'failed' });
      }
    }
  } finally {
    running = false;
  }
}
