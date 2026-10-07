/** Scenes 9–12: welcome back, optional reflection, a short honest insight, release. */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, Download, Mic, PenLine } from "lucide-react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { OUTCOME_ICON } from "@/components/icons";
import { Button } from "@/components/ui";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import { meraAI } from "@/ai";
import { db, newId, saveReset } from "@/data/db";
import { takeBeforePhoto } from "@/store/photos";
import { VoiceRecorder } from "@/features/reflections/VoiceRecorder";
import { EMOTION_LABEL, OUTCOME_LABEL, type JournalEntry, type Outcome } from "@/types";
import { Scene } from "../Scene";
import { resetRecordFrom, timeAway } from "../record";
import { downloadSummaryCard } from "@/lib/summaryCard";

const OUTCOMES: Array<{ value: Outcome; label: string; tint: string }> = [
  { value: "better", label: "Better", tint: "var(--accent-soft)" },
  { value: "same", label: "About the same", tint: "var(--sky-soft)" },
  { value: "worse", label: "Worse", tint: "var(--clay-soft)" },
];

export function ReturnScene() {
  const send = useFlow((s) => s.send);
  const pick = (outcome: Outcome) => send({ type: "PICK_OUTCOME", outcome });
  return (
    <Scene
      title="Welcome back."
      top={
        <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} className="mt-2">
          <MeraCharacter state="returning" size={120} />
        </motion.div>
      }
      footer={
        <Button variant="ghost" onClick={() => pick("other")}>
          Something else
        </Button>
      }
    >
      <p className="mt-5 max-w-xs text-h3 text-balance text-ink-2">How do you feel compared with a few minutes ago?</p>
      <div className="mt-8 grid w-full grid-cols-3 gap-3" role="group" aria-label="Compared with before">
        {OUTCOMES.map((o, i) => {
          const Icon = OUTCOME_ICON[o.value];
          return (
            <motion.button
              key={o.value}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + 0.08 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => pick(o.value)}
              className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-[var(--radius-soft)] border border-line/70 bg-surface/85 px-2 text-small font-semibold text-ink shadow-gentle transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift"
              data-testid={`outcome-${o.value}`}
            >
              <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full" style={{ background: o.tint }}>
                <Icon className="size-5" strokeWidth={2} />
              </span>
              {o.label}
            </motion.button>
          );
        })}
      </div>
    </Scene>
  );
}

const PROMPTS = ["What helped?", "What didn’t?", "What did you notice?"];

export function ReflectionScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const [mode, setMode] = useState<"choose" | "type" | "voice">("choose");
  const [noteAnyway, setNoteAnyway] = useState(false);
  const demo = useSettings((s) => s.demo);
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
    // If storage fails (private mode, full disk), the reset still finishes; the note just isn't kept.
    const ok = await db.journal.put(entry).then(
      () => true,
      () => false,
    );
    send({ type: "REFLECTION_SAVED", reflectionId: ok ? entry.id : null });
  }

  function skip() {
    const before = takeBeforePhoto();
    if (before) void save({ kind: "text", text: "", photo: before, photoMime: before.type });
    else send({ type: "SKIP_REFLECTION" });
  }

  /** Save this reset as it was ("worse" is useful history), then go straight to a different mission. */
  async function tryAnother() {
    takeBeforePhoto();
    await saveReset(resetRecordFrom(flow, { demo })).catch(() => {});
    send({ type: "TRY_ANOTHER", resetId: newId(), now: Date.now() });
  }

  const photoPicker = (
    <>
      <button
        type="button"
        className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-medium text-ink-2 shadow-gentle hover:text-ink"
        onClick={() => fileRef.current?.click()}
      >
        <Camera aria-hidden className="size-4" strokeWidth={1.75} />
        {after ? "Photo added (stays on this device)" : "Add a photo of what you found"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => setAfter(e.target.files?.[0] ?? null)}
      />
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
          className="mt-8 w-full resize-none rounded-[var(--radius-soft)] border border-line/70 bg-surface/90 p-5 text-body text-ink shadow-gentle placeholder:text-muted focus:border-accent"
          data-testid="note-text"
        />
        <div className="mt-4">{photoPicker}</div>
      </Scene>
    );
  }
  if (mode === "voice") {
    return (
      <Scene title="Say it out loud">
        <div className="mt-8 w-full">
          <VoiceRecorder
            onSave={(audio, mime, seconds) => void save({ kind: "voice", audio, audioMime: mime, durationSeconds: seconds })}
            onCancel={() => setMode("choose")}
          />
        </div>
        <div className="mt-4">{photoPicker}</div>
      </Scene>
    );
  }
  if (flow.outcome === "worse" && mode === "choose" && !noteAnyway) {
    return (
      <Scene
        title="Thanks for checking back in."
        footer={
          <>
            <Button onClick={() => void tryAnother()} data-testid="try-another">
              Try a different reset
            </Button>
            <Button variant="quiet" onClick={() => setNoteAnyway(true)}>
              Leave a note
            </Button>
            <Button variant="ghost" onClick={skip} data-testid="finish-for-now">
              Finish for now
            </Button>
          </>
        }
      >
        <p className="mt-5 max-w-xs text-h3 text-balance text-ink-2">That one didn’t help this time. That’s useful to know.</p>
      </Scene>
    );
  }
  const choices = [
    { key: "voice", label: "Voice", hint: "Say it, keep it", icon: Mic, tint: "var(--sky-soft)", onClick: () => setMode("voice"), testid: "voice-note" },
    { key: "type", label: "Type", hint: "A line or two", icon: PenLine, tint: "var(--sand-soft)", onClick: () => setMode("type"), testid: "type-note" },
  ];
  return (
    <Scene
      title="Want to leave yourself a note?"
      footer={
        <Button variant="ghost" onClick={skip} data-testid="skip-note">
          Skip
        </Button>
      }
    >
      <p className="mt-5 text-body text-ink-2">Completely optional. It stays on this device.</p>
      <div className="mt-8 grid w-full grid-cols-2 gap-3">
        {choices.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              aria-describedby={`hint-${c.key}`}
              className="flex min-h-36 flex-col items-start justify-between rounded-[var(--radius-soft)] border border-line/70 bg-surface/85 p-4 text-left shadow-gentle transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift"
              data-testid={c.testid}
            >
              <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-2xl text-ink" style={{ background: c.tint }}>
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="text-body font-semibold text-ink">{c.label}</span>
              <span id={`hint-${c.key}`} className="-mt-2 text-micro text-ink-2">
                {c.hint}
              </span>
            </button>
          );
        })}
      </div>
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
      const note = flow.reflectionId
        ? await db.journal.get(flow.reflectionId).then(
            (e) => e?.text,
            () => undefined,
          )
        : undefined;
      const minutesAway = Math.round(flow.phoneDownSeconds / 60);
      const summary = await meraAI.summarizeReflection({
        emotion: flow.emotion ? EMOTION_LABEL[flow.emotion].toLowerCase() : null,
        missionTitle: flow.mission?.title ?? null,
        missionCategory: flow.mission?.category ?? null,
        outcome: flow.outcome ? OUTCOME_LABEL[flow.outcome].toLowerCase() : null,
        minutesAway,
        note: note || undefined,
      });
      await saveReset(resetRecordFrom(flow, { insight: summary.text, demo })).catch(() => {});
      send({ type: "INSIGHT_READY", insight: summary.text });
    })();
  }, [flow, send, demo]);

  return (
    <Scene title="One moment.">
      <div className="relative mt-10 flex size-48 items-center justify-center">
        <span aria-hidden className="absolute inset-0 animate-halo rounded-full border-2 border-accent/30" />
        <span aria-hidden className="absolute inset-0 animate-halo rounded-full border-2 border-accent/20 [animation-delay:2s]" />
        <MeraCharacter state="thinking" size={110} label="MERA is noting what helped" />
      </div>
      <p className="mt-6 text-small text-ink-2">Noting what helped, so next time is easier.</p>
    </Scene>
  );
}

export function CompleteScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const away = timeAway(flow.phoneDownSeconds);
  const [saved, setSaved] = useState(false);
  // Completion should feel complete: one number, one line, one sentence, then out.
  return (
    <Scene
      labelledBy="complete-title"
      footer={
        <Button onClick={() => send({ type: "DONE" })} data-testid="done">
          Done
        </Button>
      }
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
        <MeraCharacter state="resting" size={64} still />
      </motion.div>
      <p className="mt-5 text-micro font-semibold tracking-[0.16em] text-ink-2 uppercase">Reset complete</p>
      <h1 id="complete-title" tabIndex={-1} className="mt-3 outline-none" data-testid="back-in-world">
        <span className="block font-display text-[5.5rem] leading-none font-light text-accent-strong tabular">{away.value}</span>
        <span className="mt-2 block font-display text-h2 font-normal text-ink italic">{away.unit} back in the world.</span>
      </h1>
      {(flow.emotion || flow.outcome) && (
        <p className="mt-6 text-small text-ink-2" data-testid="recap">
          {flow.emotion ? EMOTION_LABEL[flow.emotion] : "Started"}
          <span aria-hidden> → </span>
          <span className="sr-only"> before, and afterwards </span>
          <span className="font-semibold text-ink">{flow.outcome ? OUTCOME_LABEL[flow.outcome] : "—"}</span>
        </p>
      )}
      {flow.insight && (
        <p className="mt-6 max-w-sm text-body text-balance text-ink" data-testid="insight">
          {flow.insight}
        </p>
      )}
      <p className="mt-10 font-display text-h1 font-normal text-ink italic">Go live your life.</p>
      {flow.mission && flow.phoneDownSeconds > 0 && (
        <button
          type="button"
          onClick={() =>
            void downloadSummaryCard({ missionTitle: flow.mission!.title, seconds: flow.phoneDownSeconds, date: new Date() }).then(() => setSaved(true))
          }
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-micro text-muted underline underline-offset-4 hover:text-ink"
          data-testid="save-card"
        >
          <Download aria-hidden className="size-3.5" />
          {saved ? "Saved to this device" : "Save a summary image (no notes)"}
        </button>
      )}
    </Scene>
  );
}
