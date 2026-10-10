/**
 * Safety rules for anything MERA shows from a model. Deterministic, in code —
 * prompts ask nicely, these enforce.
 *
 * Missions: no traffic, trespassing, strangers, unfamiliar places, night-time
 * wandering, bare feet in unsafe places, strenuous or risky activity, medical
 * behaviour, or screens. Indoor-only people never get an outdoor mission, and
 * night-time missions stay indoors or at the door.
 *
 * Text: no diagnosis, treatment, therapy or crisis-counselling claims, no
 * dependency language, no shame, no hype.
 */
import type { Mission, MissionCategory } from "@/types";
import type { MissionRequest } from "@/ai/schemas/mission";

const UNSAFE_MISSION = [
  /\b(traffic|highway|freeway|road(side)?|cross(ing)? the street|intersection|railway|train tracks?)\b/i,
  /\b(trespass|fence|private property|climb|rooftop|ledge|cliff|edge of)\b/i,
  /\b(stranger|talk to (someone|a person|people)|ask (someone|a stranger)|approach (someone|people))\b/i,
  /\b(unfamiliar|new place|explore (a|an|the) (area|neighbou?rhood|woods|forest)|get lost|wander)\b/i,
  /\b(at night|in the dark|after dark|midnight|alone at)\b/i,
  /\b(barefoot|bare feet|take off your shoes|remove your shoes)\b/i,
  // "Run your fingertips over the bark" or "run cool water over your hands" is touch, not running.
  // A few words may sit between ("run a small stream of cool water"), but not a direction ("run to the water").
  /\brun\b(?!(?:\s+(?!(?:along|to|toward|towards|around|through|down|up|across|by|past|into|on)\b)[\w-]+){0,5}\s+(?:water|tap|finger\w*|hands?|palms?|wrists?)\b)/i,
  /\b(sprint|jog|hike|climb|push-?ups?|burpees?|hiit|workout|lift(ing)? (weights?|something heavy|heavy)|weightlifting|swim|cold (plunge|shower)|ice bath)\b/i,
  /\b(knife|fire|lighter|candle|match(es)?|tool|ladder|drive|car|bike|cycle|scooter)\b/i,
  /\b(medication|medicine|pill|dose|supplement|alcohol|drink(ing)? (wine|beer)|caffeine)\b/i,
  // Screen use (leaving the phone behind is encouraged; using it isn't).
  /\b((use|check|open|look at|pick up|grab) (your |the )?(phone|screen|app)|scroll\w*|social media|text (someone|a friend)|call (someone|a friend)|youtube|music app|podcast|headphones? (in|on))\b/i,
  /\b(journal(ing)?|write (down|about)|list (five|5|ten|10))\b/i,
];

const CLINICAL = [
  /\b(diagnos\w*|disorder|symptom\w*|treat(ment|s|ing)?|therap(y|ist|eutic)|clinical|patholog\w*|cure)\b/i,
  /\b(you have (anxiety|depression|ptsd|adhd|ocd|panic)|your (anxiety|depression|trauma|panic attacks?) (is|are)|triggered by)\b/i,
  /\b(panic attack|depression|depressed|ptsd|bipolar|adhd|ocd)\b/i,
  /\b(crisis|suicid\w*|self[- ]harm|emergency)\b/i,
  /\b(you need me|only i|always here for you|don't leave|come back soon|you must|you should feel)\b/i,
  /\b(you failed|you're failing|lazy|weak|should be ashamed|why didn't you)\b/i,
  /!{2,}|\b(you('ve)? got this|everything will be (okay|ok|fine)|your feelings are valid|let'?s unpack|how can i (help|assist) you)\b/i,
];

export function unsafeMissionReason(
  m: Mission,
  req?: Pick<MissionRequest, "canGoOutside" | "timeOfDay" | "lowMobility" | "avoidSound" | "avoidSmell">,
): string | null {
  const text = `${m.title} ${m.instruction} ${m.secondaryInstruction ?? ""}`;
  for (const re of UNSAFE_MISSION) if (re.test(text)) return `unsafe_phrase:${re.source.slice(0, 24)}`;
  for (const re of CLINICAL) if (re.test(text)) return "clinical_language";
  // More than two sentences per field isn't "one simple instruction".
  if ((m.instruction.match(/[.!?](\s|$)/g) ?? []).length > 2) return "too_long";
  if (
    req?.canGoOutside === "indoor_only" &&
    (m.environment === "outdoor" || /\b(outside|outdoors|step out|go out|walk around the block|yard|garden|park)\b/i.test(text))
  )
    return "outdoor_for_indoor_only";
  if (
    req?.timeOfDay === "night" &&
    m.environment === "outdoor" &&
    !/\b(doorway|porch|balcony|window|step outside your door|just outside your door)\b/i.test(text)
  )
    return "outdoor_at_night";
  if (req?.lowMobility && (m.category === "movement" || /\b(walk|stretch|stand up|stairs)\b/i.test(text))) return "movement_for_low_mobility";
  if (req?.avoidSound && /\b(listen|sounds?|hear)\b/i.test(text)) return "sound_avoided";
  if (req?.avoidSmell && /\b(smell|scent|sniff)\b/i.test(text)) return "smell_avoided";
  return null;
}

export function clinicalLanguage(text: string): boolean {
  return CLINICAL.some((re) => re.test(text));
}

/** Short, plain, non-clinical, no hype. Used for reflection summaries and pattern sentences. */
export function unsafeTextReason(text: string, maxSentences = 3): string | null {
  if (clinicalLanguage(text)) return "clinical_language";
  if (/[<>{}[\]`]|https?:/i.test(text)) return "markup";
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > maxSentences) return "too_long";
  return null;
}

/** Numbers in a model-phrased pattern must be numbers we actually computed. */
export function numbersAreGrounded(text: string, facts: number[]): boolean {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const found = [...text.toLowerCase().matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/g)].map((m) =>
    m[1]! in words ? words[m[1]!]! : Number(m[1]),
  );
  return found.every((n) => facts.includes(n));
}

export function categoryAllowed(c: MissionCategory, req: Pick<MissionRequest, "lowMobility">): boolean {
  return !(req.lowMobility && c === "movement");
}
