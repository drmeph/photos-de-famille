// Just enough of the R2Bucket API for the server code, including conditional
// puts (etagMatches) and If-None-Match on get.

interface Stored {
  key: string;
  data: Uint8Array;
  etag: string;
  contentType?: string;
}

let etagCounter = 0;

function makeObject(s: Stored, withBody: boolean) {
  const base = {
    key: s.key,
    size: s.data.byteLength,
    etag: s.etag,
    httpEtag: `"${s.etag}"`,
    httpMetadata: { contentType: s.contentType },
  };
  if (!withBody) return base;
  return {
    ...base,
    body: new Response(s.data).body,
    json: async () => JSON.parse(new TextDecoder().decode(s.data)),
    text: async () => new TextDecoder().decode(s.data),
  };
}

async function toBytes(value: unknown): Promise<Uint8Array> {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ReadableStream) return new Uint8Array(await new Response(value).arrayBuffer());
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error('unsupported body');
}

export class FakeR2 {
  objects = new Map<string, Stored>();
  /** Called before each conditional put lands: lets tests simulate a concurrent writer. */
  beforePut?: (key: string) => void | Promise<void>;

  async get(key: string, opts?: { onlyIf?: Headers | { etagMatches?: string } }) {
    const s = this.objects.get(key);
    if (!s) return null;
    if (opts?.onlyIf instanceof Headers) {
      const inm = opts.onlyIf.get('If-None-Match');
      if (inm && inm.replace(/"/g, '') === s.etag) return makeObject(s, false);
    }
    return makeObject(s, true);
  }

  async head(key: string) {
    const s = this.objects.get(key);
    return s ? makeObject(s, false) : null;
  }

  async put(key: string, value: unknown, opts?: { onlyIf?: { etagMatches?: string }; httpMetadata?: { contentType?: string } }) {
    const data = await toBytes(value);
    await this.beforePut?.(key);
    const existing = this.objects.get(key);
    const cond = opts?.onlyIf;
    if (cond && !(cond instanceof Headers) && cond.etagMatches !== undefined) {
      if (!existing || existing.etag !== cond.etagMatches) return null;
    }
    const stored: Stored = { key, data, etag: `e${++etagCounter}`, contentType: opts?.httpMetadata?.contentType };
    this.objects.set(key, stored);
    return makeObject(stored, false);
  }

  async delete(key: string) {
    this.objects.delete(key);
  }

  async list(opts: { prefix?: string; cursor?: string }) {
    const keys = [...this.objects.keys()].filter((k) => k.startsWith(opts.prefix ?? '')).sort();
    const start = opts.cursor ? Number(opts.cursor) : 0;
    const page = keys.slice(start, start + 2); // tiny pages to exercise pagination
    const truncated = start + 2 < keys.length;
    return {
      objects: page.map((k) => makeObject(this.objects.get(k)!, false)),
      truncated,
      cursor: truncated ? String(start + 2) : undefined,
    };
  }

  json(key: string) {
    const s = this.objects.get(key);
    return s ? JSON.parse(new TextDecoder().decode(s.data)) : undefined;
  }
}

export const asBucket = (fake: FakeR2) => fake as unknown as R2Bucket;
