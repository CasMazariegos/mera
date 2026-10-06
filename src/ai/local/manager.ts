/**
 * Local Gemma manager: one worker, one consent, one download for the whole app.
 * Entirely optional — every MERA feature works without it.
 */
import { useSyncExternalStore } from "react";
import { assessDevice, readDeviceSignals, type IncapableReason } from "./device-capability";
import { CHUNK_CACHE, readManifest } from "./resumable-download";
import { LOCAL_MODEL, weightUrls, type ChatTurn, type FromWorker, type ModelDevice, type ModelErrorReason, type ToWorker } from "./protocol";

export type LocalStatus =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "incapable"; reason: IncapableReason }
  | { kind: "off"; cached: boolean }
  | { kind: "offline" }
  | { kind: "loading"; pct: number | null }
  | { kind: "ready"; device: ModelDevice }
  | { kind: "busy"; device: ModelDevice }
  | { kind: "error"; reason: ModelErrorReason | "timeout"; detail?: string; file?: string; downloadedBytes?: number };

const OPT_IN_KEY = "mera.localModel.optIn";
const TIMEOUT_MS = 90_000;

let status: LocalStatus = { kind: "checking" };
const listeners = new Set<() => void>();
let worker: Worker | null = null;
let device: ModelDevice = "wasm";
let likely: ModelDevice = "wasm";
let reqId = 0;
let pending: { id: number; resolve: (r: string | null) => void; timer: ReturnType<typeof setTimeout> } | null = null;
let ready: Promise<boolean> | null = null;
let resolveReady: ((ok: boolean) => void) | null = null;

function set(next: LocalStatus) {
  status = next;
  for (const l of listeners) l();
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const optedIn = () => storage()?.getItem(OPT_IN_KEY) === "1";
export const expectedDownloadBytes = () => LOCAL_MODEL.variants[likely].bytes;

export async function isCached(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const store = await caches.open(CHUNK_CACHE);
    for (const d of Object.keys(LOCAL_MODEL.variants) as ModelDevice[]) {
      const ms = await Promise.all(weightUrls(d).map((u) => readManifest(store, u)));
      if (ms.every((m) => m?.complete)) return true;
    }
  } catch {
    // treat as not cached
  }
  return false;
}

let initialised = false;
function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  void (async () => {
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") return set({ kind: "unsupported" });
    const a = assessDevice(await readDeviceSignals());
    if (!a.ok) return set({ kind: "incapable", reason: a.reason });
    likely = a.device;
    const cached = await isCached();
    if (optedIn()) {
      if (!cached && !navigator.onLine) return set({ kind: "offline" });
      start();
    } else set({ kind: "off", cached });
  })();
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === "progress") {
      const pct = m.total ? Math.min(99, Math.round((m.loaded / m.total) * 100)) : null;
      if (status.kind === "loading") set({ kind: "loading", pct: pct === null ? null : Math.max(pct, status.pct ?? 0) });
    } else if (m.type === "starting") {
      if (status.kind === "loading") set({ kind: "loading", pct: null });
    } else if (m.type === "ready") {
      device = m.device;
      set({ kind: pending ? "busy" : "ready", device });
      resolveReady?.(true);
    } else if (m.type === "result" || m.type === "cancelled") {
      if (pending?.id === m.id) {
        clearTimeout(pending.timer);
        pending.resolve(m.type === "result" ? m.output : null);
        pending = null;
      }
      set({ kind: "ready", device });
    } else if (m.type === "error") {
      if (pending && (m.id === undefined || pending.id === m.id)) {
        clearTimeout(pending.timer);
        pending.resolve(null);
        pending = null;
      }
      resolveReady?.(false);
      set({ kind: "error", reason: m.reason, detail: m.detail, file: m.file, downloadedBytes: m.downloadedBytes });
    }
  };
  w.onerror = (e) => {
    resolveReady?.(false);
    set({ kind: "error", reason: "unavailable", detail: e.message || "The model worker failed to start." });
  };
  worker = w;
  return w;
}

function start() {
  if (status.kind === "incapable" || status.kind === "unsupported") return;
  ready = new Promise<boolean>((r) => (resolveReady = r));
  set({ kind: "loading", pct: null });
  getWorker().postMessage({ type: "load" } satisfies ToWorker);
}

/** After explicit consent: remember it and start the one-time download. */
export function enableLocal() {
  if (status.kind === "incapable" || status.kind === "unsupported") return;
  storage()?.setItem(OPT_IN_KEY, "1");
  if (!navigator.onLine) {
    void isCached().then((c) => (c ? start() : set({ kind: "offline" })));
    return;
  }
  start();
}

export async function disableLocal() {
  storage()?.removeItem(OPT_IN_KEY);
  cancelLocal();
  worker?.terminate();
  worker = null;
  ready = null;
  set({ kind: "off", cached: await isCached() });
}

export async function removeLocalDownload() {
  await disableLocal();
  try {
    if (typeof caches !== "undefined") await caches.delete(CHUNK_CACHE);
  } catch {
    // already gone
  }
  set({ kind: "off", cached: false });
}

export function retryLocal() {
  worker?.terminate();
  worker = null;
  if (optedIn()) start();
}

export function cancelLocal() {
  if (pending) worker?.postMessage({ type: "cancel" } satisfies ToWorker);
}

export function localUsable(s: LocalStatus = status): boolean {
  return s.kind === "ready" || s.kind === "busy";
}

/** Run one completion on the device. Resolves null when unavailable, cancelled, failed or timed out. */
export async function completeLocal(messages: ChatTurn[], maxTokens: number): Promise<string | null> {
  if (!optedIn() || !ready) return null;
  if (!(await ready)) return null;
  if (pending) {
    cancelLocal();
    clearTimeout(pending.timer);
    pending.resolve(null);
    pending = null;
  }
  const id = ++reqId;
  set({ kind: "busy", device });
  return new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => {
      if (pending?.id !== id) return;
      worker?.postMessage({ type: "cancel" } satisfies ToWorker);
      pending = null;
      set({ kind: "ready", device });
      resolve(null);
    }, TIMEOUT_MS);
    pending = { id, resolve, timer };
    getWorker().postMessage({ type: "complete", id, messages, maxTokens } satisfies ToWorker);
  });
}

export function getLocalStatus(): LocalStatus {
  return status;
}

function subscribe(l: () => void) {
  init();
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot: LocalStatus = { kind: "checking" };
export function useLocalModel(): LocalStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => serverSnapshot,
  );
}

/** Start device checks without rendering anything (e.g. at app start). */
export function warmLocalStatus() {
  init();
}
