import { describe, expect, it } from "vitest";
import { initialState, transition, type FlowEvent, type FlowState } from "@/features/grounding/machine";
import type { GeneratedMission } from "@/types";

const mission: GeneratedMission = {
  title: "Find the Movement",
  durationMinutes: 5,
  category: "sensory",
  environment: "outdoor",
  instruction: "Step outside and notice three things moving.",
  source: "library",
};

function run(events: FlowEvent[], from: FlowState = initialState) {
  return events.reduce(transition, from);
}

describe("grounding state machine", () => {
  it("walks the full GROUND ME path deterministically", () => {
    const steps: string[] = [];
    let s = initialState;
    const events: FlowEvent[] = [
      { type: "GROUND_ME", resetId: "r1", now: 1000 },
      { type: "START_RESET" },
      { type: "CONTINUE" },
      { type: "BREATHING_DONE" },
      { type: "SENSE_DONE" },
      { type: "SENSE_DONE" },
      { type: "SENSE_DONE" },
      { type: "SENSE_DONE" },
      { type: "SENSE_DONE" },
      { type: "PICK_EMOTION", emotion: "overwhelmed" },
      { type: "MISSION_READY", mission },
      { type: "GO", now: 10_000 },
      { type: "PHONE_DOWN_FINISHED", now: 10_000 + 5 * 60_000 },
      { type: "PICK_OUTCOME", outcome: "better" },
      { type: "SKIP_REFLECTION" },
      { type: "INSIGHT_READY", insight: "Fresh air seemed to help." },
    ];
    for (const e of events) {
      s = transition(s, e);
      steps.push(s.step);
    }
    expect(steps).toEqual([
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
    ]);
    expect(s).toMatchObject({ emotion: "overwhelmed", outcome: "better", phoneDownSeconds: 300, insight: "Fresh air seemed to help." });
    expect(transition(s, { type: "DONE" })).toBe(initialState);
  });

  it("ignores events that don't belong to the current step (stray taps are no-ops)", () => {
    const intro = run([{ type: "GROUND_ME", resetId: "r", now: 0 }]);
    expect(transition(intro, { type: "PICK_EMOTION", emotion: "sad" })).toBe(intro);
    expect(transition(initialState, { type: "GO", now: 1 })).toBe(initialState);
  });

  it("EXIT from any step returns to IDLE without keeping data", () => {
    const mid = run([{ type: "GROUND_ME", resetId: "r", now: 0 }, { type: "START_RESET", quiet: true }, { type: "CONTINUE" }]);
    expect(mid.quiet).toBe(true);
    expect(transition(mid, { type: "EXIT" })).toEqual(initialState);
  });

  it("phone-down time is computed from timestamps, so backgrounding and refresh don't break it", () => {
    const ready = run([
      { type: "GROUND_ME", resetId: "r", now: 0 },
      { type: "START_RESET" },
      { type: "CONTINUE" },
      { type: "CONTINUE" },
      ...Array(5).fill({ type: "SENSE_DONE" }),
      { type: "PICK_EMOTION", emotion: "anxious" },
      { type: "MISSION_READY", mission },
    ]);
    const down = transition(ready, { type: "GO", now: 60_000 });
    expect(down.phoneDownEndsAt).toBe(60_000 + 300_000);
    const early = transition(down, { type: "END_EARLY", now: 60_000 + 95_000 });
    expect(early).toMatchObject({ step: "RETURN", phoneDownSeconds: 95 });
  });

  it("demo mode can shorten the timer, and a daily reset starts at a ready mission", () => {
    const daily = transition(initialState, { type: "START_MISSION", resetId: "d", now: 0, mission });
    expect(daily).toMatchObject({ step: "MISSION_READY", emotion: null });
    expect(transition(daily, { type: "GO", now: 0, durationMs: 30_000 }).phoneDownEndsAt).toBe(30_000);
  });

  it("'Something else' asks for another mission, keeping the outdoor answer", () => {
    let s = run([
      { type: "GROUND_ME", resetId: "r", now: 0 },
      { type: "START_RESET" },
      { type: "CONTINUE" },
      { type: "CONTINUE" },
      ...Array(5).fill({ type: "SENSE_DONE" }),
      { type: "PICK_EMOTION", emotion: "angry" },
    ]);
    s = transition(s, { type: "SET_OUTSIDE", outside: false });
    s = transition(s, { type: "MISSION_READY", mission });
    s = transition(s, { type: "REGENERATE" });
    expect(s).toMatchObject({ step: "MISSION_GENERATION", outside: false, mission });
  });
});
