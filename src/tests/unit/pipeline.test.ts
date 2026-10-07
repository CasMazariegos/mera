/**
 * The personalization pipeline, end to end, from what is actually stored:
 *   IndexedDB history + notes → normalized request (signal ids) → Gemma prompt
 *   → structured answer → schema + safety + personalization checks → rendered mission.
 * And the data controls that sit on top of the same storage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db, deleteAllData, deleteJournal, deleteResetHistory, exportAll } from "@/data/db";
import { addSampleHistory } from "@/data/demo";
import { missionRequestFor } from "@/features/missions/request";
import { GemmaProvider } from "@/ai/providers/llm";
import { ProviderError, type CompletionRequest, type ModelTransport } from "@/ai/providers/types";
import { selectMission } from "@/features/missions/select";
import { DEFAULT_PREFERENCES, useSettings } from "@/store/settings";

function gemma(answer: (req: CompletionRequest) => string): ModelTransport & { calls: CompletionRequest[] } {
  const calls: CompletionRequest[] = [];
  return {
    id: "local-gemma",
    calls,
    async complete(r) {
      calls.push(r);
      if (calls.length > 2) throw new ProviderError("unavailable");
      return answer(r);
    },
  };
}

const prefs = { ...DEFAULT_PREFERENCES, canGoOutside: "yes" as const };

beforeEach(async () => {
  await deleteAllData();
  useSettings.setState({ personalizationSince: null });
});

describe("personalization pipeline from stored history", () => {
  it("sample history in IndexedDB reaches Gemma's prompt as signals, and its cited reason survives validation", async () => {
    await addSampleHistory(); // walks and a sound/movement reset that helped, plus "Walking and the cool air helped."
    const req = await missionRequestFor("overstimulated", prefs);
    expect(req.signals).toEqual(expect.arrayContaining(["cat_helped:movement:2:2", "act_helped:walking:2", "note_theme:fresh_air", "note_theme:sound"]));

    const transport = gemma(() =>
      JSON.stringify({
        title: "Quiet Movement",
        durationMinutes: 5,
        category: "movement",
        environment: "outdoor",
        instruction: "Take a five-minute walk somewhere familiar.",
        secondaryInstruction: "Leave your headphones off and notice three distant sounds.",
        reason: "Walking and fresh air have helped in your recent resets.",
        personalizationSignals: ["cat_helped:movement:2:2", "note_theme:fresh_air"],
      }),
    );
    const m = await new GemmaProvider(transport).generateResetMission(req);

    // What Gemma actually received: the person's own facts, by id and in words. Never the note text itself.
    const prompt = transport.calls[0]!.messages.at(-1)!.content;
    expect(prompt).toContain("[cat_helped:movement:2:2] Movement resets helped in 2 of the last 2 tries.");
    expect(prompt).toContain("[note_theme:fresh_air]");
    expect(prompt).not.toContain("cool air helped");

    expect(m).toMatchObject({ title: "Quiet Movement", source: "local-gemma", reason: "Walking and fresh air have helped in your recent resets." });
    expect(m.signals).toEqual(["cat_helped:movement:2:2", "note_theme:fresh_air"]);
  });

  it("the same feeling with no history produces no personalization claims", async () => {
    const req = await missionRequestFor("overstimulated", prefs);
    expect(req.signals).toEqual([]);
    const transport = gemma(() =>
      JSON.stringify({
        title: "Three Far Sounds",
        durationMinutes: 4,
        category: "sensory",
        environment: "either",
        instruction: "Stand by an open window and find three sounds far away.",
        reason: "This has helped you before.", // a claim with nothing behind it
        personalizationSignals: ["act_helped:walking:3"], // an id it was never given
      }),
    );
    const m = await new GemmaProvider(transport).generateResetMission(req);
    expect(m.reason).toBeUndefined();
    expect(m.signals).toBeUndefined();
  });

  it("history changes the offline mission too, and 'Reset personalization' turns that off", async () => {
    await addSampleHistory();
    const personal = selectMission(await missionRequestFor("overstimulated", prefs), "s");
    expect(personal.reason).toBeTruthy();
    useSettings.setState({ personalizationSince: Date.now() });
    const fresh = await missionRequestFor("overstimulated", prefs);
    expect(fresh.signals).toEqual([]);
    expect(selectMission(fresh, "s").reason).toBeUndefined();
  });

  it("a large history stays bounded: at most 6 signals, 3 recent titles", async () => {
    for (let i = 0; i < 8; i++) await addSampleHistory().then(() => db.resets.toCollection().modify((r) => void (r.demo = false)));
    const req = await missionRequestFor("overwhelmed", prefs);
    expect(await db.resets.count()).toBeGreaterThanOrEqual(40);
    expect(req.signals.length).toBeLessThanOrEqual(6);
    expect(req.recentTitles.length).toBeLessThanOrEqual(3);
  });
});

describe("data controls do what they say", () => {
  beforeEach(async () => {
    await addSampleHistory();
    await db.checkins.put({ id: "c1", createdAt: Date.now(), emotion: "sad", level: 3 });
  });

  it("export includes resets, notes and check-ins", async () => {
    const json = JSON.parse(await (await exportAll()).text());
    expect(json.resets.length).toBe(6);
    expect(json.journal.length).toBe(2);
    expect(json.checkins.length).toBe(1);
  });
  it("delete reset history removes resets only", async () => {
    await deleteResetHistory();
    expect(await db.resets.count()).toBe(0);
    expect(await db.journal.count()).toBe(2);
  });
  it("delete journal removes notes and unlinks them from resets", async () => {
    await deleteJournal();
    expect(await db.journal.count()).toBe(0);
    expect((await db.resets.toArray()).every((r) => !r.reflectionId)).toBe(true);
  });
  it("delete all removes everything", async () => {
    await deleteAllData();
    expect(await db.resets.count()).toBe(0);
    expect(await db.journal.count()).toBe(0);
    expect(await db.checkins.count()).toBe(0);
  });
});
