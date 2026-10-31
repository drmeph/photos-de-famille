import { getConfig, manifestResponse } from '../server/config';
import type { Env } from '../server/env';

export const onRequestGet: PagesFunction<Env> = (ctx) => manifestResponse(getConfig(ctx.env), ctx.request);
