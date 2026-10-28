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
- **Designed for everyone**: warm and readable on phone, tablet and desktop, with big buttons
  and text, set in [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) (a font
  made for readers with low vision) and Fraunces for titles.

It's open source and meant to be reused: each family sets its own album name, language, color
and welcome message without touching the code (see [docs/CONFIGURATION.md](docs/CONFIGURATION.md)).

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

## Deploy

[docs/DEPLOY.md](docs/DEPLOY.md) walks through the whole setup, about 30 minutes: storage,
sign-in with Cloudflare Access, personalization, automatic deploys from GitHub, your own
domain, inviting the family, backups and troubleshooting.

## Project layout

```
src/            Browser app (Preact + TypeScript, built by Vite)
  views/          Timeline, PhotoView (detail + tagging), UploadView
  components/     PersonChips, FilterPanel, YearNav, AddPhotosButton, Icon
  styles.css      The whole look: colors, type, responsive layout (700px / 1100px breakpoints)
  lib/image.ts    HEIC decoding, EXIF date, resizing, content hash, all done in the browser
  i18n.ts         All interface text (French and English; see ALBUM_LANGUAGE)
  config.ts       Reads the family settings embedded in the page
functions/      Cloudflare Pages Functions (thin entry points)
  _middleware.ts  Auth check on every request; fills family settings into the page
  manifest.webmanifest.ts  Home-screen name and color
  api/[[path]].ts Routes /api/* to server/api.ts
server/         API logic, kept framework-free so it can be unit-tested
shared/types.ts Data model shared by browser and server
shared/config.ts Family settings: defaults and validation
tests/          Vitest tests (API with an in-memory R2 fake, auth, filters)
docs/           Deploy guide, configuration, sign-in, architecture
.github/        Workflow: tests every PR, deploys every push to main
```
