import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { authenticate, resetAccessKeyCache } from '../server/auth';
import type { Env } from '../server/env';

const TEAM = 'famille.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const env = (extra: Partial<Env>) => ({ PHOTOS: {} as R2Bucket, ...extra }) as Env;
const b64url = (data: Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : data).toString('base64url');

let keys: CryptoKeyPair;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  publicJwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey;
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

async function makeJwt(payload: Record<string, unknown>, kid = 'k1') {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

function stubCerts() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
      return Response.json({ keys: [{ ...publicJwk, kid: 'k1' }] });
    }),
  );
}

const now = () => Math.floor(Date.now() / 1000);
const accessEnv = env({ ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD });
const withJwt = (jwt: string) => new Request('https://album.test/', { headers: { 'Cf-Access-Jwt-Assertion': jwt } });

describe('Cloudflare Access', () => {
  it('accepts a valid token and returns the email', async () => {
    stubCerts();
    const jwt = await makeJwt({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: 'papi@example.com' });
    expect(await authenticate(withJwt(jwt), accessEnv)).toEqual({ user: 'papi@example.com' });
  });

  it('also reads the CF_Authorization cookie', async () => {
    stubCerts();
    const jwt = await makeJwt({ aud: AUD, iss: `https://${TEAM}`, exp: now() + 600, email: 'papi@example.com' });
    const request = new Request('https://album.test/', { headers: { Cookie: `x=1; CF_Authorization=${jwt}` } });
    expect(await authenticate(request, accessEnv)).toEqual({ user: 'papi@example.com' });
  });

  it.each([
    ['wrong audience', { aud: ['other'], iss: `https://${TEAM}`, exp: now() + 600, email: 'a@b.c' }],
    ['wrong issuer', { aud: [AUD], iss: 'https://evil.cloudflareaccess.com', exp: now() + 600, email: 'a@b.c' }],
    ['expired', { aud: [AUD], iss: `https://${TEAM}`, exp: now() - 3600, email: 'a@b.c' }],
  ])('rejects a token with %s', async (_, payload) => {
    stubCerts();
    const res = await authenticate(withJwt(await makeJwt(payload)), accessEnv);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('rejects a tampered token', async () => {
    stubCerts();
    const jwt = await makeJwt({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: 'a@b.c' });
    const [h, , s] = jwt.split('.');
    const forged = `${h}.${b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: 'evil@x.y' }))}.${s}`;
    expect(await authenticate(withJwt(forged), accessEnv)).toBeInstanceOf(Response);
  });

  it('rejects requests without a token', async () => {
    const res = await authenticate(new Request('https://album.test/'), accessEnv);
    expect((res as Response).status).toBe(403);
  });
});

describe('shared password (Basic auth)', () => {
  const basicEnv = env({ BASIC_AUTH_PASSWORD: 'tarte-aux-pommes' });
  const withBasic = (user: string, pass: string) =>
    new Request('https://album.test/', { headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` } });

  it('accepts the right password and uses the name as identity', async () => {
    expect(await authenticate(withBasic('Mamie Jeanne', 'tarte-aux-pommes'), basicEnv)).toEqual({ user: 'Mamie Jeanne' });
  });

  it('asks for credentials when the password is wrong or missing', async () => {
    for (const request of [withBasic('x', 'nope'), new Request('https://album.test/')]) {
      const res = (await authenticate(request, basicEnv)) as Response;
      expect(res.status).toBe(401);
      expect(res.headers.get('WWW-Authenticate')).toContain('Basic');
    }
  });
});

describe('fail closed', () => {
  it('refuses everything when no auth is configured', async () => {
    const res = await authenticate(new Request('https://album.test/'), env({}));
    expect((res as Response).status).toBe(503);
  });

  it('allows the explicit local dev user', async () => {
    expect(await authenticate(new Request('https://album.test/'), env({ INSECURE_DEV_USER: 'dev@x' }))).toEqual({ user: 'dev@x' });
  });
});
