/** Scenes 1–5: interruption, body, breath, senses, check-in. Low cognitive load, one priority each. */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Button } from "@/components/ui";
import { BreathRings } from "@/components/Scenery";
import { EMOTION_ICON, EMOTION_TINT, SENSE_ICON } from "@/components/icons";
import { useFlow } from "@/store/flow";
import { useFlowEnv } from "@/hooks/useFlowEnv";
import { cue } from "@/lib/cues";
import { breathAt, breathScale, CYCLE_SECONDS, PHASE_LABEL, type BreathPhase } from "@/features/breathing/breathing";
import { SENSES, senseFor, type SenseScreen } from "@/features/sensory/senses";
import { EMOTIONS, EMOTION_LABEL } from "@/types";
import { Scene } from "../Scene";

export function IntroScene() {
  const send = useFlow((s) => s.send);
  const { reducedMotion } = useFlowEnv();
  const [second, setSecond] = useState(reducedMotion);
  useEffect(() => {
    if (second) return;
    const t = setTimeout(() => setSecond(true), 1400);
    return () => clearTimeout(t);
  }, [second]);
  return (
    <Scene
      title="I’m here."
      top={
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="mt-6">
          <MeraCharacter state="listening" size={140} />
        </motion.div>
      }
      footer={
        <>
          <Button onClick={() => send({ type: "START_RESET" })} data-testid="start-reset">
            Start reset
          </Button>
          <Button variant="ghost" onClick={() => send({ type: "START_RESET", quiet: true })} data-testid="quieter">
            I need something quieter
          </Button>
        </>
      }
    >
      <motion.p
        className="mt-5 max-w-xs text-h3 text-balance text-ink-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: second ? 1 : 0 }}
        transition={{ duration: 1.2 }}
      >
        You don’t have to figure everything out right now.
      </motion.p>
    </Scene>
  );
}

export function BodyScene() {
  const send = useFlow((s) => s.send);
  const { timing, reducedMotion } = useFlowEnv();
  const [left, setLeft] = useState(timing.bodySeconds);
  useEffect(() => {
    if (left <= 0) {
      send({ type: "CONTINUE" });
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, send]);
  const progress = 1 - left / timing.bodySeconds;
  return (
    <Scene
      title="Put both feet on the ground."
      footer={
        <button
          type="button"
          onClick={() => send({ type: "CONTINUE" })}
          className="glass relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-full px-7 text-body font-semibold text-ink shadow-gentle"
          data-testid="continue"
        >
          {/* Fills as the scene moves on by itself — no rush, just a visible promise. */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
          <span className="relative">Continue</span>
        </button>
      }
    >
      <p className="mt-5 max-w-xs text-h3 text-balance text-ink-2">Don’t try to fix anything yet. Just notice where you are.</p>
      <motion.div className="mt-10" initial={{ y: -10 }} animate={{ y: 0 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}>
        <MeraCharacter state="grounding" size={120} still={reducedMotion} />
      </motion.div>
      <p className="sr-only">Continuing on its own in a moment.</p>
    </Scene>
  );
}

export function BreathingScene() {
  const send = useFlow((s) => s.send);
  const { timing, cues, reducedMotion } = useFlowEnv();
  const [elapsed, setElapsed] = useState(0);
  const start = useRef<number | null>(null);
  const lastPhase = useRef<BreathPhase | null>(null);
  const cycles = timing.breathCycles;
  const m = breathAt(elapsed, cycles);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      start.current ??= t;
      const e = t - start.current;
      setElapsed(e);
      if (!breathAt(e, cycles).done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cycles]);

  useEffect(() => {
    if (m.done) {
      const t = setTimeout(() => send({ type: "BREATHING_DONE" }), 600);
      return () => clearTimeout(t);
    }
    if (m.phase !== lastPhase.current) {
      lastPhase.current = m.phase;
      cue.breathPhase(cues, m.phase);
    }
  }, [m.done, m.phase, cues, send]);

  const scale = breathScale(m);
  const label = m.done ? "Good." : PHASE_LABEL[m.phase];
  return (
    <Scene
      labelledBy="breath-title"
      footer={
        <Button variant="ghost" onClick={() => send({ type: "CONTINUE" })}>
          Skip breathing
        </Button>
      }
    >
      <h1 id="breath-title" className="sr-only">
        Breathe with MERA
      </h1>
      <div className="relative flex size-72 items-center justify-center">
        <BreathRings scale={scale} still={reducedMotion} />
        <MeraCharacter state="breathing" size={150} scale={reducedMotion ? 1 : scale} label="MERA, breathing slowly" still />
      </div>
      {/* The words carry the timing; the animation only echoes them. */}
      <p className="mt-6 font-display text-h1 text-ink" aria-live="polite" data-testid="breath-phase">
        {label}
      </p>
      <p className="mt-1 font-display text-h2 text-ink-2 tabular" aria-hidden>
        {m.done ? " " : m.secondsLeft}
      </p>
      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: cycles }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-700 ${i < m.cycle - (m.done ? 0 : 1) || m.done ? "w-8 bg-accent" : i === m.cycle - 1 ? "w-8 bg-accent/50" : "w-4 bg-line-strong"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-small text-muted">
        In 4 · hold 2 · out 6
        <span className="sr-only">
          . Breath {m.cycle} of {cycles}, {CYCLE_SECONDS} seconds each.
        </span>
      </p>
    </Scene>
  );
}

export function SenseScene({ step }: { step: SenseScreen["step"] }) {
  const send = useFlow((s) => s.send);
  const { settings } = useFlowEnv();
  const s = senseFor(step, settings);
  const Icon = SENSE_ICON[s.sense];
  const [noticed, setNoticed] = useState(0);
  return (
    <Scene
      labelledBy={`sense-${s.count}`}
      top={
        <ol className="mt-4 flex items-center gap-3" aria-label="Five senses">
          {SENSES.map((x) => (
            <li
              key={x.step}
              aria-current={x.step === step ? "step" : undefined}
              className={`font-display text-h3 tabular transition-all duration-500 ${x.step === step ? "scale-110 text-accent-strong" : x.count > s.count ? "text-ink-2/50" : "text-muted/40"}`}
            >
              {x.count}
            </li>
          ))}
        </ol>
      }
      footer={
        <Button onClick={() => send({ type: "SENSE_DONE" })} data-testid="sense-done">
          {s.cta}
        </Button>
      }
    >
      <div className="relative flex items-center justify-center">
        <span aria-hidden className="absolute size-40 rounded-full bg-accent-soft/70 blur-xl" />
        <p className="relative font-display text-[7rem] leading-none font-light text-accent-strong tabular" aria-hidden>
          {s.count}
        </p>
        <span aria-hidden className="glass absolute -right-6 bottom-2 inline-flex size-12 items-center justify-center rounded-full text-ink shadow-gentle">
          <Icon className="size-6" strokeWidth={1.75} />
        </span>
      </div>
      <h1 id={`sense-${s.count}`} tabIndex={-1} className="mt-8 font-display text-h1 font-medium tracking-tight text-balance text-ink outline-none">
        {s.lead && <span className="block text-ink-2">{s.lead}</span>}
        {s.prompt}
      </h1>
      {s.support && <p className="mt-4 max-w-xs text-body text-ink-2">{s.support}</p>}
      {/* Optional: tap a dot for each thing noticed. Never required. */}
      <div className="mt-8 flex gap-3" role="group" aria-label={`Optional: tap once for each thing you notice (${noticed} of ${s.count})`}>
        {Array.from({ length: s.count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Noticed ${i + 1}`}
            aria-pressed={i < noticed}
            onClick={() => setNoticed(i < noticed ? i : i + 1)}
            className={`size-11 rounded-full border-2 transition-all duration-500 ${i < noticed ? "scale-105 border-accent bg-accent" : "border-line-strong bg-surface/60 hover:border-accent"}`}
          />
        ))}
      </div>
    </Scene>
  );
}

export function EmotionScene() {
  const send = useFlow((s) => s.send);
  const { settings } = useFlowEnv();
  return (
    <Scene title="What feels closest right now?">
      <div className="mt-8 grid w-full grid-cols-2 gap-3" role="group" aria-label="Feelings">
        {EMOTIONS.map((e, i) => {
          const Icon = EMOTION_ICON[e];
          return (
            <motion.button
              key={e}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => send({ type: "PICK_EMOTION", emotion: e })}
              className="group flex min-h-16 items-center gap-3 rounded-[var(--radius-soft)] border border-line/70 bg-surface/85 px-4 text-left text-body font-semibold text-ink shadow-gentle transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift"
              data-testid={`emotion-${e}`}
            >
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: EMOTION_TINT[e] }}>
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              {EMOTION_LABEL[e]}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-6 text-small text-ink-2">
        {settings.aiMode === "remote"
          ? "No need to explain. Only this choice and your reset preferences are shared with Connected AI to pick your reset."
          : "No need to explain. This stays on your device."}
      </p>
    </Scene>
  );
}
