/**
 * MeraAI — the orchestrator the UI calls. Picks the provider the person chose
 * (local Gemma, opt-in remote Gemma, or off), and falls back to the
 * deterministic provider on ANY failure, so a reset never breaks.
 *
 * Every result carries its source, shown honestly in the UI.
 */
import type { MissionRequest } from "@/ai/schemas/mission";
import type { PatternFact, ReflectionFacts } from "@/ai/prompts/prompts";
import { localUsable } from "@/ai/local/manager";
import type { GeneratedMission } from "@/types";
import { FallbackResetProvider } from "./providers/fallback";
import { GemmaProvider } from "./providers/llm";
import { localTransport } from "./providers/local";
import { remoteTransport } from "./providers/remote";
import type { MeraAIProvider, PatternResult, ProviderId, TextResult } from "./providers/types";
import type { AiMode } from "@/store/settings";

export const fallbackProvider = new FallbackResetProvider();
const localProvider = new GemmaProvider(localTransport);
const remoteProvider = new GemmaProvider(remoteTransport());

export interface AiPolicy {
  mode: AiMode;
  /** Let Gemma read reflection notes at all. */
  reflectionAnalysis: boolean;
  /** Remote Gemma may receive a note's text. */
  allowNotesRemote: boolean;
}

/** The provider that would run right now, before trying it. */
export function activeProvider(p: AiPolicy): MeraAIProvider {
  if (p.mode === "local" && localUsable()) return localProvider;
  if (p.mode === "remote" && (typeof navigator === "undefined" || navigator.onLine)) return remoteProvider;
  return fallbackProvider;
}

export function statusLabel(id: ProviderId): "LOCAL AI" | "CONNECTED AI" | "OFFLINE RESET" {
  return id === "local-gemma" ? "LOCAL AI" : id === "remote-gemma" ? "CONNECTED AI" : "OFFLINE RESET";
}

async function withFallback<T>(primary: MeraAIProvider, run: (p: MeraAIProvider) => Promise<T>): Promise<T> {
  if (primary.id === "fallback") return run(fallbackProvider);
  try {
    return await run(primary);
  } catch (err) {
    if (import.meta.env?.DEV) console.info(`[mera-ai] ${primary.id} → fallback:`, err instanceof Error ? err.message : err);
    return run(fallbackProvider);
  }
}

export function createMeraAI(policy: () => AiPolicy) {
  return {
    generateResetMission(req: MissionRequest): Promise<GeneratedMission> {
      return withFallback(activeProvider(policy()), (p) => p.generateResetMission(req));
    },
    generateDailyReset(req: MissionRequest): Promise<GeneratedMission> {
      return withFallback(activeProvider(policy()), (p) => p.generateDailyReset(req));
    },
    summarizeReflection(facts: ReflectionFacts): Promise<TextResult> {
      const pol = policy();
      const primary = pol.reflectionAnalysis ? activeProvider(pol) : fallbackProvider;
      // Notes never go to the remote model unless separately allowed; never to any model if analysis is off.
      const safeFacts = !pol.reflectionAnalysis || (primary.id === "remote-gemma" && !pol.allowNotesRemote) ? { ...facts, note: undefined } : facts;
      return withFallback(primary, (p) => p.summarizeReflection(safeFacts));
    },
    analyzePatterns(facts: PatternFact[]): Promise<PatternResult[]> {
      const pol = policy();
      return withFallback(pol.reflectionAnalysis ? activeProvider(pol) : fallbackProvider, (p) => p.analyzePatterns(facts));
    },
  };
}
