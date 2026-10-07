/**
 * The GROUND ME flow as a deterministic state machine.
 *
 * Pure: `transition(state, event)` returns the next state or the same object
 * when an event doesn't apply in the current state (so stray taps are no-ops).
 * The UI renders `state.step`; side effects (timers, AI calls, saving) live in
 * the flow component and only ever *send events*. That keeps every path
 * testable and lets the state be persisted across an accidental refresh.
 *
 * IDLE → INTRO → BODY_AWARENESS → BREATHING → SENSE_5…SENSE_1 → EMOTION_CHECK
 *   (or, from breathing or any sense step, "I'm ready to step away" → EMOTION_CHECK)
 *   → MISSION_GENERATION → MISSION_READY → PHONE_DOWN → RETURN → REFLECTION
 *   → AI_REFLECTION → COMPLETE → (DONE) IDLE
 * EXIT from any step returns to IDLE.
 */
import type { Emotion, GeneratedMission, Outcome } from "@/types";

export const STEPS = [
  "IDLE",
  "INTRO",
  "BODY_AWARENESS",
  "BREATHING",
  "SENSE_5",
  "SENSE_4",
  "SENSE_3",
  "SENSE_2",
  "SENSE_1",
  "EMOTION_CHECK",
  "MISSION_GENERATION",
  "MISSION_READY",
  "PHONE_DOWN",
  "RETURN",
  "REFLECTION",
  "AI_REFLECTION",
  "COMPLETE",
] as const;
export type Step = (typeof STEPS)[number];

export interface FlowState {
  step: Step;
  /** Reset record id (created at START). */
  resetId: string | null;
  startedAt: number | null;
  /** "I need something quieter": less motion, no sound or haptics. */
  quiet: boolean;
  /** "quick" if the person stepped away before the five senses finished. */
  path: "quick" | "full";
  emotion: Emotion | null;
  /** Answer to "Can you step outside right now?" for this reset (null = not asked). */
  outside: boolean | null;
  mission: GeneratedMission | null;
  /** Phone-down timer: absolute end time, so it survives backgrounding and refresh. */
  phoneDownStartedAt: number | null;
  phoneDownEndsAt: number | null;
  /** Planned phone-down length, in seconds (set on "I'm going"). */
  phoneDownPlannedSeconds: number;
  /** Seconds actually spent away from the screen (set on return). The "back in the world" number. */
  phoneDownSeconds: number;
  /** True if the timer ran out; false if the person ended early. */
  phoneDownCompleted: boolean;
  outcome: Outcome | null;
  reflectionId: string | null;
  insight: string | null;
}

export const initialState: FlowState = {
  step: "IDLE",
  resetId: null,
  startedAt: null,
  quiet: false,
  path: "full",
  emotion: null,
  outside: null,
  mission: null,
  phoneDownStartedAt: null,
  phoneDownEndsAt: null,
  phoneDownPlannedSeconds: 0,
  phoneDownSeconds: 0,
  phoneDownCompleted: false,
  outcome: null,
  reflectionId: null,
  insight: null,
};

export type FlowEvent =
  | { type: "GROUND_ME"; resetId: string; now: number }
  /** Daily Reset / Check-in: skip straight to a ready mission (no grounding needed). */
  | { type: "START_MISSION"; resetId: string; now: number; mission: GeneratedMission; emotion?: Emotion }
  | { type: "START_RESET"; quiet?: boolean }
  | { type: "CONTINUE" }
  /** "I'm ready to step away": skip the rest of grounding, straight to the check-in. */
  | { type: "STEP_AWAY" }
  | { type: "BREATHING_DONE" }
  | { type: "SENSE_DONE" }
  | { type: "PICK_EMOTION"; emotion: Emotion }
  | { type: "SET_OUTSIDE"; outside: boolean }
  | { type: "MISSION_READY"; mission: GeneratedMission }
  /** `durationMs` overrides the mission length (demo mode's accelerated timer). */
  | { type: "GO"; now: number; durationMs?: number }
  | { type: "REGENERATE" }
  | { type: "PHONE_DOWN_FINISHED"; now: number }
  | { type: "END_EARLY"; now: number }
  | { type: "PICK_OUTCOME"; outcome: Outcome }
  | { type: "REFLECTION_SAVED"; reflectionId: string | null }
  | { type: "SKIP_REFLECTION" }
  /** After "worse" (or "same"): this reset is saved, and a new one starts at a different mission. */
  | { type: "TRY_ANOTHER"; resetId: string; now: number }
  | { type: "INSIGHT_READY"; insight: string | null }
  | { type: "DONE" }
  | { type: "EXIT" };

const SENSE_ORDER: Step[] = ["SENSE_5", "SENSE_4", "SENSE_3", "SENSE_2", "SENSE_1"];

/** Longest stretch counted beyond the plan: time actually away, not a phone left in a drawer all day. */
export const MAX_OVERTIME_MS = 30 * 60_000;

/**
 * Real seconds away. Counted from timestamps (not intervals), so backgrounding,
 * screen lock and refresh don't skew it. If the timer ended while the screen was
 * off, the person's return is the end (capped), because that time was spent away too.
 */
function phoneDownElapsed(s: FlowState, now: number): number {
  if (!s.phoneDownStartedAt) return 0;
  const cap = (s.phoneDownEndsAt ?? now) + MAX_OVERTIME_MS;
  return Math.max(0, Math.round((Math.min(now, cap) - s.phoneDownStartedAt) / 1000));
}

export function transition(s: FlowState, e: FlowEvent): FlowState {
  if (e.type === "EXIT") return initialState;

  switch (s.step) {
    case "IDLE":
      if (e.type === "GROUND_ME") return { ...initialState, step: "INTRO", resetId: e.resetId, startedAt: e.now };
      if (e.type === "START_MISSION")
        return { ...initialState, step: "MISSION_READY", resetId: e.resetId, startedAt: e.now, mission: e.mission, emotion: e.emotion ?? null };
      return s;
    case "INTRO":
      if (e.type === "START_RESET") return { ...s, step: "BODY_AWARENESS", quiet: e.quiet ?? false };
      return s;
    case "BODY_AWARENESS":
      if (e.type === "CONTINUE") return { ...s, step: "BREATHING" };
      return s;
    case "BREATHING":
      if (e.type === "STEP_AWAY") return { ...s, step: "EMOTION_CHECK", path: "quick" };
      if (e.type === "BREATHING_DONE" || e.type === "CONTINUE") return { ...s, step: "SENSE_5" };
      return s;
    case "SENSE_5":
    case "SENSE_4":
    case "SENSE_3":
    case "SENSE_2":
    case "SENSE_1": {
      if (e.type === "STEP_AWAY") return { ...s, step: "EMOTION_CHECK", path: "quick" };
      if (e.type !== "SENSE_DONE" && e.type !== "CONTINUE") return s;
      const i = SENSE_ORDER.indexOf(s.step);
      return { ...s, step: i < SENSE_ORDER.length - 1 ? SENSE_ORDER[i + 1]! : "EMOTION_CHECK" };
    }
    case "EMOTION_CHECK":
      if (e.type === "PICK_EMOTION") return { ...s, step: "MISSION_GENERATION", emotion: e.emotion };
      return s;
    case "MISSION_GENERATION":
      if (e.type === "SET_OUTSIDE") return { ...s, outside: e.outside };
      if (e.type === "MISSION_READY") return { ...s, step: "MISSION_READY", mission: e.mission };
      return s;
    case "MISSION_READY":
      // "Something else": ask for a different mission.
      if (e.type === "REGENERATE") return { ...s, step: "MISSION_GENERATION" };
      if (e.type === "GO" && s.mission) {
        const ms = e.durationMs ?? s.mission.durationMinutes * 60_000;
        return { ...s, step: "PHONE_DOWN", phoneDownStartedAt: e.now, phoneDownEndsAt: e.now + ms, phoneDownPlannedSeconds: Math.round(ms / 1000) };
      }
      return s;
    case "PHONE_DOWN":
      if (e.type === "PHONE_DOWN_FINISHED") return { ...s, step: "RETURN", phoneDownSeconds: phoneDownElapsed(s, e.now), phoneDownCompleted: true };
      if (e.type === "END_EARLY") {
        const ended = { ...s, phoneDownEndsAt: Math.min(e.now, s.phoneDownEndsAt ?? e.now) };
        return { ...ended, step: "RETURN", phoneDownSeconds: phoneDownElapsed(ended, e.now), phoneDownCompleted: false };
      }
      return s;
    case "RETURN":
      if (e.type === "PICK_OUTCOME") return { ...s, step: "REFLECTION", outcome: e.outcome };
      return s;
    case "REFLECTION":
      if (e.type === "REFLECTION_SAVED") return { ...s, step: "AI_REFLECTION", reflectionId: e.reflectionId };
      if (e.type === "SKIP_REFLECTION") return { ...s, step: "AI_REFLECTION", reflectionId: null };
      if (e.type === "TRY_ANOTHER")
        // Keep how they felt and the last mission (so it isn't offered again); everything else starts fresh.
        return {
          ...initialState,
          step: "MISSION_GENERATION",
          resetId: e.resetId,
          startedAt: e.now,
          quiet: s.quiet,
          path: s.path,
          emotion: s.emotion,
          outside: s.outside,
          mission: s.mission,
        };
      return s;
    case "AI_REFLECTION":
      if (e.type === "INSIGHT_READY") return { ...s, step: "COMPLETE", insight: e.insight };
      return s;
    case "COMPLETE":
      if (e.type === "DONE") return initialState;
      return s;
  }
}

/** Steps that hide all navigation (distraction-free). */
export function isImmersive(step: Step): boolean {
  return step !== "IDLE";
}

/** Rough progress through the grounding part (0–1), for an unobtrusive progress hint. */
export function groundingProgress(step: Step): number {
  const order: Step[] = ["INTRO", "BODY_AWARENESS", "BREATHING", ...SENSE_ORDER, "EMOTION_CHECK"];
  const i = order.indexOf(step);
  return i < 0 ? 1 : i / (order.length - 1);
}
