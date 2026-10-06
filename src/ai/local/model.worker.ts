/// <reference lib="webworker" />
/**
 * Runs Gemma 3 1B entirely in this browser (WebGPU with shader-f16, otherwise
 * WebAssembly), off the main thread so grounding stays smooth. Model files
 * download once in resumable 8 MB chunks kept in Cache Storage. Nothing the
 * person writes leaves this worker; errors carry a category and the runtime's
 * technical message, never content.
 */
import { InterruptableStoppingCriteria, env, pipeline, type TextGenerationPipeline } from "@huggingface/transformers";
import { pickDevice } from "./device-capability";
import { CHUNK_CACHE, DownloadError, resumableFetch } from "./resumable-download";
import { LOCAL_MODEL, downloadProgress, modelFileFromUrl, type FromWorker, type ModelErrorReason, type ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
env.useBrowserCache = false; // our chunk store is the cache (no second whole-file copy)
const ortVersion = (env.backends.onnx as { versions?: { web?: string } }).versions?.web;
if (ortVersion && env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`;

const fileBytes = new Map<string, { loaded: number; total: number; done: boolean }>();
let expectedBytes = 0;
const post = (m: FromWorker) => self.postMessage(m);

env.fetch = resumableFetch({
  fetchImpl: globalThis.fetch.bind(globalThis),
  openStore: () => caches.open(CHUNK_CACHE),
  isModelFile: modelFileFromUrl,
  onProgress: (file, loaded, total) => {
    fileBytes.set(file, { loaded, total, done: loaded >= total });
    post({ type: "progress", ...downloadProgress(fileBytes.values(), expectedBytes) });
  },
});

let loading: Promise<TextGenerationPipeline> | null = null;
const stopper = new InterruptableStoppingCriteria();

function reasonOf(err: unknown): ModelErrorReason {
  if (err instanceof DownloadError) return /QuotaExceeded|couldn't save/i.test(err.message) ? "unavailable" : "network";
  const m = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/memory|OOM|allocation|RangeError|Aborted\(\)/i.test(m)) return "memory";
  if (/fetch|network|Failed to load|NetworkError|ERR_/i.test(m)) return "network";
  return "unavailable";
}

function detailOf(err: unknown): string {
  if (err instanceof DownloadError) return `Download of ${err.file} stopped: ${err.message}`.slice(0, 600);
  return (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 600);
}

function load(): Promise<TextGenerationPipeline> {
  loading ??= (async () => {
    const device = await pickDevice(navigator);
    const variant = LOCAL_MODEL.variants[device];
    expectedBytes = variant.bytes;
    fileBytes.clear();
    let starting = false;
    const generator = (await pipeline("text-generation", LOCAL_MODEL.id, {
      revision: variant.revision,
      device,
      dtype: variant.dtype,
      progress_callback: (p: { status: string; file?: string }) => {
        if (starting || p.status !== "done" || !p.file || !/\.onnx/.test(p.file)) return;
        const all = [...fileBytes.values()];
        if (all.length && all.every((x) => x.done) && downloadProgress(all, variant.bytes).loaded >= variant.bytes * 0.95) {
          starting = true;
          post({ type: "starting" });
        }
      },
    })) as TextGenerationPipeline;
    post({ type: "ready", device });
    return generator;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "cancel") return stopper.interrupt();
  try {
    if (msg.type === "load") {
      await load();
      return;
    }
    const generate = await load();
    stopper.reset();
    const started = performance.now();
    const out = (await generate(msg.messages, { max_new_tokens: msg.maxTokens, do_sample: false, stopping_criteria: stopper })) as unknown as Array<{ generated_text: Array<{ content: string }> }>;
    if (stopper.interrupted) return post({ type: "cancelled", id: msg.id });
    post({ type: "result", id: msg.id, output: out[0]?.generated_text.at(-1)?.content ?? "", ms: Math.round(performance.now() - started) });
  } catch (err) {
    console.error("[mera-model]", err);
    const file = err instanceof DownloadError ? err.file : undefined;
    const downloadedBytes = file ? [...fileBytes.entries()].reduce((n, [f, v]) => n + (f === file ? (err as DownloadError).downloadedBytes : v.loaded), 0) : undefined;
    post({ type: "error", id: msg.type === "complete" ? msg.id : undefined, reason: reasonOf(err), detail: detailOf(err), file, downloadedBytes });
  }
};
