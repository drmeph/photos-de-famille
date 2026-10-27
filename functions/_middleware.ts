// Runs before every request (pages, scripts, API): nothing is served to someone not signed in.
import { authenticate } from '../server/auth';
import type { Env } from '../server/env';

export const onRequest: PagesFunction<Env, string, { user: string }> = async (ctx) => {
  const auth = await authenticate(ctx.request, ctx.env);
  if (auth instanceof Response) return auth;
  ctx.data.user = auth.user;
  return ctx.next();
};
