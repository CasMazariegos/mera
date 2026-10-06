/**
 * Prompts for Gemma. Short on purpose: MERA asks the model for LESS text, in
 * strict JSON, and code enforces the rules afterwards (schemas + safety).
 * Gemma has no system role, so the rules lead the first user turn.
 */
import type { MissionRequest } from "@/ai/schemas/mission";
import type { LibraryMission } from "@/features/missions/library";

export const PROMPT_VERSION = "2026-10-06.1";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MISSION_RULES = `You create ONE short real-world grounding mission for a wellness app called MERA. It is not therapy.
Rules:
- One simple instruction (max 2 sentences), optional short second instruction.
- 2 to 10 minutes. Real-world, physical, sensory. Never involve a phone, screen, writing or journaling.
- Safe: no roads or traffic, no strangers, no unfamiliar places, nothing at night outside, no running or hard exercise, no bare feet, no tools, nothing medical.
- If outdoor is not allowed, the mission must be indoors. At night, stay indoors or at the door.
- Plain, calm words. No diagnosis, no advice about feelings, no exclamation marks.
Reply with JSON only: {"title": string (max 5 words), "durationMinutes": number, "category": "nature"|"movement"|"sensory"|"indoor", "environment": "outdoor"|"indoor"|"either", "instruction": string, "secondaryInstruction": string}`;

function describe(req: MissionRequest): string {
  const helped = Object.entries(req.helped)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
  const notHelped = Object.entries(req.notHelped)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
  return [
    `Feeling: ${req.emotion.replace("_", " ")}`,
    `Outdoor: ${req.canGoOutside === "indoor_only" ? "not allowed" : req.canGoOutside === "yes" ? "allowed" : "maybe — prefer missions that work either way"}`,
    `Time of day: ${req.timeOfDay}`,
    `Minutes available: ${req.minutes}`,
    req.lowMobility ? "Low mobility: no walking or standing exercises" : "",
    req.avoidSound ? "Do not use listening or sounds" : "",
    req.avoidSmell ? "Do not use smell" : "",
    helped ? `Helped before: ${helped}` : "",
    notHelped ? `Didn't help before: ${notHelped}` : "",
    req.recentTitles.length ? `Don't repeat: ${req.recentTitles.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function exampleJson(m: LibraryMission): string {
  return JSON.stringify({ title: m.title, durationMinutes: m.durationMinutes, category: m.category, environment: m.environment, instruction: m.instruction, secondaryInstruction: m.secondaryInstruction ?? "" });
}

export function missionMessages(req: MissionRequest, examples: LibraryMission[]): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const [a, b] = examples;
  if (a) {
    msgs.push({ role: "user", content: `${MISSION_RULES}\n\n${describe({ ...req, emotion: a.emotions[0] ?? "not_sure", recentTitles: [] })}` });
    msgs.push({ role: "assistant", content: exampleJson(a) });
  }
  if (b) {
    msgs.push({ role: "user", content: describe({ ...req, emotion: b.emotions[0] ?? "not_sure", recentTitles: [] }) });
    msgs.push({ role: "assistant", content: exampleJson(b) });
  }
  msgs.push({ role: "user", content: a ? describe(req) : `${MISSION_RULES}\n\n${describe(req)}` });
  return msgs;
}

export function repairMessages(original: ChatMessage[], badOutput: string, problem: string): ChatMessage[] {
  return [
    ...original,
    { role: "assistant", content: badOutput.slice(0, 600) },
    { role: "user", content: `That answer can't be used (${problem}). Reply again with ONLY the JSON object, following every rule.` },
  ];
}

export interface ReflectionFacts {
  emotion: string | null;
  missionTitle: string | null;
  missionCategory: string | null;
  outcome: string | null;
  minutesAway: number;
  /** Optional note text — only included when the person allows AI reflection analysis. */
  note?: string;
}

const REFLECTION_RULES = `You write ONE or TWO short sentences for MERA, a grounding app, after a reset.
- Say what seemed to help or not, plainly, from the facts. Never diagnose, never give medical or emotional advice, never say "you have" a condition.
- No hype, no exclamation marks, no "you've got this". If it didn't help, say so kindly without fixing it.
- You may end with "I'll keep that in mind for future resets." when something helped.
Reply with JSON only: {"summary": string}`;

export function reflectionMessages(f: ReflectionFacts): ChatMessage[] {
  const facts = [
    f.emotion ? `Started: ${f.emotion}` : "",
    f.missionTitle ? `Mission: ${f.missionTitle} (${f.missionCategory})` : "",
    `Minutes away from the screen: ${f.minutesAway}`,
    f.outcome ? `After: ${f.outcome}` : "",
    f.note ? `Their note: """${f.note.slice(0, 400)}"""` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "user", content: `${REFLECTION_RULES}\n\nStarted: overwhelmed\nMission: Find the Movement (sensory)\nMinutes away from the screen: 5\nAfter: better\nTheir note: """the cold air helped"""` },
    { role: "assistant", content: `{"summary":"Cool air and a few minutes outside seemed to help this time. I'll keep that in mind for future resets."}` },
    { role: "user", content: facts },
  ];
}

export interface PatternFact {
  key: string;
  /** The deterministic sentence (always valid on its own). */
  sentence: string;
  /** Every number the sentence is allowed to mention. */
  numbers: number[];
}

const PATTERN_RULES = `Rephrase this observation from someone's own reset history in ONE calm sentence for MERA, a grounding app.
- Keep it an observation ("seems", "has helped"), never a diagnosis or advice. Use only the numbers given.
Reply with JSON only: {"sentence": string}`;

export function patternMessages(p: PatternFact): ChatMessage[] {
  return [{ role: "user", content: `${PATTERN_RULES}\n\nObservation: ${p.sentence}` }];
}
