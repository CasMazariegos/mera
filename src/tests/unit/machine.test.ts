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

describe("shorter path to the real world", () => {
  const start: FlowEvent[] = [{ type: "GROUND_ME", resetId: "r1", now: 0 }, { type: "START_RESET" }, { type: "CONTINUE" }];

  it("'I'm ready to step away' goes from breathing straight to the check-in", () => {
    const s = run([...start, { type: "STEP_AWAY" }]);
    expect(s).toMatchObject({ step: "EMOTION_CHECK", path: "quick" });
  });

  it("works from any sense step too, and the full path is the default", () => {
    expect(run([...start, { type: "BREATHING_DONE" }, { type: "SENSE_DONE" }, { type: "STEP_AWAY" }]).step).toBe("EMOTION_CHECK");
    expect(run([...start, { type: "BREATHING_DONE" }]).path).toBe("full");
  });

  it("ignores step-away where it doesn't apply (no skipping the mission or the return)", () => {
    const ready = run([...start, { type: "STEP_AWAY" }, { type: "PICK_EMOTION", emotion: "scattered" }, { type: "MISSION_READY", mission }]);
    expect(transition(ready, { type: "STEP_AWAY" })).toBe(ready);
  });
});

describe("time back in the world", () => {
  const ready = run([{ type: "START_MISSION", resetId: "r1", now: 0, mission }]);
  const down = transition(ready, { type: "GO", now: 1_000 });

  it("records the plan from timestamps", () => {
    expect(down).toMatchObject({ step: "PHONE_DOWN", phoneDownPlannedSeconds: 300, phoneDownEndsAt: 301_000 });
  });

  it("ending early counts the real time and marks it not completed", () => {
    expect(transition(down, { type: "END_EARLY", now: 121_000 })).toMatchObject({ step: "RETURN", phoneDownSeconds: 120, phoneDownCompleted: false });
  });

  it("returning after the timer (screen was off) counts the extra time away, capped", () => {
    expect(transition(down, { type: "PHONE_DOWN_FINISHED", now: 421_000 })).toMatchObject({ phoneDownSeconds: 420, phoneDownCompleted: true });
    expect(transition(down, { type: "PHONE_DOWN_FINISHED", now: 10 * 3_600_000 }).phoneDownSeconds).toBe(300 + 30 * 60);
  });
});

describe("after 'worse'", () => {
  it("'Try a different reset' starts a new reset at a new mission, keeping how they felt", () => {
    const s = run([
      { type: "START_MISSION", resetId: "r1", now: 0, mission, emotion: "anxious" },
      { type: "GO", now: 0 },
      { type: "END_EARLY", now: 60_000 },
      { type: "PICK_OUTCOME", outcome: "worse" },
      { type: "TRY_ANOTHER", resetId: "r2", now: 70_000 },
    ]);
    expect(s).toMatchObject({ step: "MISSION_GENERATION", resetId: "r2", emotion: "anxious", outcome: null, phoneDownSeconds: 0 });
    // The previous mission is kept only so it isn't offered again.
    expect(s.mission?.title).toBe(mission.title);
  });
});
