/**
 * Demo mode sample history — clearly labelled "sample" everywhere it appears and
 * removable in one tap. It exists so judges can see My Patterns without using
 * MERA for a week; it never mixes silently with real data.
 */
import { LIBRARY } from "@/features/missions/library";
import { toMission } from "@/features/missions/select";
import type { Emotion, Outcome, ResetRecord } from "@/types";
import { db, newId } from "./db";

const SAMPLE: Array<[string, Emotion, Outcome, number, number]> = [
  // libraryId, feeling, outcome, days ago, hour
  ["move-slow-walk-001", "overwhelmed", "better", 6, 18],
  ["sense-movement-001", "scattered", "better", 5, 19],
  ["indoor-light-002", "drained", "same", 4, 21],
  ["nature-greens-001", "overwhelmed", "better", 3, 18],
  ["sense-near-far-002", "anxious", "same", 2, 20],
  ["move-block-002", "angry", "better", 1, 17],
];

export async function addSampleHistory(): Promise<number> {
  const now = Date.now();
  const rows: ResetRecord[] = SAMPLE.map(([id, emotion, outcome, daysAgo, hour]) => {
    const d = new Date(now - daysAgo * 86_400_000);
    d.setHours(hour, 10, 0, 0);
    const m = toMission(LIBRARY.find((x) => x.id === id)!);
    return {
      id: newId(),
      startedAt: d.getTime(),
      emotion,
      mission: m,
      phoneDownSeconds: m.durationMinutes * 60,
      outcome,
      quiet: false,
      hour,
      completedAt: d.getTime() + m.durationMinutes * 60_000 + 60_000,
      demo: true,
    };
  });
  await db.resets.bulkPut(rows);
  return rows.length;
}
