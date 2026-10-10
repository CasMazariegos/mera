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
import { reasonFromSignals, signalNumbers } from "@/features/missions/signals";
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
  const first = parseOnce(schema, raw, check);
  if (first.ok || !/"reason"\s*:/.test(raw)) return first;
  // Small models sometimes put unescaped quotes in the optional "reason". It's the one field MERA can
  // afford to lose (an empty reason is rebuilt from the cited facts), so blank it and try once more.
  const blanked = raw.replace(/"reason"\s*:\s*".*?"\s*,\s*(?="personalizationSignals"\s*:)/s, '"reason": "", ');
  if (blanked === raw) return first;
  const second = parseOnce(schema, blanked, check);
  return second.ok ? second : first;
}

function parseOnce<S extends z.ZodTypeAny>(
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

const NAMES_MINUTES = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|several)[\s-]+min(ute)?s?\b/i;

const CLAIMS_HISTORY =/\b(before|previous\w*|last time|recent\w*|past|again|helped|worked|usually|tend)\b/i;

/**
 * "Why this reset?" must be true: cited ids must be ones MERA sent, a reason may
 * only talk about the past if it cites something, and every number in it must
 * come from a cited signal (or the mission's own minutes).
 */
export function personalizationProblem(v: { reason?: string; personalizationSignals: string[]; durationMinutes: number }, req: MissionRequest): string | null {
  const given = new Set(req.signals);
  // The repair prompt sees this problem text, so tell the model exactly which ids it may use.
  if (v.personalizationSignals.some((id) => !given.has(id)))
    return `invented_signal: personalizationSignals may only contain ${given.size ? [...given].join(", ") : "nothing; use []"}`.slice(0, 190);
  if (!v.reason) return null;
  const why = unsafeTextReason(v.reason, 2);
  if (why) return `reason_${why}`;
  if (!v.personalizationSignals.length && CLAIMS_HISTORY.test(v.reason)) return "unfounded_reason";
  const allowed = [...v.personalizationSignals.flatMap(signalNumbers), v.durationMinutes];
  if (!numbersAreGrounded(v.reason, allowed)) return "ungrounded_reason_numbers";
  return null;
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
    const m = await this.ask("mission", req, msgs, missionSchema, 230, (v) => {
      // Small models often round up a minute or two. A shorter mission is never less safe, so trim it,
      // unless the words themselves name a length ("walk for six minutes"), which would then be wrong.
      if (v.durationMinutes > req.minutes && !NAMES_MINUTES.test(`${v.instruction} ${v.secondaryInstruction ?? ""}`)) v.durationMinutes = req.minutes;
      if (v.durationMinutes > req.minutes) return "too_long_duration";
      if (req.recentTitles.includes(v.title)) return "repeated_title";
      // Ids the model wasn't given are dropped, not trusted. A reason that then has nothing behind it fails the check below.
      const given = new Set(req.signals);
      v.personalizationSignals = v.personalizationSignals.filter((id) => given.has(id));
      // No cited facts → no "why" is shown, so an unsupported reason is discarded rather than costing the mission.
      if (!v.personalizationSignals.length) v.reason = undefined;
      return unsafeMissionReason(v, req) ?? personalizationProblem(v, req);
    });
    const { personalizationSignals, reason, ...mission } = m;
    // A reason with no cited signals can't claim anything about the past (checked above), so it adds nothing; drop it.
    return personalizationSignals.length
      ? { ...mission, reason: reason ?? reasonFromSignals(personalizationSignals), signals: personalizationSignals, source: this.id }
      : { ...mission, source: this.id };
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
