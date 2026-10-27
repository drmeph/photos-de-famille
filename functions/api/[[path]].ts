import { handleApi } from '../../server/api';
import type { Env } from '../../server/env';

export const onRequest: PagesFunction<Env, string, { user: string }> = (ctx) =>
  handleApi(ctx.request, ctx.env, ctx.data.user);
