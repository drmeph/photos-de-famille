# Sign-in

Every request (pages, scripts, photos, API) goes through `functions/_middleware.ts`, which
lets it in only if one of these is configured and the visitor passes it. With nothing
configured, the site refuses everyone (*Authentication is not configured*), so it can't be
public by accident.

| Mode | Turned on by | Who the visitor is |
|---|---|---|
| **Cloudflare Access** (recommended) | `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` | their email address |
| **Shared family password** | `BASIC_AUTH_PASSWORD` | the name they type |
| **Local development** | `INSECURE_DEV_USER` (in `.dev.vars` only) | that value |

If several are set, the first in this table wins.

## Cloudflare Access

Setup is step 4 of [DEPLOY.md](DEPLOY.md#4-set-up-sign-in-with-cloudflare-access). Managing
the family afterwards is in step 8 of the same guide.

How the check works ([`server/auth.ts`](../server/auth.ts)): Access adds a signed token
(JWT) to every request, as the `Cf-Access-Jwt-Assertion` header and the `CF_Authorization`
cookie. The site downloads your team's public keys from
`https://<team domain>/cdn-cgi/access/certs` and verifies the token's signature, audience
(`ACCESS_AUD`), issuer and expiry. A visitor who reaches the site without passing through
Access (for example on an address not listed in the Access application) has no valid
token and gets *Forbidden*.

## Shared family password

Simpler than Access, but less safe: everyone shares one password, and you can't remove one
person without changing it for all.

```sh
npx wrangler pages secret put BASIC_AUTH_PASSWORD --project-name album-familial
npm run deploy
```

The browser shows its standard login box. Each person types **their own name** as the
username (it's recorded as "added by" on their photos) and the shared password. Use a long
passphrase, e.g. four random words.

## Local development

`.dev.vars` (copied from `.dev.vars.example`) sets `INSECURE_DEV_USER`, which skips sign-in
on your machine. Never set this variable on the deployed site.
