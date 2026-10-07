/** Everything a mission request needs, gathered from this device in one place. */
import { completedResets, recentNotes } from "@/data/db";
import { buildMissionRequest } from "@/features/patterns/patterns";
import { useSettings } from "@/store/settings";
import type { MissionRequest } from "@/ai/schemas/mission";
import type { Emotion, Preferences } from "@/types";

export async function missionRequestFor(emotion: Emotion, prefs: Preferences, now = new Date()): Promise<MissionRequest> {
  const [history, notes] = await Promise.all([completedResets(50).catch(() => []), recentNotes().catch(() => [])]);
  const since = useSettings.getState().personalizationSince ?? undefined;
  return buildMissionRequest({ emotion, prefs, history, notes, since, now });
}
