/**
 * Deterministic mission selection from the library: safe for the person's
 * settings and the time of day, suited to how they feel, nudged by what has
 * helped before, and not repeating what they just did. Same inputs → same
 * mission (seeded), so it's testable and predictable.
 */
import type { GeneratedMission, MissionCategory } from "@/types";
import type { MissionRequest } from "@/ai/schemas/mission";
import { unsafeMissionReason } from "@/ai/safety/safety";
import { LIBRARY, type LibraryMission } from "./library";

export function eligible(m: LibraryMission, req: MissionRequest): boolean {
  if (req.canGoOutside === "indoor_only" && m.environment === "outdoor") return false;
  if (req.timeOfDay === "night" && !m.nightSafe) return false;
  if (req.lowMobility && (m.needsWalking || m.category === "movement")) return false;
  if (req.avoidSound && m.usesSound) return false;
  if (req.avoidSmell && m.usesSmell) return false;
  if (m.durationMinutes > req.minutes) return false;
  return unsafeMissionReason(m, req) === null;
}

export function score(m: LibraryMission, req: MissionRequest): number {
  let s = 0;
  if (m.emotions.includes(req.emotion)) s += 3;
  if (req.emotion === "not_sure" && m.emotions.length === 0) s += 1;
  const helped = req.helped[m.category] ?? 0;
  const notHelped = req.notHelped[m.category] ?? 0;
  s += Math.min(3, helped) - Math.min(2, notHelped);
  if (req.recentTitles.includes(m.title)) s -= 4;
  if (req.canGoOutside === "ask_each_time" && m.environment === "either") s += 1; // safe either way
  // Touch grass: when going out is possible, the outside world wins.
  if (req.canGoOutside === "yes" && req.timeOfDay !== "night") {
    if (m.environment === "outdoor") s += 2;
    if (m.category === "nature") s += 1;
    if (m.environment === "indoor") s -= 2;
  }
  return s;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rankLibrary(req: MissionRequest, seed = ""): LibraryMission[] {
  return LIBRARY.filter((m) => eligible(m, req)).sort((a, b) => score(b, req) - score(a, req) || hash(seed + a.id) - hash(seed + b.id));
}

/** Always returns a mission: the gentlest indoor one if nothing else fits. */
export function selectMission(req: MissionRequest, seed = ""): GeneratedMission {
  const pick = rankLibrary(req, seed)[0] ?? LIBRARY.find((m) => m.id === "indoor-window-001")!;
  return toMission(pick);
}

export function toMission(m: LibraryMission): GeneratedMission {
  return {
    title: m.title,
    durationMinutes: m.durationMinutes,
    category: m.category,
    environment: m.environment,
    instruction: m.instruction,
    secondaryInstruction: m.secondaryInstruction,
    source: "library",
    libraryId: m.id,
  };
}

/** A few library missions shown to the model as examples of the format and tone. */
export function examplesFor(req: MissionRequest, n = 2): LibraryMission[] {
  return rankLibrary(req, "examples").slice(0, n);
}

export function categoryCounts(): Record<MissionCategory, number> {
  return LIBRARY.reduce<Record<MissionCategory, number>>((acc, m) => ({ ...acc, [m.category]: (acc[m.category] ?? 0) + 1 }), { nature: 0, movement: 0, sensory: 0, indoor: 0 });
}
