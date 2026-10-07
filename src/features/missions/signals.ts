/**
 * Personalization signals: what MERA has learned from this person's own resets,
 * as small structured facts with stable ids.
 *
 *   cat_helped:movement:2:3      Movement resets helped in 2 of the last 3 tries.
 *   cat_not_helped:indoor:2      Indoor resets didn't help the last 2 times.
 *   act_helped:walking:2         Walking was part of 2 resets that helped.
 *   feeling_helped:overwhelmed:movement
 *                                Last time you felt overwhelmed, a movement reset helped.
 *   note_theme:fresh_air         Your own notes mentioned fresh or cool air.
 *
 * Only ids travel (to a model, or to MERA's server for Connected AI). The words
 * are rebuilt from the id on each side, so no free text is ever sent, and a
 * model can only cite signals that were actually given to it.
 */
import { CATEGORIES, EMOTIONS, EMOTION_LABEL, type Emotion, type Mission, type MissionCategory, type ResetRecord } from "@/types";

export const ACTIVITIES = ["walking", "sound", "sky", "plants", "touch", "fresh_air", "water", "light", "stretch", "breath"] as const;
export type Activity = (typeof ACTIVITIES)[number];

const ACTIVITY_WORD: Record<Activity, string> = {
  walking: "Walking",
  sound: "Listening for sounds",
  sky: "Looking at the sky",
  plants: "Time with plants or trees",
  touch: "Touch and texture",
  fresh_air: "Fresh or cool air",
  water: "Water",
  light: "Light and windows",
  stretch: "Gentle stretching",
  breath: "Slow breathing",
};

const ACTIVITY_RE: Record<Activity, RegExp> = {
  // Specific words only: "step outside" is not walking, and "outside" alone is not fresh air.
  walking: /\b(walk\w*|stroll\w*|pace slowly|around the block)\b/i,
  sound: /\b(sounds?|listen\w*|hear\w*|noise|birds?)\b/i,
  sky: /\b(sky|clouds?|horizon|sunset|sunrise|stars?)\b/i,
  plants: /\b(green\w*|leaf|leaves|trees?|plants?|grass|garden|flowers?|nature|park)\b/i,
  touch: /\b(touch\w*|textures?|bark|stone|cold water|fabric)\b/i,
  fresh_air: /\b(fresh|cool|cold|crisp) air\b|\b(breeze|wind)\b/i,
  water: /\b(water|rain|wash\w*|splash\w*|shower)\b/i,
  light: /\b(light|sun\w*|window|daylight|lamp)\b/i,
  stretch: /\b(stretch\w*|shoulders?|roll your|reach)\b/i,
  breath: /\b(breath\w*|exhale|inhale)\b/i,
};

/** Activities a mission involves, from its own words. Deterministic and testable. */
export function missionActivities(m: Pick<Mission, "title" | "instruction" | "secondaryInstruction">): Activity[] {
  const text = `${m.title} ${m.instruction} ${m.secondaryInstruction ?? ""}`;
  return ACTIVITIES.filter((a) => ACTIVITY_RE[a].test(text));
}

/** Themes in a person's own note, matched on this device. Only the theme ids are ever used. */
export function noteThemes(text: string): Activity[] {
  return ACTIVITIES.filter((a) => ACTIVITY_RE[a].test(text));
}

const CATEGORY_WORD: Record<MissionCategory, string> = { nature: "Nature", movement: "Movement", sensory: "Senses-based", indoor: "Indoor" };
const CATEGORY_ADJ: Record<MissionCategory, string> = { nature: "a nature", movement: "a movement", sensory: "a senses-based", indoor: "an indoor" };

const isCat = (s: string): s is MissionCategory => (CATEGORIES as readonly string[]).includes(s);
const isAct = (s: string): s is Activity => (ACTIVITIES as readonly string[]).includes(s);
const isEmotion = (s: string): s is Emotion => (EMOTIONS as readonly string[]).includes(s);
const isCount = (s: string | undefined) => !!s && /^\d{1,3}$/.test(s);

/** Plain-words version of a signal id, or null if the id isn't valid. Used by the app AND the server. */
export function signalText(id: string): string | null {
  const [kind, a, b, c, ...rest] = id.split(":");
  if (rest.length) return null;
  switch (kind) {
    case "cat_helped":
      return a && isCat(a) && isCount(b) && isCount(c) ? `${CATEGORY_WORD[a]} resets helped in ${b} of the last ${c} tries.` : null;
    case "cat_not_helped":
      return a && isCat(a) && isCount(b) && c === undefined ? `${CATEGORY_WORD[a]} resets didn't help the last ${b} times.` : null;
    case "act_helped":
      return a && isAct(a) && isCount(b) && c === undefined ? `${ACTIVITY_WORD[a]} was part of ${b} resets that helped.` : null;
    case "feeling_helped":
      return a && isEmotion(a) && b && isCat(b) && c === undefined
        ? `Last time you felt ${EMOTION_LABEL[a].toLowerCase()}, ${CATEGORY_ADJ[b]} reset helped.`
        : null;
    case "note_theme":
      return a && isAct(a) && b === undefined ? `Your own notes mentioned ${ACTIVITY_WORD[a].toLowerCase()}.` : null;
    default:
      return null;
  }
}

/** Every number a signal's sentence contains (for grounding checks on model text). */
export function signalNumbers(id: string): number[] {
  return id
    .split(":")
    .filter((p) => /^\d+$/.test(p))
    .map(Number);
}

export interface SignalInput {
  history: ResetRecord[];
  emotion: Emotion;
  /** Text of the person's own notes, newest first. Read locally; only theme ids come out. */
  notes?: string[];
}

/**
 * The few strongest, honest signals from recent resets (newest first). Needs
 * real outcomes: nothing is inferred from a single "better" except the
 * same-feeling memory, which is labelled as "last time".
 */
export function personalSignals({ history, emotion, notes = [] }: SignalInput): string[] {
  const done = history.filter((r) => r.mission && r.outcome && r.outcome !== "other").slice(0, 12);
  const out: string[] = [];

  // Same feeling, and it helped: the most direct memory.
  const sameFeeling = done.find((r) => r.emotion === emotion && emotion !== "not_sure" && r.outcome === "better");
  if (sameFeeling) out.push(`feeling_helped:${emotion}:${sameFeeling.mission!.category}`);

  // Categories with a good track record (≥2 tries, ≥ half better), best first.
  const cats = CATEGORIES.map((c) => {
    const tries = done.filter((r) => r.mission!.category === c);
    return { c, tries: tries.length, better: tries.filter((r) => r.outcome === "better").length, worse: tries.filter((r) => r.outcome === "worse").length };
  });
  for (const x of cats.filter((x) => x.tries >= 2 && x.better * 2 >= x.tries).sort((p, q) => q.better / q.tries - p.better / p.tries || q.better - p.better))
    out.push(`cat_helped:${x.c}:${x.better}:${x.tries}`);

  // Activities that were part of resets that helped (≥2).
  const act = new Map<Activity, number>();
  for (const r of done.filter((r) => r.outcome === "better")) for (const a of missionActivities(r.mission!)) act.set(a, (act.get(a) ?? 0) + 1);
  for (const [a, n] of [...act.entries()]
    .filter(([, n]) => n >= 2)
    .sort((p, q) => q[1] - p[1])
    .slice(0, 2))
    out.push(`act_helped:${a}:${n}`);

  // Categories that didn't help, twice in a row most recently.
  for (const c of CATEGORIES) {
    const recent = done.filter((r) => r.mission!.category === c).slice(0, 2);
    if (recent.length === 2 && recent.every((r) => r.outcome === "worse" || r.outcome === "same")) out.push(`cat_not_helped:${c}:2`);
  }

  // Themes from the person's own notes (only if notes were provided, which the caller controls).
  const themes = new Map<Activity, number>();
  for (const n of notes.slice(0, 10)) for (const t of noteThemes(n)) themes.set(t, (themes.get(t) ?? 0) + 1);
  for (const [t] of [...themes.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2)) out.push(`note_theme:${t}`);

  return out.filter((id) => signalText(id) !== null).slice(0, 6);
}

/** How much each signal favours a mission (used by the offline library, so personalization works without AI too). */
export function signalBoost(m: Mission, signals: string[]): { boost: number; matched: string[] } {
  const acts = missionActivities(m);
  let boost = 0;
  const matched: string[] = [];
  for (const id of signals) {
    const [kind, a, b] = id.split(":");
    let add = 0;
    if (kind === "feeling_helped" && b === m.category) add = 3;
    else if (kind === "cat_helped" && a === m.category) add = 2;
    else if (kind === "act_helped" && acts.includes(a as Activity)) add = 1.5;
    else if (kind === "note_theme" && acts.includes(a as Activity)) add = 1;
    else if (kind === "cat_not_helped" && a === m.category) boost -= 3;
    if (add) {
      boost += add;
      matched.push(id);
    }
  }
  return { boost, matched };
}

/** One calm sentence for "Why this reset?" built from the signals a mission matched. */
export function reasonFromSignals(ids: string[]): string | undefined {
  const texts = ids.map(signalText).filter((t): t is string => !!t);
  if (!texts.length) return undefined;
  return texts[0];
}
