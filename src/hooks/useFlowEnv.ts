/** What every grounding scene needs: settings, quiet mode, cues and demo timing. */
import { useReducedMotion } from "motion/react";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import type { CueOptions } from "@/lib/cues";

export function useFlowEnv() {
  const settings = useSettings();
  const quiet = useFlow((s) => s.flow.quiet);
  const osReduced = useReducedMotion();
  const reducedMotion = quiet || settings.reducedMotion === "reduce" || !!osReduced;
  const cues: CueOptions = { sound: settings.sound, haptics: settings.haptics, quiet };
  return {
    settings,
    quiet,
    reducedMotion,
    cues,
    demo: settings.demo,
    /** Demo mode shortens waits for presentations; real use keeps full timing. */
    timing: settings.demo ? { bodySeconds: 4, breathCycles: 2, phoneDownMs: 30_000 } : { bodySeconds: 9, breathCycles: 3, phoneDownMs: null as number | null },
  };
}
