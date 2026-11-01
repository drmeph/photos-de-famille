import type {
  CreatePhotoRequest,
  PeopleFile,
  Person,
  PhotoMeta,
  TimelineIndex,
  UpdatePhotoRequest,
  Variant,
} from '../shared/types';
import type { PreparedPhoto } from './lib/image';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const sendJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Who is signed in, and the name they chose to show with their comments (null until chosen). */
export interface Me {
  user: string;
  name: string | null;
}

export const imageUrl = (id: string, variant: Variant) => `/api/photos/${id}/${variant}`;

export const api = {
  me: () => call<Me>('me'),
  setName: (name: string) => call<Me>('me', sendJson('PUT', { name })),
  addComment: (id: string, text: string) => call<PhotoMeta>(`photos/${id}/comments`, sendJson('POST', { text })),
  deleteComment: (id: string, commentId: string) =>
    call<PhotoMeta>(`photos/${id}/comments/${commentId}`, { method: 'DELETE' }),
  timeline: () => call<TimelineIndex>('timeline'),
  backfillUploads: () => call<{ remaining: number }>('admin/backfill-uploads', { method: 'POST' }),
  people: () => call<PeopleFile>('people'),
  addPerson: (name: string) => call<Person>('people', sendJson('POST', { name })),
  photo: (id: string) => call<PhotoMeta>(`photos/${id}`),
  updatePhoto: (id: string, update: UpdatePhotoRequest) => call<PhotoMeta>(`photos/${id}`, sendJson('PATCH', update)),

  /** Returns the existing photo if this exact file was already uploaded. */
  async findPhoto(id: string): Promise<PhotoMeta | null> {
    try {
      return await api.photo(id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async upload(p: PreparedPhoto, onProgress: (fraction: number) => void): Promise<PhotoMeta> {
    const parts: [Variant, Blob, string][] = [
      ['thumb', p.thumb, 'image/jpeg'],
      ['display', p.display, 'image/jpeg'],
      ['original', p.original, p.originalType],
    ];
    const total = parts.reduce((n, [, b]) => n + b.size, 0);
    let done = 0;
    for (const [variant, blob, type] of parts) {
      await putWithProgress(`/api/photos/${p.id}/${variant}`, blob, type, (loaded) =>
        onProgress((done + loaded) / total),
      );
      done += blob.size;
    }
    const body: CreatePhotoRequest = {
      takenAt: p.takenAt,
      dateSource: p.dateSource,
      width: p.width,
      height: p.height,
      originalName: p.original.name,
    };
    return call<PhotoMeta>(`photos/${p.id}`, sendJson('POST', body));
  },
};

/** fetch() can't report upload progress, so use XHR for the big files. */
function putWithProgress(url: string, blob: Blob, type: string, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', type);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = xhr.statusText;
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {
        // not JSON
      }
      reject(new ApiError(xhr.status, message));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error'));
    xhr.send(blob);
  });
}
