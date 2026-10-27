// Runs before every request (pages, scripts, API): nothing is served to someone not signed in.
// Pages also get the family's settings (title, color...) filled in on the way out.
import { authenticate } from '../server/auth';
import { getConfig, isPageRequest, personalizeHtml, withoutConditionalHeaders } from '../server/config';
import type { Env } from '../server/env';

export const onRequest: PagesFunction<Env, string, { user: string }> = async (ctx) => {
  const auth = await authenticate(ctx.request, ctx.env);
  if (auth instanceof Response) return auth;
  ctx.data.user = auth.user;
  if (!isPageRequest(ctx.request)) return ctx.next();
  const response = await ctx.next(withoutConditionalHeaders(ctx.request));
  return personalizeHtml(response, getConfig(ctx.env), ctx.request);
};
