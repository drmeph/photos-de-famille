# Sign-in setup

The site refuses every request until one of these is configured.

## Option A: Cloudflare Access (recommended)

Family members type their email address and receive a 6-digit code by email. There's no
password to remember, and you can let someone in (or out) by editing a list of emails.
Free for up to 50 people.

1. **Create a Zero Trust team** (once): open <https://one.dash.cloudflare.com>, pick a team
   name (e.g. `famille-dupont`), and choose the **Free** plan. Your team domain is
   `famille-dupont.cloudflareaccess.com`.
2. **Login method**: under *Settings → Authentication*, make sure **One-time PIN** is enabled
   (it is by default). You can also add Google if most of the family uses Gmail.
3. **Create the application**: *Access → Applications → Add an application → Self-hosted*.
   - Name: `Album de famille`
   - Session duration: **1 month**, so relatives don't have to log in every week.
   - Public hostnames: add **all** the addresses the site answers on:
     - your custom domain if you have one, e.g. `album.dupont.fr`
     - `album-familial.pages.dev`
     - `*.album-familial.pages.dev` (preview deployments)
4. **Policy**: action **Allow**, rule **Include → Emails**, then list each family member's
   email. To add someone later, add their email here. Nothing needs redeploying.
5. **Copy the AUD tag**: open the application's overview and copy the
   *Application Audience (AUD) Tag*.
6. **Tell the site**: in the Cloudflare dashboard, *Workers & Pages → album-familial →
   Settings → Variables and Secrets*, add these for **Production** (and Preview):
   - `ACCESS_TEAM_DOMAIN` = `famille-dupont.cloudflareaccess.com`
   - `ACCESS_AUD` = the tag from step 5

   Then redeploy (`npm run deploy`).

The site checks the token Access attaches to every request (signature, audience, expiry).
If someone reaches the site without going through Access, they get *Forbidden*.

**What relatives see**: a Cloudflare page asking for their email → a code arrives by email →
they type it → they're in for a month. Tip: on their phone, add the site to the home screen
(Share → *Add to Home Screen*) so it opens like an app.

## Option B: one shared family password (fallback)

Simpler, but less safe: everyone shares one password, and you can't remove one person
without changing it for all.

```sh
npx wrangler pages secret put BASIC_AUTH_PASSWORD --project-name album-familial
```

The browser shows its standard login box. Users type **their own name** as the username,
which is recorded as "added by", and the shared password. Use a long passphrase. If
`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are set, Access takes priority and this password is ignored.

## Local development

`.dev.vars` (copied from `.dev.vars.example`) sets `INSECURE_DEV_USER`, which skips sign-in
on your machine. Never set this variable on the deployed site.
