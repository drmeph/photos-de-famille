import type { ConfigVars } from '../shared/config';

export interface Env extends ConfigVars {
  /** R2 bucket holding images and JSON metadata (binding name set in wrangler.toml). */
  PHOTOS: R2Bucket;
  /** Cloudflare Access: team domain, e.g. "my-family.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access: "Application Audience (AUD) Tag" of the Access application. */
  ACCESS_AUD?: string;
  /** Fallback auth: one shared password for the whole family (HTTP Basic auth). */
  BASIC_AUTH_PASSWORD?: string;
  /** Local development only: skip auth and act as this user. Never set in production. */
  INSECURE_DEV_USER?: string;
}
