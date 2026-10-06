/**
 * RemoteGemmaProvider, server side. Accepts only a known task with validated,
 * structured input, rebuilds MERA's own prompts (the same code the browser uses),
 * and calls an OpenAI-compatible Gemma endpoint — e.g. Google AI Studio's Gemma
 * models, a self-hosted Ollama/vLLM/llama.cpp server. The raw output goes back
 * to the client, which validates it exactly like local output.
 *
 * Never logs request content.
 */
import { z } from "zod";
import { missionRequestSchema } from "../src/ai/schemas/mission";
import { missionMessages, patternMessages, reflectionMessages, repairMessages, type ChatMessage } from "../src/ai/prompts/prompts";
import { examplesFor } from "../src/features/missions/select";

export const remoteRequestSchema = z.object({
  task: z.enum(["mission", "reflection", "pattern"]),
  input: z.unknown(),
  repair: z.object({ output: z.string().max(800), problem: z.string().max(200) }).optional(),
  maxTokens: z.number().int().min(16).max(256),
});

const reflectionInput = z.object({
  emotion: z.string().max(30).nullable(),
  missionTitle: z.string().max(60).nullable(),
  missionCategory: z.string().max(20).nullable(),
  outcome: z.string().max(30).nullable(),
  minutesAway: z.number().int().min(0).max(240),
  note: z.string().max(1000).optional(),
});

const patternInput = z.object({
  key: z.string().max(60),
  sentence: z.string().max(200),
  numbers: z.array(z.number().int().min(0).max(10000)).max(6),
});

/** Turn a validated request into the exact messages MERA uses. Throws on invalid input. */
export function buildRemoteMessages(body: z.infer<typeof remoteRequestSchema>): ChatMessage[] {
  let msgs: ChatMessage[];
  if (body.task === "mission") {
    const req = missionRequestSchema.parse(body.input);
    msgs = missionMessages(req, examplesFor(req));
  } else if (body.task === "reflection") {
    msgs = reflectionMessages(reflectionInput.parse(body.input));
  } else {
    msgs = patternMessages(patternInput.parse(body.input));
  }
  return body.repair ? repairMessages(msgs, body.repair.output, body.repair.problem) : msgs;
}

export interface GemmaConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
}

export function gemmaConfigFromEnv(env: NodeJS.ProcessEnv): GemmaConfig {
  const endpoint = (env.MODEL_ENDPOINT ?? "").replace(/\/+$/, "");
  return {
    enabled: env.ENABLE_REMOTE_AI === "true" && !!endpoint && !!env.MODEL_NAME,
    endpoint,
    apiKey: env.MODEL_API_KEY ?? "",
    model: env.MODEL_NAME ?? "",
  };
}

/** One chat completion against an OpenAI-compatible endpoint. Returns the text or throws. */
export async function callGemma(cfg: GemmaConfig, messages: ChatMessage[], maxTokens: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 25_000);
  try {
    const res = await fetchImpl(`${cfg.endpoint}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens, temperature: 0 }),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("upstream_no_text");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Tiny in-memory per-IP rate limiter (single instance; enough for a small deployment). */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}
