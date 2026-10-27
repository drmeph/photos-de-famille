# Album de famille

A small, private photo album for the family: add photos from your phone, scroll through
the years, and say who is in each picture. It's built for about ten people, older relatives
included, so ease of use comes first and there's not much else to it.

- **Add photos**: one big button. On a phone it offers the camera or the photo library.
  iPhone HEIC photos work.
- **Timeline**: photos grouped by month, newest first, using the date the photo was taken
  (EXIF). If there's no EXIF date, the upload date is used, and anyone can correct it.
- **Who's in it**: anyone can tap names to tag or untag people, or add a new name.
- **Search**: filter by one or more people and/or a range of years.
- **Private**: only invited family members get in (Cloudflare Access, or a shared password).

Hosting is Cloudflare Pages + R2, which is free at family scale (see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#costs)).

## Quick start (local)

```sh
npm install
cp .dev.vars.example .dev.vars   # local-only fake user, no login
npm run dev                      # http://localhost:8788
```

`npm run dev` rebuilds the front end on change (reload the page) and runs the API with a
local simulated R2 bucket in `.wrangler/state/`.

```sh
npm run check   # typecheck + tests + production build
```

## Deploy (first time)

```sh
npx wrangler login
npx wrangler r2 bucket create album-familial-photos
npx wrangler pages project create album-familial --production-branch main
```

Next, **set up sign-in** by following [docs/AUTH.md](docs/AUTH.md). Until you do, the site
refuses every request. Then:

```sh
npm run deploy
```

You can also connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create →
Pages → Connect to Git) with build command `npm run build` and output directory `dist`. The R2
binding comes from `wrangler.toml` either way.

## Project layout

```
src/            Browser app (Preact + TypeScript, built by Vite)
  views/          Timeline, PhotoView (detail + tagging), UploadView
  components/     PersonChips, FilterPanel, AddPhotosButton
  lib/image.ts    HEIC decoding, EXIF date, resizing, content hash, all done in the browser
  i18n.ts         All interface text (French, with English if the browser is in English)
functions/      Cloudflare Pages Functions (thin entry points)
  _middleware.ts  Auth check on every request
  api/[[path]].ts Routes /api/* to server/api.ts
server/         API logic, kept framework-free so it can be unit-tested
shared/types.ts Data model shared by browser and server
tests/          Vitest tests (API with an in-memory R2 fake, auth, filters)
docs/           Architecture and auth setup
```
