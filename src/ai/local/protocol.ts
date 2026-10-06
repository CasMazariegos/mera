/**
 * MERA's on-device model: Gemma 3 1B instruction-tuned, ONNX, 4-bit
 * (onnx-community/gemma-3-1b-it-ONNX, Gemma Terms of Use), pinned per variant.
 * Sizes are the exact bytes transformers.js fetches for each variant (weights +
 * tokenizer/config), from the Hugging Face API.
 *
 * Two revisions: the q4f16 WebGPU build uses the current revision; the CPU/WASM
 * build stays on the last revision whose q4 graph uses only ops ONNX Runtime's
 * WASM backend implements (the newer one adds GatherBlockQuantized).
 */
export const LOCAL_MODEL = {
  id: "onnx-community/gemma-3-1b-it-ONNX",
  label: "Gemma 3 1B",
  license: "Gemma Terms of Use",
  variants: {
    webgpu: { revision: "a58439f40017d3b99c7d378ff525e54e0ba08ebf", dtype: "q4f16", bytes: 783_858_998 },
    wasm: { revision: "7769a8aff8978adbdcd57ad7915a97ba389fb547", dtype: "q4", bytes: 1_680_159_727 },
  },
} as const;

export type ModelDevice = keyof typeof LOCAL_MODEL.variants;
export type ModelErrorReason = "memory" | "network" | "unavailable";
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ToWorker = { type: "load" } | { type: "complete"; id: number; messages: ChatTurn[]; maxTokens: number } | { type: "cancel" };

export type FromWorker =
  | { type: "progress"; loaded: number; total: number }
  | { type: "starting" }
  | { type: "ready"; device: ModelDevice }
  | { type: "result"; id: number; output: string; ms: number }
  | { type: "cancelled"; id: number }
  | { type: "error"; id?: number; reason: ModelErrorReason; detail?: string; file?: string; downloadedBytes?: number };

/** Aggregate progress across a variant's files against its known total, so it never jumps back. */
export function downloadProgress(files: Iterable<{ loaded: number; total: number }>, expectedBytes: number): { loaded: number; total: number } {
  let loaded = 0;
  let total = 0;
  for (const f of files) {
    loaded += f.loaded;
    total += f.total;
  }
  return { loaded, total: Math.max(total, expectedBytes) };
}

/** "https://huggingface.co/<model>/resolve/<rev>/onnx/x.onnx_data" → "onnx/x.onnx_data"; null for other URLs. */
export function modelFileFromUrl(url: string): string | null {
  const prefix = `https://huggingface.co/${LOCAL_MODEL.id}/resolve/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length).split("?")[0]!;
  const slash = rest.indexOf("/");
  return slash > 0 ? decodeURIComponent(rest.slice(slash + 1)) : null;
}

export function weightUrls(device: ModelDevice): string[] {
  const v = LOCAL_MODEL.variants[device];
  const base = `https://huggingface.co/${LOCAL_MODEL.id}/resolve/${v.revision}/onnx/model_${v.dtype}.onnx`;
  return device === "webgpu" ? [base, `${base}_data`] : [base];
}
