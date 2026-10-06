/**
 * Shared logic for Gemma providers: prompt → model → strict JSON parse → schema
 * → safety rules. One repair retry with a repair prompt; if that fails too, the
 * caller falls back to the deterministic provider. Raw model text is never
 * rendered.
 */
import { missionSchema, patternPhraseSchema, reflectionSummarySchema, type MissionRequest } from "@/ai/schemas/mission";
import {
  missionMessages,
  patternMessages,
  reflectionMessages,
  repairMessages,
  type ChatMessage,
  type PatternFact,
  type ReflectionFacts,
} from "@/ai/prompts/prompts";
import { numbersAreGrounded, unsafeMissionReason, unsafeTextReason } from "@/ai/safety/safety";
import { examplesFor } from "@/features/missions/select";
import type { GeneratedMission } from "@/types";
import type { z } from "zod";
import { ProviderError, type MeraAIProvider, type ModelTransport, type PatternResult, type TaskName, type TextResult } from "./types";

/** First balanced {...} block (models sometimes wrap JSON in prose or code fences). */
export function extractJsonObject(output: string): string | null {
  const start = output.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < output.length; i++) {
    const c = output[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return output.slice(start, i + 1);
  }
  return null;
}

type Check<T> = (value: T) => string | null;

export function parseWith<S extends z.ZodTypeAny>(
  schema: S,
  raw: string,
  check?: Check<z.infer<S>>,
): { ok: true; value: z.infer<S> } | { ok: false; problem: string } {
  const json = extractJsonObject(raw);
  if (!json) return { ok: false, problem: "no JSON object" };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, problem: "invalid JSON" };
  }
  const r = schema.safeParse(data);
  if (!r.success) return { ok: false, problem: `schema: ${r.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}` };
  const why = check?.(r.data);
  return why ? { ok: false, problem: why } : { ok: true, value: r.data };
}

export class GemmaProvider implements MeraAIProvider {
  readonly id: ModelTransport["id"];
  private readonly transport: ModelTransport;
  constructor(transport: ModelTransport) {
    this.transport = transport;
    this.id = transport.id;
  }

  /** Ask, validate, and repair once. Throws ProviderError if both attempts fail. */
  private async ask<S extends z.ZodTypeAny>(
    task: TaskName,
    input: unknown,
    messages: ChatMessage[],
    schema: S,
    maxTokens: number,
    check?: Check<z.infer<S>>,
  ): Promise<z.infer<S>> {
    const first = await this.transport.complete({ task, input, messages, maxTokens });
    const a = parseWith(schema, first, check);
    if (a.ok) return a.value;
    const repair = { output: first, problem: a.problem };
    const second = await this.transport.complete({ task, input, messages: repairMessages(messages, first, a.problem), repair, maxTokens });
    const b = parseWith(schema, second, check);
    if (b.ok) return b.value;
    throw new ProviderError(/unsafe|clinical|outdoor|night|mobility|avoided|too_long/.test(b.problem) ? "unsafe_output" : "invalid_output", b.problem);
  }

  async generateResetMission(req: MissionRequest): Promise<GeneratedMission> {
    const msgs = missionMessages(req, examplesFor(req));
    const m = await this.ask("mission", req, msgs, missionSchema, 160, (v) => {
      if (v.durationMinutes > req.minutes) return "too_long_duration";
      if (req.recentTitles.includes(v.title)) return "repeated_title";
      return unsafeMissionReason(v, req);
    });
    return { ...m, source: this.id };
  }

  async generateDailyReset(req: MissionRequest): Promise<GeneratedMission> {
    return this.generateResetMission(req);
  }

  async summarizeReflection(facts: ReflectionFacts): Promise<TextResult> {
    const r = await this.ask("reflection", facts, reflectionMessages(facts), reflectionSummarySchema, 90, (v) => unsafeTextReason(v.summary, 2));
    return { text: r.summary, source: this.id };
  }

  async analyzePatterns(facts: PatternFact[]): Promise<PatternResult[]> {
    const out: PatternResult[] = [];
    for (const f of facts) {
      try {
        const r = await this.ask(
          "pattern",
          f,
          patternMessages(f),
          patternPhraseSchema,
          70,
          (v) => unsafeTextReason(v.sentence, 1) ?? (numbersAreGrounded(v.sentence, f.numbers) ? null : "ungrounded_numbers"),
        );
        out.push({ key: f.key, text: r.sentence, source: this.id });
      } catch {
        // This one observation keeps its deterministic wording.
        out.push({ key: f.key, text: f.sentence, source: "fallback" });
      }
    }
    return out;
  }
}
