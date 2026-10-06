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
  emotion: Emotion | null;
  /** Answer to "Can you step outside right now?" for this reset (null = not asked). */
  outside: boolean | null;
  mission: GeneratedMission | null;
  /** Phone-down timer: absolute end time, so it survives backgrounding and refresh. */
  phoneDownStartedAt: number | null;
  phoneDownEndsAt: number | null;
  /** Seconds actually spent in phone-down mode (set on return). */
  phoneDownSeconds: number;
  outcome: Outcome | null;
  reflectionId: string | null;
  insight: string | null;
}

export const initialState: FlowState = {
  step: "IDLE",
  resetId: null,
  startedAt: null,
  quiet: false,
  emotion: null,
  outside: null,
  mission: null,
  phoneDownStartedAt: null,
  phoneDownEndsAt: null,
  phoneDownSeconds: 0,
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
  | { type: "INSIGHT_READY"; insight: string | null }
  | { type: "DONE" }
  | { type: "EXIT" };

const SENSE_ORDER: Step[] = ["SENSE_5", "SENSE_4", "SENSE_3", "SENSE_2", "SENSE_1"];

function phoneDownElapsed(s: FlowState, now: number): number {
  if (!s.phoneDownStartedAt) return 0;
  const end = s.phoneDownEndsAt ?? now;
  return Math.max(0, Math.round((Math.min(now, end) - s.phoneDownStartedAt) / 1000));
}

export function transition(s: FlowState, e: FlowEvent): FlowState {
  if (e.type === "EXIT") return initialState;

  switch (s.step) {
    case "IDLE":
      if (e.type === "GROUND_ME") return { ...initialState, step: "INTRO", resetId: e.resetId, startedAt: e.now };
      if (e.type === "START_MISSION") return { ...initialState, step: "MISSION_READY", resetId: e.resetId, startedAt: e.now, mission: e.mission, emotion: e.emotion ?? null };
      return s;
    case "INTRO":
      if (e.type === "START_RESET") return { ...s, step: "BODY_AWARENESS", quiet: e.quiet ?? false };
      return s;
    case "BODY_AWARENESS":
      if (e.type === "CONTINUE") return { ...s, step: "BREATHING" };
      return s;
    case "BREATHING":
      if (e.type === "BREATHING_DONE" || e.type === "CONTINUE") return { ...s, step: "SENSE_5" };
      return s;
    case "SENSE_5":
    case "SENSE_4":
    case "SENSE_3":
    case "SENSE_2":
    case "SENSE_1": {
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
        return { ...s, step: "PHONE_DOWN", phoneDownStartedAt: e.now, phoneDownEndsAt: e.now + (e.durationMs ?? s.mission.durationMinutes * 60_000) };
      }
      return s;
    case "PHONE_DOWN":
      if (e.type === "PHONE_DOWN_FINISHED" || e.type === "END_EARLY") {
        const ended = e.type === "END_EARLY" ? { ...s, phoneDownEndsAt: e.now } : s;
        return { ...ended, step: "RETURN", phoneDownSeconds: phoneDownElapsed(ended, e.now) };
      }
      return s;
    case "RETURN":
      if (e.type === "PICK_OUTCOME") return { ...s, step: "REFLECTION", outcome: e.outcome };
      return s;
    case "REFLECTION":
      if (e.type === "REFLECTION_SAVED") return { ...s, step: "AI_REFLECTION", reflectionId: e.reflectionId };
      if (e.type === "SKIP_REFLECTION") return { ...s, step: "AI_REFLECTION", reflectionId: null };
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
