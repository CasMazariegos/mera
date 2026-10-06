/**
 * Breathe with MERA: in 4 s, hold 2 s, out 6 s, three times.
 * Pure timing so the animation, the captions and the tests all agree.
 */
export type BreathPhase = "in" | "hold" | "out";

export const BREATH_PATTERN: ReadonlyArray<{ phase: BreathPhase; seconds: number }> = [
  { phase: "in", seconds: 4 },
  { phase: "hold", seconds: 2 },
  { phase: "out", seconds: 6 },
];
export const BREATH_CYCLES = 3;
export const CYCLE_SECONDS = BREATH_PATTERN.reduce((n, p) => n + p.seconds, 0);
export const TOTAL_SECONDS = CYCLE_SECONDS * BREATH_CYCLES;

export const PHASE_LABEL: Record<BreathPhase, string> = { in: "Breathe in", hold: "Hold", out: "Breathe out" };

export interface BreathMoment {
  done: boolean;
  cycle: number; // 1-based
  phase: BreathPhase;
  /** Whole seconds left in this phase (for the visible countdown). */
  secondsLeft: number;
  /** 0–1 progress through the current phase (drives MERA's scale). */
  phaseProgress: number;
}

/** Where we are `elapsedMs` into the exercise. */
export function breathAt(elapsedMs: number, cycles = BREATH_CYCLES): BreathMoment {
  const total = CYCLE_SECONDS * cycles * 1000;
  if (elapsedMs >= total) return { done: true, cycle: cycles, phase: "out", secondsLeft: 0, phaseProgress: 1 };
  const t = Math.max(0, elapsedMs);
  const cycle = Math.floor(t / (CYCLE_SECONDS * 1000));
  let within = t - cycle * CYCLE_SECONDS * 1000;
  for (const p of BREATH_PATTERN) {
    const len = p.seconds * 1000;
    if (within < len) {
      return { done: false, cycle: cycle + 1, phase: p.phase, secondsLeft: Math.ceil((len - within) / 1000), phaseProgress: within / len };
    }
    within -= len;
  }
  return { done: true, cycle: cycles, phase: "out", secondsLeft: 0, phaseProgress: 1 };
}

/** MERA's body scale for a moment: grows on the in-breath, rests on hold, softens out. */
export function breathScale(m: BreathMoment, min = 0.86, max = 1.08): number {
  const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;
  if (m.phase === "in") return min + (max - min) * ease(m.phaseProgress);
  if (m.phase === "hold") return max;
  return max - (max - min) * ease(m.phaseProgress);
}
