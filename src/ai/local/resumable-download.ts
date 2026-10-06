/**
 * Resumable model download: fetch a large file in ranged chunks, retry each
 * chunk, and keep finished chunks in Cache Storage so a dropped connection (or a
 * closed tab) resumes where it stopped instead of starting over.
 *
 * Only model files are fetched this way (plain GETs from Hugging Face). Nothing
 * the person types is ever part of a request.
 *
 * Storage layout (one Cache Storage cache, keys under a reserved host that is
 * never fetched):
 *   <base>/manifest   JSON { total, chunkBytes, complete }
 *   <base>/<i>        the bytes of chunk i
 */

export const CHUNK_CACHE = "mera-model-chunks";
export const CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_ATTEMPTS = 3;
const STORE_HOST = "https://mera-model-chunks.invalid/";

/** The subset of the Cache API the downloader needs (a real Cache satisfies it). */
export interface ChunkStore {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export interface Manifest {
  total: number;
  chunkBytes: number;
  complete: boolean;
}

export class DownloadError extends Error {
  readonly file: string;
  /** Bytes of this file safely stored before the failure. */
  readonly downloadedBytes: number;
  readonly cause?: unknown;
  constructor(message: string, file: string, downloadedBytes: number, cause?: unknown) {
    super(message);
    this.name = "DownloadError";
    this.file = file;
    this.downloadedBytes = downloadedBytes;
    this.cause = cause;
  }
}

export interface DownloadOptions {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  store: ChunkStore;
  /** Short name for messages, e.g. "onnx/model_q4f16.onnx_data". */
  file: string;
  chunkBytes?: number;
  maxAttempts?: number;
  /** Wait before retry n (1-based). */
  backoffMs?: (attempt: number) => number;
  onProgress?: (loaded: number, total: number) => void;
}

export function storeKey(url: string, part: number | "manifest"): string {
  return `${STORE_HOST}${encodeURIComponent(url)}/${part}`;
}

export async function readManifest(store: ChunkStore, url: string): Promise<Manifest | null> {
  const r = await store.match(storeKey(url, "manifest"));
  if (!r) return null;
  try {
    return (await r.json()) as Manifest;
  } catch {
    return null;
  }
}

async function writeManifest(store: ChunkStore, url: string, m: Manifest) {
  await store.put(storeKey(url, "manifest"), new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } }));
}

/** "bytes 0-8388607/783858998" → 783858998 */
export function totalFromContentRange(header: string | null): number | null {
  const m = header?.match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Download `url` resumably and return it as a Blob assembled from the stored
 * chunks. Throws DownloadError naming the file and how much was stored.
 */
export async function resumableDownload(url: string, opts: DownloadOptions): Promise<Blob> {
  const { fetchImpl, store, file } = opts;
  const chunkBytes = opts.chunkBytes ?? CHUNK_BYTES;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const backoff = opts.backoffMs ?? ((n: number) => 1000 * 2 ** (n - 1));
  let stored = 0;

  /**
   * One chunk: request, read and length-check it, retrying the whole step up to
   * `maxAttempts` times (a body can break mid-stream as well as fail to start).
   */
  async function fetchChunk(start: number, end: number, expected: number | null): Promise<{ bytes: ArrayBuffer; status: number; contentRange: string | null }> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchImpl(url, { headers: { Range: `bytes=${start}-${end}` }, cache: "no-store" });
        if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        if (expected !== null && res.status === 206 && bytes.byteLength !== expected) throw new Error(`expected ${expected} bytes, got ${bytes.byteLength}`);
        return { bytes, status: res.status, contentRange: res.headers.get("content-range") };
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) await sleep(backoff(attempt));
      }
    }
    const why = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : String(lastErr);
    throw new DownloadError(`bytes ${start}-${end} failed after ${maxAttempts} attempts (${why})`, file, stored, lastErr);
  }

  async function putChunk(i: number, bytes: ArrayBuffer) {
    try {
      await store.put(storeKey(url, i), new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
    } catch (err) {
      const why = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      throw new DownloadError(`couldn't save chunk ${i} on this device (${why})`, file, stored, err);
    }
  }

  // 1. Size and chunk layout: from a previous attempt, or from the first range response.
  let manifest = await readManifest(store, url);
  if (!manifest) {
    const first = await fetchChunk(0, chunkBytes - 1, null);
    const total = first.status === 206 ? totalFromContentRange(first.contentRange) : first.bytes.byteLength; // 200: server sent the whole (small) file
    if (!total) throw new DownloadError("the server didn't report the file size", file, 0);
    if (first.status === 206 && first.bytes.byteLength !== Math.min(chunkBytes, total)) {
      throw new DownloadError(`expected ${Math.min(chunkBytes, total)} bytes, got ${first.bytes.byteLength}`, file, 0);
    }
    if (first.status === 200 && first.bytes.byteLength > chunkBytes * 4) {
      throw new DownloadError("the server doesn't support resumable downloads for this file", file, 0);
    }
    manifest = { total, chunkBytes: first.status === 200 ? Math.max(total, 1) : chunkBytes, complete: false };
    await putChunk(0, first.bytes);
    await writeManifest(store, url, manifest);
  }

  // 2. Fetch every missing chunk in order, counting the ones already stored.
  const count = Math.max(1, Math.ceil(manifest.total / manifest.chunkBytes));
  const parts: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * manifest.chunkBytes;
    const end = Math.min(manifest.total, start + manifest.chunkBytes) - 1;
    const expected = end - start + 1;
    let blob = await (await store.match(storeKey(url, i)))?.blob();
    if (!blob || blob.size !== expected) {
      const { bytes } = await fetchChunk(start, end, expected);
      await putChunk(i, bytes);
      blob = new Blob([bytes]);
    }
    parts.push(blob);
    stored += blob.size;
    opts.onProgress?.(stored, manifest.total);
  }

  if (!manifest.complete) await writeManifest(store, url, { ...manifest, complete: true });
  return new Blob(parts);
}

/** Wrap fetch so model files from `hostPrefix` download resumably; everything else passes through. */
export function resumableFetch(opts: {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  openStore: () => Promise<ChunkStore>;
  isModelFile: (url: string) => string | null;
  onProgress?: (file: string, loaded: number, total: number) => void;
}) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const file = opts.isModelFile(url);
    const headers = new Headers(init?.headers);
    // Metadata probes (Range: bytes=0-0) and non-GET requests go straight through.
    if (!file || headers.has("range") || (init?.method && init.method !== "GET")) return opts.fetchImpl(url, init);
    const store = await opts.openStore();
    const blob = await resumableDownload(url, {
      fetchImpl: opts.fetchImpl,
      store,
      file,
      onProgress: (loaded, total) => opts.onProgress?.(file, loaded, total),
    });
    return new Response(blob, { status: 200, headers: { "content-length": String(blob.size) } });
  };
}
