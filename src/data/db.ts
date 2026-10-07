/**
 * Local-first storage. Everything MERA remembers lives in this browser's
 * IndexedDB: resets, check-ins, journal entries (text, voice audio, photos).
 * Nothing here is sent anywhere. Export and delete are first-class.
 */
import Dexie, { type Table } from "dexie";
import type { CheckIn, JournalEntry, ResetRecord } from "@/types";

export class MeraDB extends Dexie {
  resets!: Table<ResetRecord, string>;
  journal!: Table<JournalEntry, string>;
  checkins!: Table<CheckIn, string>;

  constructor(name = "mera") {
    super(name);
    this.version(1).stores({
      resets: "id, startedAt, completedAt, emotion, outcome",
      journal: "id, createdAt, resetId, mood",
      checkins: "id, createdAt",
    });
  }
}

export const db = new MeraDB();

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function saveReset(r: ResetRecord) {
  await db.resets.put(r);
}

export async function completedResets(limit = 200): Promise<ResetRecord[]> {
  return (await db.resets.orderBy("startedAt").reverse().limit(limit).toArray()).filter((r) => r.completedAt !== null);
}

export async function deleteJournalEntry(id: string) {
  await db.journal.delete(id);
  // Unlink it from the reset it belonged to.
  await db.resets
    .where("id")
    .above("")
    .modify((r) => {
      if (r.reflectionId === id) delete r.reflectionId;
    });
}

export async function deleteAllData() {
  await db.transaction("rw", db.resets, db.journal, db.checkins, async () => {
    await db.resets.clear();
    await db.journal.clear();
    await db.checkins.clear();
  });
}

/** Reset history only (journal notes stay, unlinked). */
export async function deleteResetHistory() {
  await db.resets.clear();
}

/** Journal only: notes, voice notes and photos. */
export async function deleteJournal() {
  await db.journal.clear();
  await db.resets
    .where("id")
    .above("")
    .modify((r) => {
      delete r.reflectionId;
    });
}

/** Remove only the clearly-labelled sample data added by demo mode. */
export async function deleteDemoData() {
  await db.resets.filter((r) => !!r.demo).delete();
  await db.journal.filter((j) => !!j.demo).delete();
}

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Everything, as one JSON file the person can keep. Audio and photos are embedded as data URLs. */
export async function exportAll(): Promise<Blob> {
  const [resets, journal, checkins] = await Promise.all([db.resets.toArray(), db.journal.toArray(), db.checkins.toArray()]);
  const entries = await Promise.all(
    journal.map(async (j) => ({
      ...j,
      audio: j.audio ? await blobToDataUrl(j.audio) : undefined,
      photo: j.photo ? await blobToDataUrl(j.photo) : undefined,
    })),
  );
  const payload = { app: "MERA", version: 1, exportedAt: new Date().toISOString(), resets, journal: entries, checkins };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

/** Recent typed notes, newest first, for on-device theme matching ("fresh air", "walking"…). */
export async function recentNotes(limit = 10): Promise<Array<{ text: string; at: number }>> {
  const rows = await db.journal.orderBy("createdAt").reverse().limit(40).toArray();
  return rows
    .filter((e) => e.text && e.text.trim())
    .slice(0, limit)
    .map((e) => ({ text: e.text!, at: e.createdAt }));
}
