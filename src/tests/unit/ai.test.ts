import { describe, expect, it } from "vitest";
import { GemmaProvider, extractJsonObject, parseWith } from "@/ai/providers/llm";
import { FallbackResetProvider } from "@/ai/providers/fallback";
import { ProviderError, type CompletionRequest, type ModelTransport } from "@/ai/providers/types";
import { createMeraAI } from "@/ai/mera-ai";
import { missionSchema, type MissionRequest } from "@/ai/schemas/mission";
import { numbersAreGrounded, unsafeMissionReason, unsafeTextReason } from "@/ai/safety/safety";
import { missionMessages } from "@/ai/prompts/prompts";
import { examplesFor } from "@/features/missions/select";

const req: MissionRequest = {
  emotion: "overwhelmed",
  canGoOutside: "yes",
  minutes: 5,
  lowMobility: false,
  avoidSound: false,
  avoidSmell: false,
  timeOfDay: "afternoon",
  helped: { nature: 2, movement: 0, sensory: 0, indoor: 0 },
  notHelped: { nature: 0, movement: 1, sensory: 0, indoor: 0 },
  recentTitles: [],
  signals: [],
};

const good = JSON.stringify({
  title: "Find the Movement",
  durationMinutes: 5,
  category: "sensory",
  environment: "outdoor",
  instruction: "Step outside and notice three things around you that are moving.",
  secondaryInstruction: "Let your attention stay with each one.",
});

function scripted(...outputs: string[]): ModelTransport & { calls: CompletionRequest[] } {
  const calls: CompletionRequest[] = [];
  return {
    id: "local-gemma",
    calls,
    async complete(r) {
      calls.push(r);
      const o = outputs.shift();
      if (o === undefined) throw new ProviderError("unavailable");
      return o;
    },
  };
}

describe("model output validation", () => {
  it("extracts JSON from prose or code fences, and rejects markup", () => {
    expect(extractJsonObject("Sure!\n```json\n" + good + "\n```")).toBe(good);
    expect(parseWith(missionSchema, good).ok).toBe(true);
    expect(parseWith(missionSchema, good.replace("Step outside", "<b>Step</b> outside")).ok).toBe(false);
    expect(parseWith(missionSchema, '{"title":"x"}').ok).toBe(false);
    expect(parseWith(missionSchema, "no json here").ok).toBe(false);
    // Measured on real Gemma output: an empty optional field means "absent", not invalid.
    const empty = parseWith(missionSchema, good.replace('"Let your attention stay with each one."', '""'));
    expect(empty.ok && empty.value.secondaryInstruction).toBeUndefined();
  });

  it("a broken optional reason costs the reason, not the mission (real Gemma 3 1B output)", () => {
    const raw =
      '{"title":"Quiet Space","durationMinutes":5,"category":"indoor","environment":"indoor","instruction":"Find a quiet spot where you can sit quietly.","secondaryInstruction":"Close your eyes and focus on your breathing.","reason":"Nothing yet, so reason is "" and personalizationSignals is [].","personalizationSignals":[]}';
    const r = parseWith(missionSchema, raw);
    expect(r.ok && r.value.title).toBe("Quiet Space");
    expect(r.ok && r.value.reason).toBeUndefined();
    // Anything else that's broken is still rejected.
    expect(parseWith(missionSchema, raw.replace('"Quiet Space"', '"Quiet "Space""')).ok).toBe(false);
  });

  it("valid Gemma output becomes a mission tagged with its source", async () => {
    const m = await new GemmaProvider(scripted(good)).generateResetMission(req);
    expect(m).toMatchObject({ title: "Find the Movement", source: "local-gemma" });
  });

  it("retries ONCE with a repair prompt, then succeeds", async () => {
    const t = scripted("I think you should go for a walk", good);
    const m = await new GemmaProvider(t).generateResetMission(req);
    expect(m.title).toBe("Find the Movement");
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1]!.repair?.problem).toBe("no JSON object");
    expect(t.calls[1]!.messages.at(-1)!.content).toMatch(/ONLY the JSON object/);
  });

  it("unsafe or invalid twice → provider error (caller falls back)", async () => {
    const unsafe = good.replace("Step outside and notice three things around you that are moving.", "Run across the road to the park and back.");
    await expect(new GemmaProvider(scripted(unsafe, unsafe)).generateResetMission(req)).rejects.toBeInstanceOf(ProviderError);
  });

  it("MeraAI falls back to the library on any failure — the reset never breaks", async () => {
    const ai = createMeraAI(() => ({ mode: "off", reflectionAnalysis: true, allowNotesRemote: false }));
    const m = await ai.generateResetMission(req);
    expect(m.source).toBe("library");
    expect(unsafeMissionReason(m, req)).toBeNull();
  });

  it("a slow or hanging model never holds up a reset: the library answers within the time budget", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => new Promise<Response>(() => {}); // Connected AI that never answers
    try {
      const ai = createMeraAI(() => ({ mode: "remote", reflectionAnalysis: true, allowNotesRemote: false }), { missionMs: 50, textMs: 50 });
      const t0 = Date.now();
      const m = await ai.generateResetMission(req);
      expect(m.source).toBe("library");
      expect(Date.now() - t0).toBeLessThan(1000);
      const r = await ai.summarizeReflection({ emotion: "sad", missionTitle: "x", missionCategory: "nature", outcome: "same", minutesAway: 3 });
      expect(r.source).toBe("fallback");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("malformed output twice (not JSON, then wrong shape) is never shown", async () => {
    await expect(new GemmaProvider(scripted("Sure! Here is a mission: go outside", '{"title": 7}')).generateResetMission(req)).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("indoor-only and night rules are enforced on model output", () => {
    const outdoor = {
      title: "Sky",
      durationMinutes: 4,
      category: "nature" as const,
      environment: "outdoor" as const,
      instruction: "Step outside and look at the sky for a while.",
    };
    expect(unsafeMissionReason(outdoor, { ...req, canGoOutside: "indoor_only" })).toBe("outdoor_for_indoor_only");
    expect(unsafeMissionReason(outdoor, { ...req, timeOfDay: "night" })).toBe("outdoor_at_night");
    expect(unsafeMissionReason({ ...outdoor, instruction: "Look at your phone for five minutes." })).toMatch(/unsafe_phrase/);
    expect(unsafeMissionReason({ ...outdoor, instruction: "Leave your phone inside and step outside for a moment." })).toBeNull();
  });

  it("touch isn't running (a false positive the live benchmark found)", () => {
    const m = { title: "Texture Search", durationMinutes: 4, category: "sensory" as const, environment: "either" as const, instruction: "Find three textures near you." };
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Run your fingertips over each one slowly." })).toBeNull();
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Run cool water over your hands." })).toBeNull();
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Go to a sink and run a small stream of cool water over your hands." })).toBeNull();
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Run down to the water." })).toMatch(/unsafe_phrase/);
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Lift your feet slightly higher than usual." })).toBeNull();
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Lift weights for five minutes." })).toMatch(/unsafe_phrase/);
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Run to the end of the street." })).toMatch(/unsafe_phrase/);
    expect(unsafeMissionReason({ ...m, secondaryInstruction: "Go for a short run." })).toMatch(/unsafe_phrase/);
  });
});

describe("non-clinical text", () => {
  it("rejects diagnosis, treatment, dependency and hype", () => {
    expect(unsafeTextReason("Your anxiety is caused by work.")).not.toBeNull();
    expect(unsafeTextReason("You should use breathing exercises to treat your anxiety.")).not.toBeNull();
    expect(unsafeTextReason("You've got this!!!")).not.toBeNull();
    expect(unsafeTextReason("Only I understand you, come back soon.")).not.toBeNull();
    expect(unsafeTextReason("Fresh air and walking seemed useful this time. I'll keep that in mind for future resets.")).toBeNull();
  });
  it("pattern numbers must be ones MERA computed", () => {
    expect(numbersAreGrounded("Outdoor movement helped in 4 of your last 5 resets.", [4, 5])).toBe(true);
    expect(numbersAreGrounded("Outdoor movement helped in 9 of your last 10 resets.", [4, 5])).toBe(false);
  });
  it("reflection falls back to honest template wording (no fake positivity on 'worse')", async () => {
    const r = await new FallbackResetProvider().summarizeReflection({
      emotion: "anxious",
      missionTitle: "Fresh Air",
      missionCategory: "sensory",
      outcome: "worse",
      minutesAway: 3,
    });
    expect(r.text).toMatch(/didn't help/);
    expect(unsafeTextReason(r.text)).toBeNull();
  });
  it("notes are withheld from Connected AI unless separately allowed", async () => {
    const seen: unknown[] = [];
    const ai = createMeraAI(() => ({ mode: "remote", reflectionAnalysis: true, allowNotesRemote: false }));
    // With no server in tests the remote call fails and falls back; we only need to see what would be sent.
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      seen.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 503 });
    }) as typeof fetch;
    try {
      await ai.summarizeReflection({
        emotion: "sad",
        missionTitle: "Near the Light",
        missionCategory: "indoor",
        outcome: "better",
        minutesAway: 3,
        note: "a private thought",
      });
    } finally {
      globalThis.fetch = orig;
    }
    expect(JSON.stringify(seen)).not.toContain("a private thought");
  });
});

describe("prompts", () => {
  it("never include location and keep examples from the safe library", () => {
    const msgs = missionMessages(req, examplesFor(req));
    const all = msgs.map((m) => m.content).join("\n");
    expect(all).not.toMatch(/latitude|longitude|address|city|gps/i);
    expect(all).toMatch(/Helped before: nature \(2\)/);
    expect(msgs.at(-1)!.role).toBe("user");
  });

  it("give a small model no quoted sentence to copy into the reason", () => {
    const fresh = missionMessages({ ...req, helped: {}, signals: [] }, examplesFor(req));
    expect(fresh.at(-1)!.content).toContain("What has helped this person: no history yet.");
    expect(fresh.at(-1)!.content).not.toMatch(/""/);
  });
});
