import { beforeEach, describe, expect, it } from "vitest";
import { buildMissionRequest, detectPatterns, thisWeek, timeOfDay } from "@/features/patterns/patterns";
import { completedResets, db, deleteAllData, deleteDemoData, deleteJournalEntry, exportAll, newId, saveReset } from "@/data/db";
import { addSampleHistory } from "@/data/demo";
import { numbersAreGrounded, unsafeTextReason } from "@/ai/safety/safety";
import { DEFAULT_PREFERENCES } from "@/store/settings";
import type { ResetRecord } from "@/types";

function reset(over: Partial<ResetRecord>): ResetRecord {
  return {
    id: newId(),
    startedAt: Date.now(),
    emotion: "overwhelmed",
    mission: { title: "A Slow Five", durationMinutes: 5, category: "movement", environment: "outdoor", instruction: "Take a slow walk.", source: "library" },
    phoneDownSeconds: 300,
    outcome: "better",
    quiet: false,
    hour: 18,
    completedAt: Date.now(),
    ...over,
  };
}

beforeEach(async () => {
  await deleteAllData();
});

describe("patterns (deterministic, non-clinical)", () => {
  it("says nothing until there's enough history", () => {
    expect(detectPatterns([reset({}), reset({})])).toEqual([]);
  });

  it("counts what helped, with numbers it can stand behind", () => {
    const h = [reset({}), reset({}), reset({ outcome: "same" }), reset({ mission: { title: "Open a Window", durationMinutes: 3, category: "indoor", environment: "indoor", instruction: "Open a window.", source: "library" }, outcome: "same" }), reset({ mission: { title: "Open a Window", durationMinutes: 3, category: "indoor", environment: "indoor", instruction: "Open a window.", source: "library" }, outcome: "worse" })];
    const facts = detectPatterns(h);
    const best = facts.find((f) => f.key === "best-movement")!;
    expect(best.sentence).toBe("Movement resets have helped in 2 of your last 3 tries.");
    expect(numbersAreGrounded(best.sentence, best.numbers)).toBe(true);
    for (const f of facts) expect(unsafeTextReason(f.sentence)).toBeNull();
    expect(facts.some((f) => f.key === "outdoor-vs-indoor")).toBe(true);
    expect(facts.some((f) => f.key === "time-evening")).toBe(true);
  });

  it("mission requests carry counts and preferences — never free text or location", () => {
    const req = buildMissionRequest({ emotion: "angry", prefs: DEFAULT_PREFERENCES, history: [reset({}), reset({ outcome: "worse" })], now: new Date(2026, 9, 6, 22) });
    expect(req).toMatchObject({ timeOfDay: "night", helped: { movement: 1 }, notHelped: { movement: 1 }, recentTitles: ["A Slow Five", "A Slow Five"] });
    expect(JSON.stringify(req)).not.toMatch(/note|journal|lat|lng/i);
    expect(timeOfDay(7)).toBe("morning");
  });

  it("no streaks — just a gentle weekly count", () => {
    const now = new Date(2026, 9, 7, 12); // Wednesday
    expect(thisWeek([reset({ completedAt: new Date(2026, 9, 5, 9).getTime() }), reset({ completedAt: new Date(2026, 9, 1, 9).getTime() })], now)).toBe(1);
  });
});

describe("local data, privacy controls", () => {
  it("stores resets and journal entries locally, exports them, and deletes them", async () => {
    await saveReset(reset({}));
    const id = newId();
    await db.journal.put({ id, createdAt: Date.now(), kind: "text", text: "cold air helped" });
    expect(await completedResets()).toHaveLength(1);
    const exported = JSON.parse(await (await exportAll()).text());
    expect(exported).toMatchObject({ app: "MERA", resets: [{ emotion: "overwhelmed" }], journal: [{ text: "cold air helped" }] });

    await deleteJournalEntry(id);
    expect(await db.journal.count()).toBe(0);
    await deleteAllData();
    expect(await db.resets.count()).toBe(0);
  });

  it("demo sample data is labelled and removable without touching real data", async () => {
    await saveReset(reset({}));
    await addSampleHistory();
    expect((await db.resets.toArray()).filter((r) => r.demo).length).toBe(6);
    await deleteDemoData();
    const left = await db.resets.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]!.demo).toBeUndefined();
  });
});
