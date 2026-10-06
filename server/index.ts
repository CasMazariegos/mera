/**
 * MERA on Node (Render web service): the shared API plus the built PWA (dist/),
 * with immutable caching for hashed assets and an SPA fallback.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApi } from "./api";
import type { ServerEnv } from "./gemma";

export function createApp(env: ServerEnv = process.env, fetchImpl: typeof fetch = fetch) {
  const app = createApi(env, { fetchImpl });
  app.use("/assets/*", serveStatic({ root: "./dist", onFound: (_p, c) => c.header("cache-control", "public, max-age=31536000, immutable") }));
  app.use("*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
  return app;
}

if (process.argv[1] && /server[\\/]index\.ts$/.test(process.argv[1])) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: createApp().fetch, port }, () => console.log(`MERA listening on :${port}`));
}
