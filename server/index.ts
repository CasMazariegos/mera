/**
 * MERA production server (Render web service).
 *   GET  /api/health   liveness for Render's health check
 *   GET  /api/config   what this deployment offers (no secrets)
 *   POST /api/gemma    opt-in Connected AI (structured tasks only)
 *   *                  the built PWA (dist/), with SPA fallback
 * No analytics, no request-content logging.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { buildRemoteMessages, callGemma, gemmaConfigFromEnv, rateLimiter, remoteRequestSchema } from "./gemma";

export function createApp(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch) {
  const gemma = gemmaConfigFromEnv(env);
  const allow = rateLimiter(Number(env.REMOTE_AI_RATE_LIMIT ?? 40), 10 * 60_000);
  const app = new Hono();

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        // Model files (Hugging Face + its CDN redirects) and the ONNX runtime (jsDelivr), fetched by the browser only after consent.
        connectSrc: ["'self'", "https://huggingface.co", "https://*.huggingface.co", "https://*.hf.co", "https://cdn.jsdelivr.net"],
        workerSrc: ["'self'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        fontSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
      crossOriginEmbedderPolicy: false,
      permissionsPolicy: { camera: ["self"], microphone: ["self"], geolocation: [] },
    }),
  );

  app.get("/api/health", (c) => c.json({ ok: true, app: "mera", env: env.APP_ENV ?? "development" }));

  app.get("/api/config", (c) =>
    c.json({
      localAI: env.ENABLE_LOCAL_AI !== "false",
      remoteAI: gemma.enabled,
      remoteModel: gemma.enabled ? gemma.model : null,
    }),
  );

  app.post("/api/gemma", bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    if (!gemma.enabled) return c.json({ error: "remote_ai_disabled" }, 503);
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(ip)) return c.json({ error: "rate_limited" }, 429);
    const parsed = remoteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    let messages;
    try {
      messages = buildRemoteMessages(parsed.data);
    } catch {
      return c.json({ error: "invalid_input" }, 400);
    }
    try {
      const output = await callGemma(gemma, messages, parsed.data.maxTokens, fetchImpl);
      return c.json({ output });
    } catch (err) {
      // Category only — never the request content.
      console.error("[mera] gemma upstream failed:", err instanceof Error ? err.message.slice(0, 40) : "unknown");
      return c.json({ error: "upstream_failed" }, 502);
    }
  });

  app.use("/assets/*", serveStatic({ root: "./dist", onFound: (_p, c) => c.header("cache-control", "public, max-age=31536000, immutable") }));
  app.use("*", serveStatic({ root: "./dist" }));
  // SPA fallback (hash routing, but keep deep links and refreshes working).
  app.get("*", serveStatic({ path: "./dist/index.html" }));
  return app;
}

if (process.argv[1] && /server[\\/]index\.ts$/.test(process.argv[1])) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: createApp().fetch, port }, () => console.log(`MERA listening on :${port}`));
}
