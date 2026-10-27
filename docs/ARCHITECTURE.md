# Architecture

```
 phone / computer                         Cloudflare
┌──────────────────────┐   HTTPS   ┌───────────────────────────────────────────┐
│ Static app (Preact)  │──────────▶│ Cloudflare Access  (who are you?)         │
│ - resize to JPEG     │           │        │                                  │
│ - read EXIF date     │           │ Pages: static files (dist/)               │
│ - HEIC → JPEG (wasm) │           │ Pages Functions: /api/*  ── R2 bucket     │
│ - SHA-256 → photo id │           │   (auth re-checked)        images + JSON  │
└──────────────────────┘           └───────────────────────────────────────────┘
```

## Choices and why

| Choice | Why |
|---|---|
| **Cloudflare Pages + Pages Functions** | Static hosting plus a few small API routes in one deploy. Scales to zero; the free plan covers a family. |
| **R2** for images *and* metadata | One storage service, no database to run. No egress fees, so browsing the album costs nothing. |
| **Image processing in the browser** | The phone makes the display (2048 px) and thumbnail (480 px) JPEGs, so the server never decodes an image and stays within the free-plan CPU limits. The original file is kept untouched. |
| **Preact + Vite + TypeScript** | Familiar React-style components in a 15 KB (gzipped) bundle. One standard build command. |
| **Hash routes** (`#/photo/…`) | Work on any static host. The phone's Back button behaves as expected. |
| **Content-hash photo ids** | The id is the first 20 hex chars of SHA-256(original). If Grandma uploads the same photo twice, it's detected and skipped. Images never change, so browsers cache them forever. |
| **Cloudflare Access** | Email one-time codes: no passwords for relatives to forget. Free for up to 50 users. |

## Storage layout (R2)

```
originals/<id>     file exactly as uploaded (JPEG, HEIC, PNG…)
display/<id>       JPEG, long edge ≤ 2048 px  (photo page)
thumbs/<id>        JPEG, long edge ≤ 480 px   (timeline)
meta/<id>.json     PhotoMeta: source of truth for one photo
index.json         TimelineIndex: every photo, newest first (derived from meta/)
people.json        list of family members that can be tagged
```

Types are in [`shared/types.ts`](../shared/types.ts). Dates are stored as wall-clock time
without a timezone (`"1985-12-24T20:15:00"`), the way EXIF records them. Plain string
comparison sorts them correctly.

The browser downloads `index.json` once, then does timeline grouping and person/year
filtering locally. Each photo is about 80 bytes in the index, so 5,000 photos is about 400 KB,
revalidated with an ETag.

## Upload flow

1. The user picks files. For each file, one at a time to save phone memory:
   hash → read EXIF date → decode (native, or libheif WASM for HEIC on Chrome/Firefox) →
   draw into a 2048 px canvas → 480 px thumbnail.
2. `GET /api/photos/<id>`: if the photo exists, show "already in the album".
3. `PUT /api/photos/<id>/thumb`, `/display`, `/original`: raw bodies streamed straight into R2.
   There's no multipart parsing, so the Worker uses almost no CPU.
4. `POST /api/photos/<id>` with `{takenAt, dateSource, width, height, originalName}` writes
   `meta/<id>.json` and adds the photo to `index.json`.

Images of a finalized photo can't be overwritten (409).

## Concurrent edits

There's no database, so writes to `index.json`, `people.json` and `meta/<id>.json` use
**optimistic concurrency**: read the object and its etag, change it, write it back with
`onlyIf: { etagMatches }`, and retry if someone else wrote first
([`server/storage.ts`](../server/storage.ts)).

Tag changes are sent as operations (`addPeople` / `removePeople`), not as the full list. If
two people tag the same photo at the same time, both tags are kept (there's a test for this).
Each photo keeps its last 50 changes (`history`) so a mistake can be traced and undone.

If `index.json` ever gets out of sync, regenerate it from `meta/`:
`POST /api/admin/rebuild-index`. For example, run
`fetch('/api/admin/rebuild-index', {method:'POST'})` in the browser console while signed in.

## Security

- `functions/_middleware.ts` authenticates **every** request, static files included. It
  verifies the Access JWT signature, audience, issuer and expiry, so going around Access
  through `*.pages.dev` doesn't work. If no auth is configured, it refuses everything.
- Only image types are accepted. SVG is rejected because it can carry scripts. Images are
  served with `nosniff` and `Cache-Control: private`.
- A strict Content-Security-Policy is set in `public/_headers`. Pages are `noindex`.
- Display and thumbnail JPEGs are re-encoded from a canvas, so they carry no EXIF (no GPS).
  Originals keep their EXIF and can be downloaded by family members.

## Costs

At family scale everything fits in the free tiers:
- **R2**: 10 GB storage free, then about $0.015/GB/month. That's about 2,500 phone photos
  (original + display + thumbnail) in the free tier. No egress fees.
- **Pages Functions** (Workers free plan): 100,000 requests/day. Images are cached by
  browsers forever, so repeat visits are cheap.
- **Cloudflare Access**: free up to 50 users.

## Known limits / next steps

- **Scale**: each tag change rewrites `index.json`. That's fine up to several thousand photos.
  Beyond that, move metadata to **D1** (Cloudflare's SQLite) and keep the same API.
- **No delete yet** (deliberate for v1, to avoid accidents). A soft delete (hide, keep the
  files) is the obvious addition.
- **Face recognition**: out of scope. A batch job could read `display/*`, suggest tags, and
  write them through the same `PATCH` API.
- **Video**: not supported. The upload filter only accepts images.
