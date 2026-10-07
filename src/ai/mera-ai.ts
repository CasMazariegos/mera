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
import { ProviderError, type MeraAIProvider, type PatternResult, type ProviderId, type TextResult } from "./providers/types";
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
  if (p.mode === "remote" && (typeof navigator === "undefined" || navigator.onLine !== false)) return remoteProvider;
  return fallbackProvider;
}

export function statusLabel(id: ProviderId): "LOCAL AI" | "CONNECTED AI" | "OFFLINE RESET" {
  return id === "local-gemma" ? "LOCAL AI" : id === "remote-gemma" ? "CONNECTED AI" : "OFFLINE RESET";
}

/**
 * Someone waiting for a reset shouldn't wait on a model. Each call has a time
 * budget (covering the first attempt and the one repair); past it, the library
 * answers and the late model result is ignored.
 */
export const DEFAULT_BUDGETS = { missionMs: 15_000, textMs: 12_000 };

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderError("timeout", `no answer within ${ms} ms`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

async function withFallback<T>(primary: MeraAIProvider, run: (p: MeraAIProvider) => Promise<T>, budgetMs: number): Promise<T> {
  if (primary.id === "fallback") return run(fallbackProvider);
  try {
    return await within(run(primary), budgetMs);
  } catch (err) {
    if (import.meta.env?.DEV) console.info(`[mera-ai] ${primary.id} → fallback:`, err instanceof Error ? err.message : err);
    return run(fallbackProvider);
  }
}

/**
 * Themes matched from the person's notes ("note_theme:…") follow the same rules
 * as the notes themselves: none when AI reflection analysis is off, and none to
 * Connected AI unless notes are separately allowed there.
 */
export function notePrivacy(req: MissionRequest, pol: AiPolicy, provider: ProviderId): MissionRequest {
  const allowed = pol.reflectionAnalysis && (provider !== "remote-gemma" || pol.allowNotesRemote);
  return allowed ? req : { ...req, signals: req.signals.filter((id) => !id.startsWith("note_theme:")) };
}

export function createMeraAI(policy: () => AiPolicy, budgets = DEFAULT_BUDGETS) {
  return {
    generateResetMission(req: MissionRequest): Promise<GeneratedMission> {
      const pol = policy();
      const primary = activeProvider(pol);
      return withFallback(primary, (p) => p.generateResetMission(notePrivacy(req, pol, p.id)), budgets.missionMs);
    },
    generateDailyReset(req: MissionRequest): Promise<GeneratedMission> {
      const pol = policy();
      return withFallback(activeProvider(pol), (p) => p.generateDailyReset(notePrivacy(req, pol, p.id)), budgets.missionMs);
    },
    summarizeReflection(facts: ReflectionFacts): Promise<TextResult> {
      const pol = policy();
      const primary = pol.reflectionAnalysis ? activeProvider(pol) : fallbackProvider;
      // Notes never go to the remote model unless separately allowed; never to any model if analysis is off.
      const safeFacts = !pol.reflectionAnalysis || (primary.id === "remote-gemma" && !pol.allowNotesRemote) ? { ...facts, note: undefined } : facts;
      return withFallback(primary, (p) => p.summarizeReflection(safeFacts), budgets.textMs);
    },
    analyzePatterns(facts: PatternFact[]): Promise<PatternResult[]> {
      const pol = policy();
      return withFallback(pol.reflectionAnalysis ? activeProvider(pol) : fallbackProvider, (p) => p.analyzePatterns(facts), budgets.textMs);
    },
  };
}
