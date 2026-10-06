/** Scenes 9–12: welcome back, optional reflection, a short honest insight, release. */
import { useEffect, useRef, useState } from "react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Button, Eyebrow } from "@/components/ui";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import { meraAI } from "@/ai";
import { completedResets, db, newId, saveReset } from "@/data/db";
import { detectPatterns } from "@/features/patterns/patterns";
import { takeBeforePhoto } from "@/store/photos";
import { VoiceRecorder } from "@/features/reflections/VoiceRecorder";
import { EMOTION_LABEL, OUTCOME_LABEL, type JournalEntry, type Outcome } from "@/types";
import { Scene } from "../Scene";

export function ReturnScene() {
  const send = useFlow((s) => s.send);
  const pick = (outcome: Outcome) => send({ type: "PICK_OUTCOME", outcome });
  return (
    <Scene
      title="Welcome back."
      top={<MeraCharacter state="returning" size={120} className="mt-2" />}
      footer={
        <>
          <Button variant="choice" onClick={() => pick("better")} data-testid="outcome-better">
            Better
          </Button>
          <Button variant="choice" onClick={() => pick("same")} data-testid="outcome-same">
            About the same
          </Button>
          <Button variant="choice" onClick={() => pick("worse")} data-testid="outcome-worse">
            Worse
          </Button>
          <Button variant="ghost" onClick={() => pick("other")}>
            Something else
          </Button>
        </>
      }
    >
      <p className="mt-5 text-h3 text-ink-2">How do you feel compared with a few minutes ago?</p>
    </Scene>
  );
}

const PROMPTS = ["What helped?", "What didn’t?", "What did you notice?"];

export function ReflectionScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const [mode, setMode] = useState<"choose" | "type" | "voice">("choose");
  const [text, setText] = useState("");
  const [after, setAfter] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const placeholder = PROMPTS[(flow.startedAt ?? 0) % PROMPTS.length];

  async function save(partial: Partial<JournalEntry>) {
    const before = takeBeforePhoto();
    const entry: JournalEntry = {
      id: newId(),
      createdAt: Date.now(),
      kind: partial.kind ?? "text",
      mood: flow.emotion ?? undefined,
      outcome: flow.outcome ?? undefined,
      resetId: flow.resetId ?? undefined,
      missionTitle: flow.mission?.title,
      // One photo slot per entry: the "after" photo wins; otherwise keep the "before".
      photo: after ?? before ?? undefined,
      photoMime: (after ?? before)?.type,
      ...partial,
    };
    await db.journal.put(entry);
    send({ type: "REFLECTION_SAVED", reflectionId: entry.id });
  }

  const photoPicker = (
    <>
      <button type="button" className="min-h-11 text-small text-muted underline underline-offset-4" onClick={() => fileRef.current?.click()}>
        {after ? "Photo added (stays on this device)" : "Add a photo of what you found"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => setAfter(e.target.files?.[0] ?? null)} />
    </>
  );

  if (mode === "type") {
    return (
      <Scene
        title="A note for yourself"
        footer={
          <>
            <Button onClick={() => void save({ kind: "text", text: text.trim() })} disabled={!text.trim()} data-testid="save-note">
              Save note
            </Button>
            <Button variant="ghost" onClick={() => setMode("choose")}>
              Back
            </Button>
          </>
        }
      >
        <label htmlFor="note" className="sr-only">
          Your note
        </label>
        <textarea
          id="note"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          placeholder={placeholder}
          rows={5}
          className="mt-8 w-full resize-none rounded-[var(--radius-soft)] border border-line-strong bg-surface p-4 text-body text-ink placeholder:text-muted"
          data-testid="note-text"
        />
        <div className="mt-3">{photoPicker}</div>
      </Scene>
    );
  }
  if (mode === "voice") {
    return (
      <Scene title="Say it out loud">
        <div className="mt-8 w-full">
          <VoiceRecorder onSave={(audio, mime, seconds) => void save({ kind: "voice", audio, audioMime: mime, durationSeconds: seconds })} onCancel={() => setMode("choose")} />
        </div>
        <div className="mt-3">{photoPicker}</div>
      </Scene>
    );
  }
  return (
    <Scene
      title="Want to leave yourself a note?"
      footer={
        <>
          <Button variant="quiet" onClick={() => setMode("voice")}>
            Voice
          </Button>
          <Button variant="quiet" onClick={() => setMode("type")} data-testid="type-note">
            Type
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const before = takeBeforePhoto();
              if (before) void save({ kind: "text", text: "", photo: before, photoMime: before.type });
              else send({ type: "SKIP_REFLECTION" });
            }}
            data-testid="skip-note"
          >
            Skip
          </Button>
        </>
      }
    >
      <p className="mt-5 text-body text-ink-2">Completely optional. It stays on this device.</p>
    </Scene>
  );
}

/** Gemma (or the template) writes 1–2 sentences; the reset is saved; one pattern may be surfaced. */
export function AiReflectionScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const demo = useSettings((s) => s.demo);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const note = flow.reflectionId ? (await db.journal.get(flow.reflectionId))?.text : undefined;
      const minutesAway = Math.round(flow.phoneDownSeconds / 60);
      const summary = await meraAI.summarizeReflection({
        emotion: flow.emotion ? EMOTION_LABEL[flow.emotion].toLowerCase() : null,
        missionTitle: flow.mission?.title ?? null,
        missionCategory: flow.mission?.category ?? null,
        outcome: flow.outcome ? OUTCOME_LABEL[flow.outcome].toLowerCase() : null,
        minutesAway,
        note: note || undefined,
      });
      const startedAt = flow.startedAt ?? Date.now();
      await saveReset({
        id: flow.resetId ?? newId(),
        startedAt,
        emotion: flow.emotion,
        mission: flow.mission,
        phoneDownSeconds: flow.phoneDownSeconds,
        outcome: flow.outcome,
        quiet: flow.quiet,
        hour: new Date(startedAt).getHours(),
        completedAt: Date.now(),
        reflectionId: flow.reflectionId ?? undefined,
        insight: summary.text,
        demo: demo || undefined,
      });
      send({ type: "INSIGHT_READY", insight: summary.text });
    })();
  }, [flow, send, demo]);

  return (
    <Scene title="One moment.">
      <MeraCharacter state="thinking" size={110} className="mt-10" label="MERA is noting what helped" />
    </Scene>
  );
}

export function CompleteScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const [pattern, setPattern] = useState<string | null>(null);

  useEffect(() => {
    void completedResets(50).then(async (h) => {
      const facts = detectPatterns(h).filter((f) => f.key.startsWith("best-") || f.key === "outdoor-vs-indoor");
      if (!facts.length) return;
      const [p] = await meraAI.analyzePatterns(facts.slice(0, 1));
      setPattern(p?.text ?? null);
    });
  }, []);

  const minutes = Math.max(1, Math.round(flow.phoneDownSeconds / 60));
  return (
    <Scene
      labelledBy="complete-title"
      footer={
        <Button onClick={() => send({ type: "DONE" })} data-testid="done">
          Done
        </Button>
      }
    >
      <MeraCharacter state="celebrating" size={96} />
      <Eyebrow className="mt-6">Reset complete</Eyebrow>
      <h1 id="complete-title" tabIndex={-1} className="sr-only">
        Reset complete
      </h1>
      <dl className="mt-6 w-full divide-y divide-line rounded-[var(--radius-soft)] border border-line bg-surface text-left" data-testid="recap">
        {flow.emotion && (
          <div className="flex items-baseline justify-between gap-4 px-5 py-4">
            <dt className="text-small text-ink-2">You started feeling</dt>
            <dd className="text-body font-semibold text-ink">{EMOTION_LABEL[flow.emotion]}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 px-5 py-4">
          <dt className="text-small text-ink-2">Time away from the screen</dt>
          <dd className="text-body font-semibold text-ink">
            {flow.phoneDownSeconds < 60 ? `${flow.phoneDownSeconds} seconds` : `${minutes} minute${minutes === 1 ? "" : "s"}`}
          </dd>
        </div>
        {flow.outcome && (
          <div className="flex items-baseline justify-between gap-4 px-5 py-4">
            <dt className="text-small text-ink-2">After the reset</dt>
            <dd className="text-body font-semibold text-ink">{OUTCOME_LABEL[flow.outcome]}</dd>
          </div>
        )}
      </dl>
      {flow.insight && (
        <p className="mt-6 text-body text-ink" data-testid="insight">
          {flow.insight}
        </p>
      )}
      {pattern && <p className="mt-3 text-small text-ink-2">{pattern}</p>}
      <p className="mt-8 font-display text-h2 text-ink">Go live your life.</p>
    </Scene>
  );
}
