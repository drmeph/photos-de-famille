# Make it your family's album

Four optional settings personalize a deployment. They're environment variables read when each
page is served, so changing one needs no rebuild. Nothing family-specific lives in the source
code, so you can deploy the project as-is and keep your family's details private.

| Variable | What it does | Default |
|---|---|---|
| `ALBUM_TITLE` | Name in the header, browser tab and under the home-screen icon (max 60 characters). | "Album de famille" / "Family album" |
| `ALBUM_LANGUAGE` | `fr`, `en`, or `auto` (each visitor gets French if their phone is in French, otherwise English). | `auto` |
| `ALBUM_COLOR` | The album's color, as `#rrggbb`: buttons and highlights, plus a light tint of the background, borders and text. Colors too pale for white text on them are darkened automatically (WCAG AA, 4.5:1), keeping their hue. | `#7a4b2a` (warm brown) |
| `ALBUM_WELCOME` | Short message at the top of the album, e.g. who to ask for help (max 500 characters, line breaks kept). | none |

Example for the Martin family:

```sh
npx wrangler pages secret put ALBUM_TITLE --project-name album-familial      # Album de la famille Martin
npx wrangler pages secret put ALBUM_LANGUAGE --project-name album-familial   # fr
npx wrangler pages secret put ALBUM_COLOR --project-name album-familial      # #1f4e79
npx wrangler pages secret put ALBUM_WELCOME --project-name album-familial    # Bienvenue ! Un souci ? Appelez Kevin.
```

Then redeploy (`npm run deploy`) so the new values are picked up.

**Why secrets?** They aren't really secret, but this project has a `wrangler.toml`, and
Cloudflare then treats that file as the only place for plain variables. Secrets are the way to
set values from outside the (public) repository. If you're happy for your settings to be
public in your fork, you can uncomment the `[vars]` block in `wrangler.toml` instead.

**Locally**, put the same variables in `.dev.vars` (see `.dev.vars.example`). In that file,
quote anything containing `#`, for example `ALBUM_COLOR="#1f4e79"`.

**Invalid values** never break the site: that setting falls back to its default, and a
`[config] …` warning appears in the logs (`npx wrangler pages deployment tail`).

## How it works

`functions/_middleware.ts` runs on every page request. It reads the variables
([`shared/config.ts`](../shared/config.ts) validates them), then `server/config.ts` rewrites
`index.html` on the fly: it sets `<title>`, `lang` and `theme-color`, and embeds the settings
as a JSON block that the app reads at startup ([`src/config.ts`](../src/config.ts)). The
home-screen manifest is generated the same way (`functions/manifest.webmanifest.ts`).

To add a setting:
1. Add it to `AlbumConfig`, `DEFAULT_CONFIG`, `ConfigVars` and `parseConfig` in `shared/config.ts`.
2. Use `config.<name>` in the app.
3. Add a test in `tests/config.test.ts` and a row in the table above.

To add an interface language, add a dictionary in `src/i18n.ts` and its code to `LANGUAGES` in
`shared/config.ts`.
