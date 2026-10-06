import { describe, expect, it } from "vitest";
import { breathAt, breathScale, TOTAL_SECONDS } from "@/features/breathing/breathing";
import { SENSES, senseFor } from "@/features/sensory/senses";
import { LIBRARY } from "@/features/missions/library";
import { eligible, rankLibrary, selectMission } from "@/features/missions/select";
import { unsafeMissionReason } from "@/ai/safety/safety";
import type { MissionRequest } from "@/ai/schemas/mission";

const base: MissionRequest = {
  emotion: "overwhelmed",
  canGoOutside: "yes",
  minutes: 5,
  lowMobility: false,
  avoidSound: false,
  avoidSmell: false,
  timeOfDay: "afternoon",
  helped: { nature: 0, movement: 0, sensory: 0, indoor: 0 },
  notHelped: { nature: 0, movement: 0, sensory: 0, indoor: 0 },
  recentTitles: [],
};

describe("breathing timer (in 4, hold 2, out 6, ×3)", () => {
  it("phases and countdown line up with the pattern", () => {
    expect(TOTAL_SECONDS).toBe(36);
    expect(breathAt(0)).toMatchObject({ phase: "in", cycle: 1, secondsLeft: 4 });
    expect(breathAt(4_100)).toMatchObject({ phase: "hold", secondsLeft: 2 });
    expect(breathAt(6_500)).toMatchObject({ phase: "out", secondsLeft: 6 });
    expect(breathAt(12_000)).toMatchObject({ phase: "in", cycle: 2 });
    expect(breathAt(36_000).done).toBe(true);
    expect(breathAt(12_000, 1).done).toBe(true);
  });
  it("MERA grows on the in-breath and settles on the out-breath", () => {
    expect(breathScale(breathAt(0))).toBeLessThan(breathScale(breathAt(3_900)));
    expect(breathScale(breathAt(5_000))).toBeCloseTo(1.08);
    expect(breathScale(breathAt(11_900))).toBeLessThan(0.9);
  });
});

describe("5-4-3-2-1 senses", () => {
  it("one sense per screen, counting down, no typing", () => {
    expect(SENSES.map((s) => s.count)).toEqual([5, 4, 3, 2, 1]);
    expect(SENSES[3]!.support).toBe("Nothing noticeable counts too.");
  });
  it("respects 'skip listening/smell' preferences", () => {
    expect(senseFor("SENSE_3", { avoidSound: true, avoidSmell: false }).prompt).not.toMatch(/sound/i);
    expect(senseFor("SENSE_2", { avoidSound: false, avoidSmell: true }).prompt).not.toMatch(/smell/i);
  });
});

describe("deterministic reset library", () => {
  it("every library mission passes the same safety rules as AI output", () => {
    for (const m of LIBRARY) expect(unsafeMissionReason(m), m.id).toBeNull();
  });
  it("covers every category and has night-safe, indoor and low-mobility options", () => {
    expect(new Set(LIBRARY.map((m) => m.category))).toEqual(new Set(["nature", "movement", "sensory", "indoor"]));
    expect(LIBRARY.filter((m) => eligible(m, { ...base, timeOfDay: "night", canGoOutside: "indoor_only", lowMobility: true, minutes: 2 })).length).toBeGreaterThan(0);
  });
  it("never sends indoor-only people outside, or anyone outside at night", () => {
    for (const r of [rankLibrary({ ...base, canGoOutside: "indoor_only" }), rankLibrary({ ...base, timeOfDay: "night" })]) {
      expect(r.every((m) => m.environment !== "outdoor")).toBe(true);
    }
  });
  it("low mobility gets no walking or movement missions", () => {
    expect(rankLibrary({ ...base, lowMobility: true }).some((m) => m.category === "movement" || m.needsWalking)).toBe(false);
  });
  it("is deterministic, prefers what helped before, and avoids repeats", () => {
    expect(selectMission(base, "s")).toEqual(selectMission(base, "s"));
    const movement = selectMission({ ...base, helped: { ...base.helped, movement: 3 } }, "s");
    expect(movement.category).toBe("movement");
    const first = selectMission(base, "s");
    expect(selectMission({ ...base, recentTitles: [first.title] }, "s").title).not.toBe(first.title);
  });
  it("always returns something, even with every constraint", () => {
    const m = selectMission({ ...base, minutes: 2, canGoOutside: "indoor_only", lowMobility: true, avoidSound: true, avoidSmell: true, timeOfDay: "night" });
    expect(m.environment).not.toBe("outdoor");
    expect(m.source).toBe("library");
  });
});

describe("touch grass preference", () => {
  it("when going out is possible (daytime), an outdoor mission wins", () => {
    for (const e of ["overwhelmed", "sad", "angry", "drained", "not_sure"] as const) {
      expect(selectMission({ ...base, emotion: e }, "x").environment, e).toBe("outdoor");
    }
  });
});
