// Who is making this request? Three modes, checked in this order:
//   1. Cloudflare Access (recommended): verify the signed JWT Access adds to every request.
//   2. Shared family password via HTTP Basic auth (fallback, no Cloudflare Zero Trust needed).
//   3. INSECURE_DEV_USER for local development.
// If none is configured, every request is refused: the site is never accidentally public.

import type { Env } from './env';

export interface AuthResult {
  user: string;
}

export async function authenticate(request: Request, env: Env): Promise<AuthResult | Response> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? getCookie(request, 'CF_Authorization');
    const user = token ? await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD) : null;
    return user ? { user } : new Response('Forbidden', { status: 403 });
  }
  if (env.BASIC_AUTH_PASSWORD) {
    const user = await checkBasicAuth(request, env.BASIC_AUTH_PASSWORD);
    return user
      ? { user }
      : new Response('Identifiez-vous / Please sign in', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Album familial", charset="UTF-8"' },
        });
  }
  if (env.INSECURE_DEV_USER) return { user: env.INSECURE_DEV_USER };
  return new Response('Authentication is not configured', { status: 503 });
}

// ---------- HTTP Basic auth: the username is just the person's name, the password is shared.

async function checkBasicAuth(request: Request, password: string): Promise<string | null> {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  const name = decoded.slice(0, sep).trim().slice(0, 60);
  const given = decoded.slice(sep + 1);
  if (!(await constantTimeEqual(given, password))) return null;
  return name || 'famille';
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------- Cloudflare Access JWT verification
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

interface Jwk extends JsonWebKey {
  kid: string;
}

let keyCache: { team: string; fetchedAt: number; keys: Jwk[] } | null = null;
const KEY_TTL_MS = 60 * 60 * 1000;

async function getAccessKeys(team: string, forceRefresh: boolean): Promise<Jwk[]> {
  if (!forceRefresh && keyCache && keyCache.team === team && Date.now() - keyCache.fetchedAt < KEY_TTL_MS) {
    return keyCache.keys;
  }
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Could not fetch Access certs: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  keyCache = { team, fetchedAt: Date.now(), keys };
  return keys;
}

/** Exported for tests. */
export function resetAccessKeyCache() {
  keyCache = null;
}

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Returns the user's email if the token is valid, otherwise null. */
export async function verifyAccessJwt(token: string, teamDomain: string, aud: string): Promise<string | null> {
  const team = teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(base64UrlDecode(parts[0])));
    const payload = JSON.parse(dec.decode(base64UrlDecode(parts[1])));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    let jwk = (await getAccessKeys(team, false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await getAccessKeys(team, true)).find((k) => k.kid === header.kid); // keys rotated
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    const now = Math.floor(Date.now() / 1000);
    const skew = 60;
    const auds: unknown[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp < now - skew) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + skew) return null;

    const who = payload.email ?? payload.common_name; // common_name: Access service tokens
    return typeof who === 'string' && who ? who : null;
  } catch {
    return null;
  }
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
