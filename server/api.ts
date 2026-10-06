/**
 * MERA's API — shared by the Node server (Render) and the Cloudflare Worker.
 *   GET  /api/health   liveness
 *   GET  /api/config   what this deployment offers (no secrets)
 *   POST /api/gemma    opt-in Connected AI (structured tasks only)
 * No analytics, no request-content logging.
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { buildRemoteMessages, callGemma, callWorkersAi, gemmaConfigFromEnv, rateLimiter, remoteRequestSchema, type AiBinding, type ServerEnv } from "./gemma";

/** Same policy for the API responses here and for static files (public/_headers on Cloudflare). */
export const CSP = {
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
};

export interface ApiDeps {
  fetchImpl?: typeof fetch;
  ai?: AiBinding | null;
}

// One limiter per runtime instance (per isolate on Workers).
const limiters = new Map<number, ReturnType<typeof rateLimiter>>();

export function createApi(env: ServerEnv, deps: ApiDeps = {}) {
  const gemma = gemmaConfigFromEnv(env, deps.ai);
  const limit = Number(env.REMOTE_AI_RATE_LIMIT ?? 40);
  if (!limiters.has(limit)) limiters.set(limit, rateLimiter(limit, 10 * 60_000));
  const allow = limiters.get(limit)!;
  const app = new Hono();

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: CSP,
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
      remoteProvider: gemma.enabled ? (gemma.provider === "workers-ai" ? "Cloudflare Workers AI" : "OpenAI-compatible endpoint") : null,
    }),
  );

  app.post("/api/gemma", bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    if (!gemma.enabled) return c.json({ error: "remote_ai_disabled" }, 503);
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
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
      const output =
        gemma.provider === "workers-ai" && deps.ai
          ? await callWorkersAi(deps.ai, gemma.model, messages, parsed.data.maxTokens)
          : await callGemma(gemma, messages, parsed.data.maxTokens, deps.fetchImpl ?? fetch);
      return c.json({ output });
    } catch (err) {
      // Category only — never the request content.
      console.error("[mera] gemma upstream failed:", err instanceof Error ? err.message.slice(0, 40) : "unknown");
      return c.json({ error: "upstream_failed" }, 502);
    }
  });

  return app;
}
