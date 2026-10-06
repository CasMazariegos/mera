/**
 * FallbackResetProvider: deterministic, offline, always available. Used when AI
 * is off or unavailable, and whenever a model's output fails validation.
 */
import type { MissionRequest } from "@/ai/schemas/mission";
import type { PatternFact, ReflectionFacts } from "@/ai/prompts/prompts";
import { selectMission } from "@/features/missions/select";
import type { MeraAIProvider, PatternResult, TextResult } from "./types";

export function templateReflection(f: ReflectionFacts): string {
  const what =
    f.missionCategory === "nature"
      ? "Time with something natural"
      : f.missionCategory === "movement"
        ? "Moving for a few minutes"
        : f.missionCategory === "indoor"
          ? "A small change of scene"
          : "Noticing your surroundings";
  switch (f.outcome) {
    case "better":
      return `${what} seemed to help this time. I'll keep that in mind for future resets.`;
    case "same":
      return `This one didn't shift much, and that's useful to know too. Next time I'll suggest something a little different.`;
    case "worse":
      return `This reset didn't help this time. I'll lean toward something different next time.`;
    default:
      return `Thanks for taking ${f.minutesAway > 0 ? `${f.minutesAway} minute${f.minutesAway === 1 ? "" : "s"}` : "a moment"} away from the screen.`;
  }
}

export class FallbackResetProvider implements MeraAIProvider {
  readonly id = "fallback" as const;

  async generateResetMission(req: MissionRequest) {
    return selectMission(req, `${req.emotion}:${req.timeOfDay}:${req.recentTitles.join("|")}`);
  }

  async summarizeReflection(facts: ReflectionFacts): Promise<TextResult> {
    return { text: templateReflection(facts), source: this.id };
  }

  async analyzePatterns(facts: PatternFact[]): Promise<PatternResult[]> {
    return facts.map((f) => ({ key: f.key, text: f.sentence, source: this.id }));
  }

  async generateDailyReset(req: MissionRequest) {
    // Different seed from the reset flow, stable for the day.
    return selectMission(req, `daily:${new Date().toDateString()}`);
  }
}
