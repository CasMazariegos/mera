# MERA — Gemma evaluation (real model, measured)

Two kinds of evidence, kept separate:

1. **Contract tests** (no model): prove MERA's rules hold whatever a model says —
   schema validation, safety rules, one repair retry, fallback, grounding of
   pattern numbers, privacy of notes. `npm test`: **46 / 46 pass**. `npm run test:e2e`: **3 / 3**.
2. **Real-model evaluation** (`npm run eval`): Gemma 3 1B instruction-tuned, ONNX
   4-bit (`onnx-community/gemma-3-1b-it-ONNX`, CPU revision `7769a8a`), through
   MERA's real prompts, validators and safety rules. Mocked tests are not evidence
   of model quality; this is.

## Run of 2026-10-06 (partial)

Environment: Windows 11 laptop, Node 24, transformers.js on CPU (q4). **Not** a
browser or phone measurement. The run was stopped by the OS after **11 of 18**
cases because the machine ran low on memory; the remaining 7 (low mobility,
avoid-sound, 2-minute, history-personalization and repeat-avoidance cases) are
**unmeasured**.

| Case | Result |
| --- | --- |
| overwhelmed · afternoon · outside | ✘ fallback — asked for more minutes than allowed (`too_long_duration`), even after repair |
| anxious · afternoon · outside | ✔ "Feel the Warmth" |
| angry · afternoon · outside | ✔ "Feel the Warmth" |
| sad · afternoon · outside | ✔ "Simple Movement" (after 1 repair) |
| overstimulated · afternoon · outside | ✘ fallback — empty `secondaryInstruction` rejected by the schema |
| scattered · afternoon · outside | ✔ "Feel the Ground" |
| drained · afternoon · outside | ✘ fallback — empty `secondaryInstruction` rejected by the schema |
| not sure · afternoon · outside | ✔ "Warmth on Skin" |
| indoor only · overwhelmed | ✔ "Warmth" |
| indoor only · angry | ✔ "Warm Blanket" |
| night · anxious | ✔ "Simple Movement" (after 1 repair) |

**Summary (11 cases):** 8 accepted (73%), of which 2 needed the one repair retry;
3 fell back to the reset library (27%). No unsafe mission reached a person — every
rejected output fell back. Latency on CPU: ~40–190 s per case (with other work
competing for CPU); expect far less on WebGPU.

**What changed after this run:** two of the three fallbacks were caused by MERA's
own schema treating an empty optional field (`""`) as invalid. It now treats an
empty optional field as absent (`src/ai/schemas/mission.ts`, covered by a test).
That should turn those two cases into accepted missions, but **that has not been
re-measured**.

**Observations:** the 1B model leans on warmth/temperature missions ("Feel the
Warmth" twice) — fine and safe, but repetitive; a larger Gemma (Connected AI) or a
MERA-tuned model should diversify. This is the baseline for `src/ai/tuning`.

## Re-running

```bash
npm run eval                     # all 18 cases; needs ~2 GB free RAM and ~1.7 GB model download on first run
cat src/ai/evaluation/last-run.json
```

## Live personalization check (2026-10-06)

`npx tsx --tsconfig tsconfig.app.json scripts/live-gemma-check.ts` runs MERA's real `GemmaProvider` (prompt → model → schema → safety → personalization check → one repair) against the live deployment's Connected Gemma (**Gemma 4 26B A4B on Cloudflare Workers AI**).

| Case | Signals sent | Result | Mission | Why (cited) |
| --- | --- | --- | --- | --- |
| No history | none | ✓ accepted | Soft Evening Sounds (sensory) | none, correctly |
| Walks helped + note "walking and the cool air helped" | `cat_helped:movement:2:2`, `act_helped:walking:2`, `note_theme:walking`, `note_theme:fresh_air` | ✓ | Cool Air Walk (movement, outdoor) | all four |
| Same history, now anxious | same | ✓ | Cool Air Walk | all four |
| Same history, indoor only | + `feeling_helped:overwhelmed:movement` | ✓ | Slow Hallway Walk (indoor) | four of five |
| Same history, low mobility | none (walking/movement dropped by settings) | ✓ | Texture of Nature (seated, sensory) | none, correctly |

**5 of 5 accepted, 0 unsafe, history changed the mission in every case where it existed, and the reason only cited ids the model was given.**

What earlier runs of this check caught, now fixed:
- Sending walking signals with low mobility made Gemma suggest walking; the safety rule rejected it twice. Signals that conflict with settings are now filtered out first.
- With no history, Gemma copied the worked example's signal id. The prompt now says "nothing yet" explicitly, and invented ids are dropped, never trusted.

This is a small, synthetic check of the personalization path. It's not a substitute for re-running the full `npm run eval` on the new prompt.
