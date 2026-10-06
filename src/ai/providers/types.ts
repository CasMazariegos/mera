/**
 * MeraAIProvider — the only AI surface the UI talks to. Providers are swappable:
 *   LocalGemmaProvider    Gemma 3 1B in this browser (WebGPU/WASM). Nothing leaves the device.
 *   RemoteGemmaProvider   Opt-in Gemma behind MERA's server (OpenAI-compatible endpoint).
 *   FallbackResetProvider Deterministic library + templates. Always available, offline.
 */
import type { GeneratedMission } from "@/types";
import type { MissionRequest } from "@/ai/schemas/mission";
import type { ChatMessage, PatternFact, ReflectionFacts } from "@/ai/prompts/prompts";

export type ProviderId = "local-gemma" | "remote-gemma" | "fallback";

export interface TextResult {
  text: string;
  source: ProviderId;
}

export interface PatternResult extends TextResult {
  key: string;
}

export interface MeraAIProvider {
  readonly id: ProviderId;
  generateResetMission(req: MissionRequest): Promise<GeneratedMission>;
  summarizeReflection(facts: ReflectionFacts): Promise<TextResult>;
  analyzePatterns(facts: PatternFact[]): Promise<PatternResult[]>;
  generateDailyReset(req: MissionRequest): Promise<GeneratedMission>;
}

export type TaskName = "mission" | "reflection" | "pattern";

/**
 * One model call. Local transports run `messages` directly; the remote transport
 * sends only `task` + structured `input` (+ `repair`) and MERA's server rebuilds
 * the same prompts — so the remote endpoint can't be used as a general chatbot.
 */
export interface CompletionRequest {
  task: TaskName;
  input: unknown;
  messages: ChatMessage[];
  repair?: { output: string; problem: string };
  maxTokens: number;
}

/** A model transport: request in, raw text out (untrusted). Throws ProviderError when unavailable. */
export interface ModelTransport {
  readonly id: Exclude<ProviderId, "fallback">;
  complete(req: CompletionRequest): Promise<string>;
}

export type ProviderErrorReason = "unavailable" | "invalid_output" | "unsafe_output" | "timeout" | "network";

export class ProviderError extends Error {
  readonly reason: ProviderErrorReason;
  constructor(reason: ProviderErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "ProviderError";
    this.reason = reason;
  }
}
