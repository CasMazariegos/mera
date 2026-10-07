/**
 * Demo mode sample history — clearly labelled "sample" everywhere it appears and
 * removable in one tap. It exists so judges can see personalization and My
 * Patterns without using MERA for a week; it never mixes silently with real data.
 */
import { LIBRARY } from "@/features/missions/library";
import { toMission } from "@/features/missions/select";
import type { Emotion, JournalEntry, Outcome, ResetRecord } from "@/types";
import { db, newId } from "./db";

const SAMPLE: Array<[string, Emotion, Outcome, number, number, string?]> = [
  // libraryId, feeling, outcome, days ago, hour, the person's own note
  ["move-slow-walk-001", "overwhelmed", "better", 6, 18, "Walking and the cool air helped."],
  ["sense-movement-001", "scattered", "better", 5, 19, "Listening to the birds and the wind made it easier to slow down."],
  ["indoor-light-002", "drained", "same", 4, 21],
  ["nature-greens-001", "overwhelmed", "better", 3, 18],
  ["sense-near-far-002", "anxious", "same", 2, 20],
  ["move-block-002", "angry", "better", 1, 17],
];

export async function addSampleHistory(): Promise<number> {
  // Idempotent: replace any earlier sample rows.
  await db.resets.filter((r) => !!r.demo).delete();
  await db.journal.filter((j) => !!j.demo).delete();
  const now = Date.now();
  const resets: ResetRecord[] = [];
  const notes: JournalEntry[] = [];
  for (const [id, emotion, outcome, daysAgo, hour, note] of SAMPLE) {
    const d = new Date(now - daysAgo * 86_400_000);
    d.setHours(hour, 10, 0, 0);
    const m = toMission(LIBRARY.find((x) => x.id === id)!);
    const resetId = newId();
    const away = m.durationMinutes * 60 + 40;
    const reflectionId = note ? newId() : undefined;
    resets.push({
      id: resetId,
      startedAt: d.getTime(),
      emotion,
      mission: m,
      phoneDownSeconds: away,
      plannedSeconds: m.durationMinutes * 60,
      timerCompleted: true,
      path: daysAgo % 2 ? "quick" : "full",
      outcome,
      quiet: false,
      hour,
      completedAt: d.getTime() + away * 1000 + 60_000,
      reflectionId,
      demo: true,
    });
    if (note && reflectionId)
      notes.push({
        id: reflectionId,
        createdAt: d.getTime() + away * 1000 + 30_000,
        kind: "text",
        text: note,
        mood: emotion,
        outcome,
        resetId,
        missionTitle: m.title,
        demo: true,
      });
  }
  await db.resets.bulkPut(resets);
  await db.journal.bulkPut(notes);
  return resets.length;
}
