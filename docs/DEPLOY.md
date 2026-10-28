# Deploy your family's album on Cloudflare

This guide takes you from nothing to a private album your family can use, in about 30
minutes. Everything fits in Cloudflare's free plans for a family. The only thing you might
pay for is storage beyond 10 GB (about 2,500 phone photos), at roughly $0.015 per GB per month.

You will:

1. [Get the code](#1-get-the-code)
2. [Create the storage bucket](#2-create-the-storage-bucket)
3. [Create the Pages project](#3-create-the-pages-project)
4. [Set up sign-in with Cloudflare Access](#4-set-up-sign-in-with-cloudflare-access)
5. [Personalize the album](#5-personalize-the-album-optional) (optional)
6. [Deploy automatically from GitHub](#6-deploy-automatically-from-github)
7. [Use your own domain](#7-use-your-own-domain-optional) (optional)
8. [Invite the family](#8-invite-the-family)
9. [Check that it's private](#9-check-that-its-private)

Then: [updating](#updating), [backups](#backups), [troubleshooting](#troubleshooting).

**What you need:** a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free), a
GitHub account, and [Node.js](https://nodejs.org) 20 or newer on your computer for the
one-time setup commands.

---

## 1. Get the code

Fork this repository on GitHub (the **Fork** button), then on your computer:

```sh
git clone https://github.com/<you>/<your-fork>.git
cd <your-fork>
npm install
npx wrangler login        # opens the browser to connect wrangler to your Cloudflare account
```

> **Names used below.** The project is called `album-familial` and the bucket
> `album-familial-photos`. To use other names, change `name` and `bucket_name` in
> `wrangler.toml` and use your names in every command below.

## 2. Create the storage bucket

Photos and their information are stored in Cloudflare R2:

```sh
npx wrangler r2 bucket create album-familial-photos
```

The first time, Cloudflare may ask you to enable R2 in the dashboard (*R2 Object Storage*).
That requires a payment method on file even though the free tier covers a family.

## 3. Create the Pages project

```sh
npx wrangler pages project create album-familial --production-branch main
```

The site will live at `https://album-familial.pages.dev`. Don't open it yet: until sign-in
is set up it answers every request with *Authentication is not configured*. That's on purpose,
so the album is never public by accident.

## 4. Set up sign-in with Cloudflare Access

Family members type their email address and receive a 6-digit code. There's no password to
remember, and you decide who gets in with a list of emails. Free for up to 50 people.

1. **Create a Zero Trust team** (once per Cloudflare account): open
   <https://one.dash.cloudflare.com>, pick a team name (e.g. `famille-martin`) and choose the
   **Free** plan. Your *team domain* is `famille-martin.cloudflareaccess.com`.
2. **Login method**: in *Settings → Authentication*, check that **One-time PIN** is enabled
   (it is by default). You can also add Google login if most of the family uses Gmail.
3. **Create the application**: *Access → Applications → Add an application → Self-hosted*.
   - **Name**: `Album de famille`
   - **Session duration**: `1 month`, so relatives don't have to log in every week.
   - **Public hostnames**: add every address the site answers on:
     - `album-familial.pages.dev`
     - `*.album-familial.pages.dev` (preview deployments)
     - your own domain later, if you add one (step 7)
4. **Policy**: action **Allow**, rule **Include → Emails**, and list each family member's
   email address.
5. **Copy the AUD tag**: open the application's overview and copy the
   *Application Audience (AUD) Tag* (a long hexadecimal string).
6. **Tell the site** (each command asks you to paste the value):

   ```sh
   npx wrangler pages secret put ACCESS_TEAM_DOMAIN --project-name album-familial   # famille-martin.cloudflareaccess.com
   npx wrangler pages secret put ACCESS_AUD --project-name album-familial           # the AUD tag
   ```

The site checks the signed token Access attaches to every request, so nobody can get around
the login screen. If you'd rather not use Access, a shared family password also works; see
[AUTH.md](AUTH.md#shared-family-password).

> **Why `secret put` and not the dashboard?** This project has a `wrangler.toml`, and
> Cloudflare then treats that file as the place for plain variables. Secrets are how you add
> values that stay out of the (public) repository. They can also be added in the dashboard,
> under *Workers & Pages → album-familial → Settings → Variables and Secrets*, as type *Secret*.

## 5. Personalize the album (optional)

Give the album your family's name, language, color and a welcome message:

```sh
npx wrangler pages secret put ALBUM_TITLE --project-name album-familial      # Album de la famille Martin
npx wrangler pages secret put ALBUM_LANGUAGE --project-name album-familial   # fr, en or auto
npx wrangler pages secret put ALBUM_COLOR --project-name album-familial      # #1f4e79
npx wrangler pages secret put ALBUM_WELCOME --project-name album-familial    # Bienvenue ! Un souci ? Appelez Kevin.
```

All four are optional. [CONFIGURATION.md](CONFIGURATION.md) explains each one.

## 6. Deploy automatically from GitHub

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`). It runs
the tests on every pull request, and on every push to `main` it runs the tests and then
deploys. It needs two secrets:

1. **Create an API token**: Cloudflare dashboard → your profile icon → *My Profile →
   API Tokens → Create Token → Create Custom Token*.
   - Name: `album-familial deploy`
   - Permissions: **Account → Cloudflare Pages → Edit**
   - Account resources: your account
   - Create it and copy the token (it's shown only once).
2. **Find your account ID**: run `npx wrangler whoami`, or look in the dashboard URL
   (`dash.cloudflare.com/<account id>/…`).
3. **Add both to GitHub**: your fork → *Settings → Secrets and variables → Actions → New
   repository secret*:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID
4. **Deploy**: push to `main`, or open the *Actions* tab → *Check & deploy* → *Run workflow*.
   When the run is green, the album is live at `https://album-familial.pages.dev`.

**Deploying from your computer instead** works too, with no token needed:

```sh
npm run deploy
```

Run it again whenever you change a secret (steps 4 and 5) so the new values are used.

## 7. Use your own domain (optional)

For a friendlier address like `album.martin.fr`:

1. Dashboard → *Workers & Pages → album-familial → Custom domains → Set up a custom domain*,
   then follow the instructions. It's easiest if the domain's DNS is already on Cloudflare.
2. **Add the same hostname to the Access application** (step 4.3), or the site will refuse
   visitors on that address.

## 8. Invite the family

- **Add someone**: add their email to the Access policy (step 4.4). That takes effect
  immediately, with no redeploy needed.
- **Remove someone**: remove their email from the policy. To also end a session that's
  already open, revoke it under *Zero Trust → My Team → Users*.
- **Send them the link** with these steps: open the link, type your email, type the
  6-digit code from the email you receive, and you're in for a month.
- **On phones**, help them add it to the home screen. On iPhone: Share → *Add to Home
  Screen*. On Android: menu ⋮ → *Add to Home screen*. It then opens like an app, with
  the album's name and color.

## 9. Check that it's private

1. Open the album in a private / incognito window: you should get the Cloudflare login page,
   not the album.
2. Do the same with `https://album-familial.pages.dev` if you set up your own domain.
3. Log in with an email that's **not** on the list: no code should arrive, and you can't get in.
4. Log in with your email, add a photo, tag someone. 🎉

## Updating

When this project gets improvements, bring them into your fork with GitHub's **Sync fork**
button. The push to `main` deploys them automatically (step 6). Your photos and settings
aren't touched: they live in R2 and in Cloudflare secrets, not in the code.

## Backups

R2 is durable, but a copy you hold yourself protects against mistakes. Using
[rclone](https://rclone.org):

1. Dashboard → *R2 → Manage R2 API Tokens → Create API token*, with permission
   **Object Read only**, restricted to the `album-familial-photos` bucket. Note the *Access
   Key ID*, *Secret Access Key* and the S3 endpoint.
2. `rclone config`: create a remote named `album` of type *Amazon S3*, provider
   *Cloudflare*, with those values.
3. Copy everything (run it again any time; it only downloads what's new):

   ```sh
   rclone copy album:album-familial-photos ./album-backup --progress
   ```

The backup contains the original files (`originals/`), and the tags, dates and captions
(`meta/*.json`), in plain formats you can open without this project.

## Troubleshooting

| What you see | Why, and what to do |
|---|---|
| *Authentication is not configured* | No sign-in secrets on this deployment. Do step 4.6 (or the shared password), then redeploy. The commands set *production* secrets; preview deployments (other branches) need theirs added in the dashboard, under *Settings → Variables and Secrets*, with the environment set to *Preview*. |
| *Forbidden* after logging in | `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` doesn't match the Access application. Copy them again from step 4, then redeploy. |
| The login page never appears on one address | That hostname is missing from the Access application (step 4.3). The site then refuses the request itself. |
| The deploy job says *Skipping deploy* | The GitHub secrets from step 6.3 are missing or misspelled. |
| The deploy fails with an authentication error | The API token lacks *Cloudflare Pages: Edit*, or `CLOUDFLARE_ACCOUNT_ID` is wrong. |
| Settings from step 5 don't show up | Redeploy after changing secrets. Check the logs (`npx wrangler pages deployment tail --project-name album-familial`) for `[config]` warnings about invalid values. |
| Photos in the wrong place in the timeline | The photo had no date (screenshots, scans, photos sent through some messaging apps). Open it and use *Fix the date*. |
