/**
 * Live check of Connected Gemma with personalization: runs MERA's real
 * GemmaProvider (prompt → model → schema → safety → personalization check →
 * one repair) against a deployed server, for a few histories.
 *   npx tsx --tsconfig tsconfig.app.json scripts/live-gemma-check.ts [baseUrl]
 */
import { GemmaProvider } from "@/ai/providers/llm";
import { remoteTransport } from "@/ai/providers/remote";
import { buildMissionRequest } from "@/features/patterns/patterns";
import { LIBRARY } from "@/features/missions/library";
import { toMission } from "@/features/missions/select";
import { DEFAULT_PREFERENCES } from "@/store/settings";
import type { Emotion, Outcome, ResetRecord } from "@/types";

const base = process.argv[2] ?? "https://mera.casmazariegos.workers.dev";
const provider = new GemmaProvider(remoteTransport((input, init) => fetch(new URL(String(input), base), init)));

let t = Date.now() - 10 * 86_400_000;
const r = (id: string, emotion: Emotion, outcome: Outcome): ResetRecord => {
  t += 86_400_000;
  return {
    id: String(t),
    startedAt: t,
    emotion,
    mission: toMission(LIBRARY.find((m) => m.id === id)!),
    phoneDownSeconds: 330,
    outcome,
    quiet: false,
    hour: 18,
    completedAt: t + 4e5,
  };
};
// Newest first.
const walks = [
  r("move-slow-walk-001", "overwhelmed", "better"),
  r("sense-movement-001", "scattered", "better"),
  r("move-block-002", "angry", "better"),
  r("indoor-light-002", "drained", "same"),
].reverse();
const notes = [{ text: "Walking and the cool air helped.", at: Date.now() }];

const cases: Array<[string, Emotion, ResetRecord[], typeof notes, Partial<typeof DEFAULT_PREFERENCES>]> = [
  ["no history", "overstimulated", [], [], { canGoOutside: "yes" }],
  ["walks helped + note", "overstimulated", walks, notes, { canGoOutside: "yes" }],
  ["walks helped, now anxious", "anxious", walks, notes, { canGoOutside: "yes" }],
  ["walks helped, indoor only", "overwhelmed", walks, notes, { canGoOutside: "indoor_only" }],
  ["walks helped, low mobility", "drained", walks, [], { canGoOutside: "yes", lowMobility: true }],
];

for (const [name, emotion, history, n, prefs] of cases) {
  const req = buildMissionRequest({ emotion, prefs: { ...DEFAULT_PREFERENCES, ...prefs }, history, notes: n, now: new Date() });
  const t0 = Date.now();
  try {
    const m = await provider.generateResetMission(req);
    console.log(`\n✓ ${name} (${Date.now() - t0} ms)\n  signals in: ${req.signals.join(", ") || "none"}`);
    console.log(`  ${m.title} [${m.category}/${m.environment}, ${m.durationMinutes} min]: ${m.instruction} ${m.secondaryInstruction ?? ""}`);
    console.log(`  why: ${m.reason ?? "(none)"}  cited: ${m.signals?.join(", ") || "none"}`);
  } catch (e) {
    console.log(`\n✗ ${name} → would fall back to the library: ${e instanceof Error ? e.message : e}`);
  }
}
