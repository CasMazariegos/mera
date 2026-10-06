/**
 * Can this device realistically run the on-device model? Checked BEFORE any
 * download so a phone never starts a ~0.8–1.7 GB transfer it can't use.
 *
 * - iOS / iPadOS (every browser there is WebKit): only with WebGPU + shader-f16
 *   (newer iOS), using the GPU variant and the resumable download — a single
 *   ~784 MB response is what failed there ("TypeError: Load failed"). Without
 *   WebGPU the CPU variant (~1.7 GB) can't fit in an iOS page, so: not supported
 *   on-device (MERA uses its reset library, or opt-in remote Gemma).
 * - navigator.deviceMemory < 4 GB: not enough memory for either variant.
 * - WebGPU with shader-f16: the q4f16 variant (~784 MB) on the GPU.
 * - Otherwise the CPU/WASM variant (~1.7 GB file, more RAM): needs ≥ 8 GB when
 *   the browser reports memory. Browsers that don't report it (Safari, Firefox)
 *   are allowed — the person still sees the size and consents first.
 *
 * Pure decision logic is separate from reading the browser so it can be tested.
 */
import type { ModelDevice } from "./protocol";

export interface DeviceSignals {
  ios: boolean;
  webgpu: boolean;
  shaderF16: boolean;
  /** navigator.deviceMemory (GB, capped at 8 by browsers); null when not reported. */
  deviceMemoryGb: number | null;
}

export type IncapableReason = "ios" | "low_memory" | "cpu_low_memory";
export type Assessment = { ok: true; device: ModelDevice } | { ok: false; reason: IncapableReason };

export function assessDevice(s: DeviceSignals): Assessment {
  if (s.ios) return s.webgpu && s.shaderF16 ? { ok: true, device: "webgpu" } : { ok: false, reason: "ios" };
  if (s.deviceMemoryGb !== null && s.deviceMemoryGb < 4) return { ok: false, reason: "low_memory" };
  if (s.webgpu && s.shaderF16) return { ok: true, device: "webgpu" };
  if (s.deviceMemoryGb !== null && s.deviceMemoryGb < 8) return { ok: false, reason: "cpu_low_memory" };
  return { ok: true, device: "wasm" };
}

/** iPhone/iPod/iPad, including iPadOS which reports itself as a Mac with touch. */
export function isIOS(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Mac/i.test(platform) && maxTouchPoints > 1;
}

type GpuLike = { requestAdapter(): Promise<{ features: { has(f: string): boolean } } | null> };

/** Read the signals from a browser (main thread or worker). */
export async function readDeviceSignals(nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator): Promise<DeviceSignals> {
  if (!nav) return { ios: false, webgpu: false, shaderF16: false, deviceMemoryGb: null };
  const n = nav as Navigator & { gpu?: GpuLike; deviceMemory?: number; platform?: string; maxTouchPoints?: number };
  const adapter = await (n.gpu ? n.gpu.requestAdapter().catch(() => null) : Promise.resolve(null));
  const webgpu = !!adapter;
  const shaderF16 = !!adapter?.features.has("shader-f16");
  return {
    ios: isIOS(n.userAgent ?? "", n.platform ?? "", n.maxTouchPoints ?? 0),
    webgpu,
    shaderF16,
    deviceMemoryGb: typeof n.deviceMemory === "number" ? n.deviceMemory : null,
  };
}

/** WebGPU only when the adapter supports shader-f16 (the q4f16 weights need it); otherwise CPU/WASM. */
export async function pickDevice(nav: object | undefined = typeof navigator === "undefined" ? undefined : navigator): Promise<ModelDevice> {
  try {
    const gpu = (nav as { gpu?: GpuLike } | undefined)?.gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    return adapter?.features.has("shader-f16") ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}
