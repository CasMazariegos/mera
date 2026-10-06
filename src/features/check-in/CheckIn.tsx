/** A lightweight check-in: one tap, an optional "how heavy", and an optional 2-minute reset. */
import { useState } from "react";
import { Button, Page } from "@/components/ui";
import { db, completedResets, newId } from "@/data/db";
import { meraAI } from "@/ai";
import { useSettings } from "@/store/settings";
import { useFlow } from "@/store/flow";
import { navigate } from "@/app/router";
import { buildMissionRequest } from "@/features/patterns/patterns";
import { EMOTIONS, EMOTION_LABEL, type Emotion } from "@/types";

const LEVELS = ["Very heavy", "Heavy", "In between", "Light", "Very light"];

export function CheckIn() {
  const prefs = useSettings();
  const send = useFlow((s) => s.send);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [level, setLevel] = useState(3);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!emotion) return;
    await db.checkins.put({ id: newId(), createdAt: Date.now(), emotion, level });
    setSaved(true);
  }

  async function quickReset() {
    if (!emotion) return;
    setBusy(true);
    const history = await completedResets(50);
    const req = buildMissionRequest({ emotion, prefs: { ...prefs, usualMinutes: 2, canGoOutside: prefs.canGoOutside === "ask_each_time" ? "indoor_only" : prefs.canGoOutside }, history, now: new Date() });
    const mission = await meraAI.generateResetMission(req);
    setBusy(false);
    send({ type: "START_MISSION", resetId: newId(), now: Date.now(), mission, emotion });
  }

  if (saved) {
    return (
      <Page eyebrow="Check in" title="Noted." intro="Thanks for checking in with yourself.">
        <div className="flex flex-col gap-3">
          <Button onClick={() => void quickReset()} disabled={busy} data-testid="quick-reset">
            {busy ? "Finding one…" : "Want a 2-minute reset?"}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            Not now
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page eyebrow="Check in" title="How are you feeling?">
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Feelings">
        {EMOTIONS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={emotion === e}
            onClick={() => setEmotion(e)}
            className={`min-h-14 rounded-[var(--radius-soft)] border px-4 text-body font-medium transition-colors ${emotion === e ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink hover:border-line-strong"}`}
          >
            {emotion === e && <span aria-hidden>✓ </span>}
            {EMOTION_LABEL[e]}
          </button>
        ))}
      </div>
      <div className="mt-8">
        <label htmlFor="level" className="text-body font-medium text-ink">
          How heavy does it feel?
        </label>
        <input id="level" type="range" min={1} max={5} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-valuetext={LEVELS[level - 1]} className="mt-4 w-full accent-[var(--accent)]" />
        <p className="mt-1 text-small text-ink-2" aria-hidden>
          {LEVELS[level - 1]}
        </p>
      </div>
      <Button className="mt-8 w-full" disabled={!emotion} onClick={() => void save()}>
        Save check-in
      </Button>
      <p className="mt-3 text-center text-micro text-muted">Saved only on this device.</p>
    </Page>
  );
}
