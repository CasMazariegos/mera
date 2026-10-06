/**
 * MERA on Cloudflare Workers. Static files (the PWA) are served by Workers
 * Static Assets with an SPA fallback; only /api/* runs here (run_worker_first).
 * Connected AI uses Gemma via the Workers AI binding — still opt-in for visitors.
 */
import { createApi } from "./api";
import type { AiBinding } from "./gemma";

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  AI?: AiBinding;
  [key: string]: unknown;
}

function stringVars(env: Env): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return createApi(stringVars(env), { ai: env.AI ?? null }).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
