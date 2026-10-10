/**
 * Gemma benchmark for the DEV post: MERA's real GemmaProvider (prompt → model →
 * schema → safety → personalization check → one repair) on 20 scenarios, plus 5
 * held-out ones written after the prompt was frozen and run once.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/gemma-benchmark.ts connected [runs] [baseUrl]
 *   npx tsx --tsconfig tsconfig.app.json scripts/gemma-benchmark.ts local-1b
 *
 * Results are appended case by case to docs/benchmark/<model>.jsonl, so a run that
 * gets killed (the 1B run is CPU and memory heavy) still leaves what it measured.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GemmaProvider } from "@/ai/providers/llm";
import { remoteTransport } from "@/ai/providers/remote";
import { ProviderError, type CompletionRequest, type ModelTransport } from "@/ai/providers/types";
import { buildMissionRequest } from "@/features/patterns/patterns";
import { LIBRARY } from "@/features/missions/library";
import { toMission } from "@/features/missions/select";
import { DEFAULT_PREFERENCES } from "@/store/settings";
import type { Emotion, Outcome, Preferences, ResetRecord } from "@/types";

// "replay": re-check the recorded first answers of a past local-1b run through today's code (no model).
const which = (process.argv[2] ?? "connected") as "connected" | "local-1b" | "replay";
const runs = Number(process.argv[3] ?? (which === "connected" ? 3 : 1));
const base = process.argv[4] ?? "https://mera.casmazariegos.workers.dev";

// ---------- histories (newest first) ----------
let t = Date.UTC(2026, 9, 1, 17);
function h(...items: Array<[string, Emotion, Outcome]>): ResetRecord[] {
  return items
    .map(([id, emotion, outcome]) => {
      t += 86_400_000;
      const m = LIBRARY.find((x) => x.id === id);
      if (!m) throw new Error(`no library mission ${id}`);
      return { id: `${id}-${t}`, startedAt: t, emotion, mission: toMission(m), phoneDownSeconds: 300, outcome, quiet: false, hour: 18, completedAt: t + 4e5 };
    })
    .reverse();
}
const WALKS = h(["move-slow-walk-001", "overwhelmed", "better"], ["sense-movement-001", "scattered", "better"], ["move-block-002", "angry", "better"], ["indoor-light-002", "drained", "same"]);
const SENSORY = h(["sense-near-far-002", "anxious", "better"], ["sense-textures-005", "anxious", "better"], ["nature-sky-002", "sad", "same"], ["sense-temperature-003", "overstimulated", "better"]);
const INDOOR = h(["indoor-window-001", "drained", "better"], ["indoor-cool-water-004", "angry", "better"], ["indoor-plant-003", "sad", "better"], ["move-block-002", "drained", "worse"]);
const NATURE_NO = h(["nature-greens-001", "sad", "same"], ["nature-wind-004", "sad", "worse"], ["nature-sky-002", "drained", "same"], ["indoor-object-005", "sad", "better"], ["indoor-light-002", "sad", "better"]);
const MIXED = h(["nature-growing-005", "scattered", "better"], ["move-stretch-003", "drained", "same"], ["sense-fresh-air-006", "overwhelmed", "better"], ["indoor-doorway-006", "anxious", "better"], ["move-feet-005", "angry", "worse"]);

type Case = { id: string; set: "dev" | "held-out"; emotion: Emotion; history: ResetRecord[]; notes?: string[]; prefs?: Partial<Preferences>; hour?: number };
const at = (hour: number) => new Date(2026, 9, 10, hour, 15);

const CASES: Case[] = [
  // No history: personalization must stay silent.
  { id: "fresh-overwhelmed", set: "dev", emotion: "overwhelmed", history: [] },
  { id: "fresh-anxious", set: "dev", emotion: "anxious", history: [] },
  { id: "fresh-angry", set: "dev", emotion: "angry", history: [] },
  { id: "fresh-sad", set: "dev", emotion: "sad", history: [] },
  { id: "fresh-not-sure", set: "dev", emotion: "not_sure", history: [] },
  // History that should shape the mission.
  { id: "walks-overstimulated", set: "dev", emotion: "overstimulated", history: WALKS, notes: ["Walking and the cool air helped."] },
  { id: "walks-anxious", set: "dev", emotion: "anxious", history: WALKS, notes: ["Walking and the cool air helped."] },
  { id: "sensory-anxious", set: "dev", emotion: "anxious", history: SENSORY, notes: ["Listening for far away sounds slowed me down."] },
  { id: "sensory-scattered", set: "dev", emotion: "scattered", history: SENSORY },
  { id: "indoor-drained", set: "dev", emotion: "drained", history: INDOOR, notes: ["Cold water on my hands reset me."] },
  { id: "nature-didnt-help-sad", set: "dev", emotion: "sad", history: NATURE_NO },
  { id: "mixed-overwhelmed", set: "dev", emotion: "overwhelmed", history: MIXED },
  // Settings must beat history.
  { id: "walks-indoor-only", set: "dev", emotion: "overwhelmed", history: WALKS, notes: ["Walking and the cool air helped."], prefs: { canGoOutside: "indoor_only" } },
  { id: "walks-low-mobility", set: "dev", emotion: "drained", history: WALKS, prefs: { lowMobility: true } },
  { id: "sensory-avoid-sound", set: "dev", emotion: "anxious", history: SENSORY, prefs: { avoidSound: true } },
  { id: "fresh-avoid-smell", set: "dev", emotion: "overstimulated", history: [], prefs: { avoidSmell: true } },
  { id: "walks-night", set: "dev", emotion: "anxious", history: WALKS, hour: 23 },
  { id: "fresh-night-angry", set: "dev", emotion: "angry", history: [], hour: 1 },
  { id: "two-minutes-scattered", set: "dev", emotion: "scattered", history: MIXED, prefs: { usualMinutes: 2 } },
  { id: "low-mobility-indoor-night", set: "dev", emotion: "overwhelmed", history: INDOOR, prefs: { lowMobility: true, canGoOutside: "indoor_only" }, hour: 22 },
  // First held-out set (prompt 2026-10-07.1). The prompt changed after the 1B run, so these are now ordinary cases.
  { id: "ho-walks-sad-morning", set: "dev", emotion: "sad", history: WALKS, notes: ["The walk to the corner and back was enough."], hour: 8 },
  { id: "ho-indoor-overstimulated-no-sound", set: "dev", emotion: "overstimulated", history: INDOOR, prefs: { avoidSound: true, canGoOutside: "indoor_only" } },
  { id: "ho-sensory-angry-night", set: "dev", emotion: "angry", history: SENSORY, hour: 23 },
  { id: "ho-mixed-drained-low-mobility", set: "dev", emotion: "drained", history: MIXED, notes: ["Sitting by the open door felt good."], prefs: { lowMobility: true } },
  { id: "ho-fresh-scattered-3min", set: "dev", emotion: "scattered", history: [], prefs: { usualMinutes: 3 } },
  // Held out: written after PROMPT_VERSION 2026-10-10.1 was frozen, run once per model, nothing changed after.
  { id: "ho2-fresh-overwhelmed-evening-indoor", set: "held-out", emotion: "overwhelmed", history: [], prefs: { canGoOutside: "indoor_only" }, hour: 19 },
  { id: "ho2-sensory-sad-2min", set: "held-out", emotion: "sad", history: SENSORY, prefs: { usualMinutes: 2 } },
  { id: "ho2-walks-angry-avoid-sound", set: "held-out", emotion: "angry", history: WALKS, notes: ["Walking and the cool air helped."], prefs: { avoidSound: true } },
  { id: "ho2-nature-no-overstimulated-night", set: "held-out", emotion: "overstimulated", history: NATURE_NO, hour: 22 },
  { id: "ho2-indoor-anxious-low-mobility", set: "held-out", emotion: "anxious", history: INDOOR, notes: ["Holding a warm mug helped."], prefs: { lowMobility: true } },
];

// ---------- transports ----------
async function localTransport(): Promise<ModelTransport> {
  const { pipeline } = await import("@huggingface/transformers");
  const t0 = Date.now();
  const generate = await pipeline("text-generation", "onnx-community/gemma-3-1b-it-ONNX", { dtype: "q4", revision: "7769a8aff8978adbdcd57ad7915a97ba389fb547" });
  console.log(`loaded Gemma 3 1B q4 in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return {
    id: "local-gemma",
    async complete(req: CompletionRequest) {
      const out = (await generate(req.messages as never, { max_new_tokens: req.maxTokens, do_sample: false })) as Array<{
        generated_text: Array<{ content: string }>;
      }>;
      return out[0]!.generated_text.at(-1)!.content;
    },
  };
}
let current = "";
const recorded = new Map<string, string>(
  which !== "replay"
    ? []
    : readFileSync(new URL("../docs/benchmark/local-1b.jsonl", import.meta.url), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as { id: string; firstRaw?: string })
        .filter((r) => r.firstRaw)
        .map((r) => [r.id, r.firstRaw!]),
);
const replayTransport: ModelTransport = {
  id: "local-gemma",
  async complete(req) {
    if (req.repair) throw new ProviderError("unavailable", `still rejected: ${req.repair.problem}`);
    return recorded.get(current)!;
  },
};
const inner =
  which === "connected"
    ? remoteTransport((input, init) => fetch(new URL(String(input), base), init))
    : which === "replay"
      ? replayTransport
      : await localTransport();

// Record why the first answer was sent back (the repair request carries the problem).
// The server allows 40 requests per 10 minutes per visitor; a 429 is not a model result, so wait and ask again.
let repairs: string[] = [];
let raws: string[] = [];
let modelMs = 0;
const transport: ModelTransport = {
  id: inner.id,
  async complete(req) {
    if (req.repair) repairs.push(req.repair.problem);
    for (let attempt = 0; ; attempt++) {
      const t0 = Date.now();
      try {
        const out = await inner.complete(req);
        modelMs += Date.now() - t0;
        raws.push(out);
        return out;
      } catch (e) {
        if (!(e instanceof ProviderError && /429/.test(e.message)) || attempt > 15) throw e;
        await new Promise((r) => setTimeout(r, 60_000));
      }
    }
  },
};
const provider = new GemmaProvider(transport);

// ---------- run ----------
const outDir = new URL("../docs/benchmark/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const outFile = new URL(`${which}.jsonl`, outDir);
writeFileSync(outFile, "");

for (const c of CASES.filter((x) => (!process.env.ONLY || x.id === process.env.ONLY) && (which !== "replay" || recorded.has(x.id)))) {
  current = c.id;
  const prefs: Preferences = { ...DEFAULT_PREFERENCES, canGoOutside: "yes", ...c.prefs };
  const req = buildMissionRequest({ emotion: c.emotion, prefs, history: c.history, notes: (c.notes ?? []).map((text) => ({ text, at: Date.now() })), now: at(c.hour ?? 15) });
  for (let run = 0; run < (c.set === "held-out" ? 1 : runs); run++) {
    repairs = [];
    raws = [];
    modelMs = 0;
    let row: Record<string, unknown> = { id: c.id, set: c.set, run, signalsIn: req.signals };
    try {
      const m = await provider.generateResetMission(req);
      row = { ...row, result: repairs.length ? "repaired" : "accepted", title: m.title, category: m.category, environment: m.environment, minutes: m.durationMinutes, instruction: m.instruction, secondary: m.secondaryInstruction, reason: m.reason, cited: m.signals ?? [] };
    } catch (e) {
      row = { ...row, result: "fallback", finalProblem: e instanceof ProviderError ? `${e.reason}: ${e.message}` : String(e) };
    }
    row = { ...row, firstProblem: repairs[0], firstRaw: repairs.length ? raws[0] : undefined, ms: modelMs };
    appendFileSync(outFile, JSON.stringify(row) + "\n");
    const ok = row.result !== "fallback";
    console.log(
      `${ok ? "✓" : "✗"} ${c.id.padEnd(34)} ${ok ? `"${row.title}"` : `fallback (${row.finalProblem})`}${row.firstProblem ? ` [1st: ${row.firstProblem}]` : ""}${ok && (row.cited as string[]).length ? ` why✓` : ""} ${row.ms}ms`,
    );
  }
}
