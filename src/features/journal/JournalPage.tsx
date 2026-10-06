/** Journal: private notes, voice reflections and photos — on this device only. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Page, Toggle } from "@/components/ui";
import { db, deleteJournalEntry, exportAll, newId } from "@/data/db";
import { useSettings } from "@/store/settings";
import { download } from "@/lib/download";
import { EMOTIONS, EMOTION_LABEL, OUTCOME_LABEL, type Emotion, type JournalEntry } from "@/types";

function BlobMedia({ blob, kind, alt }: { blob: Blob; kind: "audio" | "image"; alt?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return kind === "audio" ? (
    <audio controls src={url} className="mt-3 w-full" />
  ) : (
    <img src={url} alt={alt ?? "Your photo"} className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
  );
}

export function JournalPage() {
  const settings = useSettings();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<Emotion | "">("");
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(() => db.journal.orderBy("createdAt").reverse().toArray().then(setEntries), []);
  useEffect(() => {
    db.journal.orderBy("createdAt").reverse().toArray().then(setEntries);
  }, []);

  const shown = (entries ?? []).filter(
    (e) => !q.trim() || `${e.text ?? ""} ${e.missionTitle ?? ""} ${e.mood ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  async function add() {
    if (!draft.trim()) return;
    await db.journal.put({ id: newId(), createdAt: Date.now(), kind: "text", text: draft.trim(), mood: mood || undefined });
    setDraft("");
    setMood("");
    setWriting(false);
    await load();
  }

  return (
    <Page eyebrow="Journal" title="This space is yours." intro="No pressure to write anything. Everything here stays on this device.">
      {writing ? (
        <div className="rounded-[var(--radius-soft)] border border-line bg-surface p-5">
          <label htmlFor="journal-new" className="sr-only">
            New note
          </label>
          <textarea
            id="journal-new"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            placeholder="What did you notice?"
            className="w-full resize-none rounded-2xl border border-line-strong bg-elevated p-3 text-body text-ink placeholder:text-muted"
          />
          <label htmlFor="journal-mood" className="mt-3 block text-small text-ink-2">
            Mood (optional)
          </label>
          <select
            id="journal-mood"
            value={mood}
            onChange={(e) => setMood(e.target.value as Emotion | "")}
            className="mt-1 min-h-12 w-full rounded-2xl border border-line-strong bg-elevated px-3 text-body text-ink"
          >
            <option value="">—</option>
            {EMOTIONS.map((e) => (
              <option key={e} value={e}>
                {EMOTION_LABEL[e]}
              </option>
            ))}
          </select>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => void add()} disabled={!draft.trim()}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setWriting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="quiet" onClick={() => setWriting(true)}>
          Write a note
        </Button>
      )}

      {entries && entries.length > 0 && (
        <div className="mt-8">
          <label htmlFor="journal-search" className="sr-only">
            Search your journal
          </label>
          <input
            id="journal-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="min-h-12 w-full rounded-full border border-line bg-surface px-5 text-body text-ink placeholder:text-muted"
          />
        </div>
      )}

      <div className="mt-6">
        {entries && entries.length === 0 && !writing && <EmptyState title="Nothing here yet." body="Reflections you leave after a reset will appear here." />}
        <ul className="space-y-4">
          {shown.map((e) => (
            <li key={e.id} className="rounded-[var(--radius-soft)] border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-micro text-ink-2">
                  {new Date(e.createdAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {e.mood ? ` · ${EMOTION_LABEL[e.mood]}` : ""}
                  {e.outcome ? ` → ${OUTCOME_LABEL[e.outcome]}` : ""}
                  {e.demo ? " · sample" : ""}
                </p>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-full px-2 text-small text-ink-2 underline underline-offset-4 hover:text-ink"
                  onClick={() => void deleteJournalEntry(e.id).then(load)}
                  aria-label={`Delete note from ${new Date(e.createdAt).toLocaleDateString()}`}
                >
                  Delete
                </button>
              </div>
              {e.missionTitle && <p className="mt-1 text-small font-medium text-ink">{e.missionTitle}</p>}
              {e.text && <p className="mt-2 text-body whitespace-pre-wrap text-ink">{e.text}</p>}
              {e.audio && (
                <>
                  <BlobMedia blob={e.audio} kind="audio" />
                  <p className="mt-1 text-micro text-muted">Voice note · stays on this device · not transcribed</p>
                </>
              )}
              {e.photo && <BlobMedia blob={e.photo} kind="image" alt={e.missionTitle ? `Photo from “${e.missionTitle}”` : "Your photo"} />}
            </li>
          ))}
        </ul>
      </div>

      <section className="mt-12 border-t border-line pt-6" aria-labelledby="journal-privacy">
        <h2 id="journal-privacy" className="text-h3 font-semibold text-ink">
          Your notes, your control
        </h2>
        <Toggle
          id="ai-analysis"
          label="Let Gemma read my notes"
          hint="Used only for the short reflection after a reset. On this device it never leaves; Connected AI needs a separate permission in Privacy & AI."
          checked={settings.aiReflectionAnalysis}
          onChange={(v) => settings.set({ aiReflectionAnalysis: v })}
        />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="quiet" onClick={() => void exportAll().then((b) => download(b, `mera-export-${new Date().toISOString().slice(0, 10)}.json`))}>
            Export
          </Button>
          {confirmAll ? (
            <>
              <Button
                variant="quiet"
                className="border-warning text-warning"
                onClick={async () => {
                  await db.journal.clear();
                  setConfirmAll(false);
                  await load();
                }}
              >
                Yes, delete all notes
              </Button>
              <Button variant="ghost" onClick={() => setConfirmAll(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmAll(true)} disabled={!entries?.length}>
              Delete all notes
            </Button>
          )}
        </div>
      </section>
    </Page>
  );
}
