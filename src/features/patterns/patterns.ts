/**
 * Patterns from local reset history. All counting is deterministic code; Gemma
 * may only rephrase a fact, and any number it uses must be one computed here.
 * Framed as observations ("seems", "has helped"), never conclusions.
 */
import { missionActivities, personalSignals, type Activity } from "@/features/missions/signals";

const ACTIVITY_PHRASE: Record<Activity, string> = {
  walking: "Walking",
  sound: "Listening for sounds",
  sky: "Looking at the sky",
  plants: "Time near plants or trees",
  touch: "Touch and texture",
  fresh_air: "Fresh air",
  water: "Water",
  light: "Light",
  stretch: "Gentle stretching",
  breath: "Slow breathing",
};
import type { PatternFact } from "@/ai/prompts/prompts";
import type { MissionRequest } from "@/ai/schemas/mission";
import { CATEGORIES, EMOTION_LABEL, type MissionCategory, type Preferences, type ResetRecord } from "@/types";

export const MIN_RESETS_FOR_PATTERNS = 3;

const CATEGORY_WORD: Record<MissionCategory, string> = {
  nature: "Nature resets",
  movement: "Movement resets",
  sensory: "Sensory resets",
  indoor: "Indoor resets",
};

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function withOutcome(rs: ResetRecord[]) {
  return rs.filter((r) => r.completedAt && r.outcome && r.outcome !== "other" && r.mission);
}

/** Per-category counts of better vs not-better, from the most recent resets. */
export function categoryOutcomes(history: ResetRecord[], last = 20) {
  const helped: Record<MissionCategory, number> = { nature: 0, movement: 0, sensory: 0, indoor: 0 };
  const notHelped: Record<MissionCategory, number> = { nature: 0, movement: 0, sensory: 0, indoor: 0 };
  for (const r of withOutcome(history).slice(0, last)) {
    const c = r.mission!.category;
    if (r.outcome === "better") helped[c]++;
    else notHelped[c]++;
  }
  return { helped, notHelped };
}

export function buildMissionRequest(input: {
  emotion: MissionRequest["emotion"];
  prefs: Preferences;
  history: ResetRecord[];
  now: Date;
  /** The person's own notes (newest first). Only matched locally into theme ids. */
  notes?: Array<{ text: string; at: number }>;
  /** "Reset personalization": ignore history from before this time. */
  since?: number;
}): MissionRequest {
  const history = input.since ? input.history.filter((r) => r.startedAt >= input.since!) : input.history;
  const { helped, notHelped } = categoryOutcomes(history);
  return {
    emotion: input.emotion,
    canGoOutside: input.prefs.canGoOutside,
    minutes: Math.max(2, Math.min(10, input.prefs.usualMinutes)),
    lowMobility: input.prefs.lowMobility,
    avoidSound: input.prefs.avoidSound,
    avoidSmell: input.prefs.avoidSmell,
    timeOfDay: timeOfDay(input.now.getHours()),
    helped,
    notHelped,
    recentTitles: history
      .map((r) => r.mission?.title)
      .filter((t): t is string => !!t)
      .slice(0, 3),
    signals: compatibleSignals(
      personalSignals({
        history,
        emotion: input.emotion,
        notes: (input.notes ?? []).filter((n) => !input.since || n.at >= input.since).map((n) => n.text),
      }),
      input.prefs,
    ),
  };
}

/** Settings win over history: never nudge toward something the person has ruled out (e.g. walking with low mobility). */
export function compatibleSignals(ids: string[], prefs: Preferences): string[] {
  return ids.filter((id) => {
    const [kind, a, b] = id.split(":");
    const cat = kind === "feeling_helped" ? b : kind === "cat_helped" || kind === "cat_not_helped" ? a : null;
    const act = kind === "act_helped" || kind === "note_theme" ? a : null;
    if (prefs.lowMobility && (cat === "movement" || act === "walking" || act === "stretch")) return false;
    if (prefs.avoidSound && act === "sound") return false;
    return true;
  });
}

/** Observations worth showing. Empty until there's enough history to say anything honest. */
export function detectPatterns(history: ResetRecord[]): PatternFact[] {
  const done = withOutcome(history);
  if (done.length < MIN_RESETS_FOR_PATTERNS) return [];
  const facts: PatternFact[] = [];

  // 1. Which kind of reset has helped most (needs at least 2 tries of it).
  const recent = done.slice(0, 10);
  let best: { c: MissionCategory; better: number; total: number } | null = null;
  for (const c of CATEGORIES) {
    const tries = recent.filter((r) => r.mission!.category === c);
    const better = tries.filter((r) => r.outcome === "better").length;
    if (tries.length >= 2 && better > 0 && (!best || better / tries.length > best.better / best.total)) best = { c, better, total: tries.length };
  }
  if (best) {
    facts.push({
      key: `best-${best.c}`,
      sentence: `${CATEGORY_WORD[best.c]} have helped in ${best.better} of your last ${best.total} tries.`,
      numbers: [best.better, best.total],
    });
  }

  // 1b. An activity (walking, listening…) that keeps showing up in resets that helped.
  const acts = new Map<Activity, { better: number; total: number }>();
  for (const r of recent)
    for (const a of missionActivities(r.mission!)) {
      const x = acts.get(a) ?? { better: 0, total: 0 };
      x.total++;
      if (r.outcome === "better") x.better++;
      acts.set(a, x);
    }
  const topAct = [...acts.entries()].filter(([, x]) => x.total >= 2 && x.better * 2 > x.total).sort((p, q) => q[1].better - p[1].better)[0];
  if (topAct) {
    const [a, x] = topAct;
    facts.push({
      key: `best-act-${a}`,
      sentence: `${ACTIVITY_PHRASE[a]} helped in ${x.better} of the ${x.total} recent resets that included it.`,
      numbers: [x.better, x.total],
    });
  }

  // 2. Outdoor vs indoor.
  const outdoor = recent.filter((r) => r.mission!.environment === "outdoor");
  const indoor = recent.filter((r) => r.mission!.environment !== "outdoor");
  const rate = (rs: ResetRecord[]) => (rs.length ? rs.filter((r) => r.outcome === "better").length / rs.length : 0);
  if (outdoor.length >= 2 && indoor.length >= 2 && Math.abs(rate(outdoor) - rate(indoor)) >= 0.25) {
    const outdoorBetter = rate(outdoor) > rate(indoor);
    facts.push({
      key: "outdoor-vs-indoor",
      sentence: outdoorBetter
        ? "Going outside seems to have helped more than staying in during your recent resets."
        : "Indoor resets seem to have worked as well as or better than going outside lately.",
      numbers: [],
    });
  }

  // 3. When MERA gets reached for.
  const byTime: Record<TimeOfDay, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const r of history) byTime[timeOfDay(r.hour)]++;
  const [topTime, topCount] = (Object.entries(byTime) as [TimeOfDay, number][]).sort((a, b) => b[1] - a[1])[0]!;
  if (history.length >= 4 && topCount / history.length >= 0.5) {
    facts.push({
      key: `time-${topTime}`,
      sentence: `You tend to reach for MERA most often in the ${topTime === "night" ? "late hours" : topTime}.`,
      numbers: [],
    });
  }

  // 4. Most common starting feeling.
  const byEmotion = new Map<string, number>();
  for (const r of done) if (r.emotion && r.emotion !== "not_sure") byEmotion.set(r.emotion, (byEmotion.get(r.emotion) ?? 0) + 1);
  const topEmotion = [...byEmotion.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEmotion && topEmotion[1] >= 3) {
    facts.push({
      key: `feeling-${topEmotion[0]}`,
      sentence: `"${EMOTION_LABEL[topEmotion[0] as keyof typeof EMOTION_LABEL]}" is the feeling you've started from most often (${topEmotion[1]} resets).`,
      numbers: [topEmotion[1]],
    });
  }

  return facts;
}

/** Gentle weekly summary, no streaks: "You made time for yourself three times this week." */
export function thisWeek(history: ResetRecord[], now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  return history.filter((r) => r.completedAt && r.completedAt >= start.getTime()).length;
}

/** Minutes back in the world since Monday: the quiet number MERA cares about. */
export function minutesThisWeek(history: ResetRecord[], now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const secs = history.filter((r) => r.completedAt && r.completedAt >= start.getTime()).reduce((n, r) => n + (r.phoneDownSeconds || 0), 0);
  return Math.round(secs / 60);
}

/** "one", "two", … for small numbers (copy reads better). */
export function countWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}
