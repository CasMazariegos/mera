# Tuning (Tinker-ready, not yet done)

MERA has **not** been fine-tuned. This folder is the place for it, so a tuned
model can be dropped in without restructuring anything.

## Why tune

The base Gemma model sometimes:

- writes more than MERA needs (MERA wants 1–2 short sentences),
- wraps JSON in prose or code fences, or misses a field (MERA then repairs once, or falls back),
- suggests something the safety rules reject (screens, journaling, unsafe places).

A MERA-tuned model should improve **brevity, schema compliance, safety compliance,
real-world relevance and non-clinical tone** — measurably.

## How it plugs in

1. Fine-tune (e.g. with [Tinker](https://thinkingmachines.ai/tinker/)) on `../datasets/` style examples:
   `{ emotion, context, preferred_output }` → the exact mission JSON MERA expects.
2. Serve the tuned model behind any OpenAI-compatible endpoint, or export it to ONNX for the browser.
3. Point MERA at it: `MODEL_ENDPOINT` / `MODEL_NAME` (Connected AI), or `LOCAL_MODEL.id` in `src/ai/local/protocol.ts` (on-device).
4. Run the same evaluation for both and compare:

```bash
npm run eval -- <base-model-id> q4      # baseline
npm run eval -- <tuned-model-id> q4     # tuned
```

`../evaluation/last-run.json` records every case. Compare: schema compliance on the
first try, fully valid on the first try, fallback rate, screen-dependent suggestions,
median instruction length, latency. **No improvement is claimed until those numbers show it.**
