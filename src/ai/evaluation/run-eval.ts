/**
 * MERA mission evaluation — real model, no mocks.
 *
 * Runs an open-weight Gemma (default: the same Gemma 3 1B q4 the browser uses,
 * via transformers.js on Node/CPU) on synthetic cases from datasets/eval-cases.json
 * through MERA's real prompts, validators and safety rules, and reports:
 *   schema compliance (1st try / after repair), safety compliance, final AI
 *   acceptance vs. fallback, screen-dependent suggestions, length, latency.
 *
 * This is the baseline a Tinker-tuned model would be compared against
 * (see ../tuning/README.md). It never claims improvement on its own.
 *
 *   npm run eval -- [model-id] [dtype]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import { missionMessages, repairMessages } from "@/ai/prompts/prompts";
import { missionSchema, missionRequestSchema, type MissionRequest } from "@/ai/schemas/mission";
import { unsafeMissionReason } from "@/ai/safety/safety";
import { parseWith } from "@/ai/providers/llm";
import { examplesFor } from "@/features/missions/select";

const model = process.argv[2] ?? "onnx-community/gemma-3-1b-it-ONNX";
const dtype = (process.argv[3] ?? "q4") as "q4";
const revision = model === "onnx-community/gemma-3-1b-it-ONNX" ? "7769a8aff8978adbdcd57ad7915a97ba389fb547" : undefined;

const cases = (JSON.parse(readFileSync(new URL("../datasets/eval-cases.json", import.meta.url), "utf8")) as Array<{ id: string; request: unknown }>).map(
  (c) => ({
    id: c.id,
    req: missionRequestSchema.parse(c.request) as MissionRequest,
  }),
);

const t0 = Date.now();
const generate = await pipeline("text-generation", model, { dtype, revision });
console.log(`Loaded ${model} (${dtype}) in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${cases.length} cases`);

type Row = {
  id: string;
  firstSchema: boolean;
  firstSafe: boolean;
  accepted: boolean;
  repaired: boolean;
  screen: boolean;
  words: number;
  ms: number;
  problem?: string;
  title?: string;
};
const rows: Row[] = [];
const run = async (messages: { role: "user" | "assistant"; content: string }[]) => {
  const out = (await generate(messages, { max_new_tokens: 160, do_sample: false })) as Array<{ generated_text: Array<{ content: string }> }>;
  return out[0]!.generated_text.at(-1)!.content;
};

for (const { id, req } of cases) {
  const started = Date.now();
  const msgs = missionMessages(req, examplesFor(req));
  const check = (v: Parameters<typeof unsafeMissionReason>[0] & { durationMinutes: number; title: string }) =>
    v.durationMinutes > req.minutes ? "too_long_duration" : req.recentTitles.includes(v.title) ? "repeated_title" : unsafeMissionReason(v, req);
  const raw1 = await run(msgs);
  const schema1 = parseWith(missionSchema, raw1);
  const full1 = parseWith(missionSchema, raw1, check);
  let accepted = full1.ok;
  let repaired = false;
  let final = full1;
  if (!full1.ok) {
    const raw2 = await run(repairMessages(msgs, raw1, full1.problem));
    final = parseWith(missionSchema, raw2, check);
    accepted = final.ok;
    repaired = final.ok;
  }
  const text = final.ok ? `${final.value.instruction} ${final.value.secondaryInstruction ?? ""}` : "";
  rows.push({
    id,
    firstSchema: schema1.ok,
    firstSafe: full1.ok,
    accepted,
    repaired,
    screen: /\b(phone|screen|app|scroll)\b/i.test(text) && !/leave your phone|phone (inside|down|away|in your pocket)/i.test(text),
    words: text.split(/\s+/).filter(Boolean).length,
    ms: Date.now() - started,
    problem: final.ok ? undefined : final.problem,
    title: final.ok ? final.value.title : undefined,
  });
  const r = rows.at(-1)!;
  console.log(
    `${r.accepted ? "✔" : "✘"} ${id.padEnd(28)} ${r.accepted ? `"${r.title}"` : `→ fallback (${r.problem})`}${r.repaired ? " [repaired]" : ""} ${r.ms}ms`,
  );
}

const pct = (n: number) => `${Math.round((n / rows.length) * 100)}%`;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const ok = rows.filter((r) => r.accepted);
const summary = {
  model,
  dtype,
  runtime: "transformers.js on Node (CPU)",
  cases: rows.length,
  schemaCompliantFirstTry: pct(rows.filter((r) => r.firstSchema).length),
  fullyValidFirstTry: pct(rows.filter((r) => r.firstSafe).length),
  acceptedAfterOneRepair: pct(ok.length),
  fellBackToLibrary: pct(rows.length - ok.length),
  screenDependentSuggestions: rows.filter((r) => r.screen).length,
  medianInstructionWords: median(ok.map((r) => r.words)),
  medianLatencyMs: median(rows.map((r) => r.ms)),
};
console.log("\n" + JSON.stringify(summary, null, 2));
writeFileSync(new URL("./last-run.json", import.meta.url), JSON.stringify({ when: new Date().toISOString(), summary, rows }, null, 2));
