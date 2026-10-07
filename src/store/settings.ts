/**
 * Preferences and privacy switches, persisted in this browser only.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Preferences } from "@/types";

export type AiMode = "local" | "remote" | "off";

export interface Settings extends Preferences {
  /** Which Gemma provider MERA may use. "off" = reset library only. */
  aiMode: AiMode;
  /** Let Gemma read reflection notes (local always; remote only with the next switch too). */
  aiReflectionAnalysis: boolean;
  /** Remote Gemma may receive the text of a reflection note. Off by default. */
  allowNotesRemote: boolean;
  theme: "system" | "light" | "dark";
  contrast: "normal" | "more";
  textSize: "normal" | "large" | "larger";
  reducedMotion: "system" | "reduce";
  sound: boolean;
  haptics: boolean;
  /** Demo mode: shorter timers for presentations, clearly labelled. */
  demo: boolean;
  /** "Reset personalization": missions ignore history from before this time. */
  personalizationSince: number | null;
  /** Has seen the welcome and finished (or skipped) "get started". */
  onboarded: boolean;
  set: (patch: Partial<Settings>) => void;
  resetPersonalization: () => void;
}

export const DEFAULT_PREFERENCES: Preferences = {
  canGoOutside: "ask_each_time",
  usualMinutes: 5,
  lowMobility: false,
  avoidSound: false,
  avoidSmell: false,
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      aiMode: "local",
      aiReflectionAnalysis: true,
      allowNotesRemote: false,
      theme: "system",
      contrast: "normal",
      textSize: "normal",
      reducedMotion: "system",
      sound: true,
      haptics: true,
      demo: false,
      onboarded: false,
      personalizationSince: null,
      set: (patch) => set(patch),
      resetPersonalization: () => set({ ...DEFAULT_PREFERENCES }),
    }),
    { name: "mera.settings", version: 1 },
  ),
);

export function prefersReducedMotion(s: Pick<Settings, "reducedMotion">): boolean {
  if (s.reducedMotion === "reduce") return true;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
