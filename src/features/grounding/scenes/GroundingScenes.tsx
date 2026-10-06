/** Scenes 1–5: interruption, body, breath, senses, check-in. Low cognitive load, one priority each. */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Button } from "@/components/ui";
import { useFlow } from "@/store/flow";
import { useFlowEnv } from "@/hooks/useFlowEnv";
import { cue } from "@/lib/cues";
import { breathAt, breathScale, CYCLE_SECONDS, PHASE_LABEL, type BreathPhase } from "@/features/breathing/breathing";
import { senseFor, type SenseScreen } from "@/features/sensory/senses";
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
      top={<MeraCharacter state="listening" size={132} className="mt-4" />}
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
      <motion.p className="mt-5 max-w-xs text-h3 text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: second ? 1 : 0 }} transition={{ duration: 1.2 }}>
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
  return (
    <Scene
      title="Put both feet on the ground."
      footer={
        <Button variant="quiet" onClick={() => send({ type: "CONTINUE" })} data-testid="continue">
          Continue
        </Button>
      }
    >
      <p className="mt-5 max-w-xs text-h3 text-ink-2">Don’t try to fix anything yet. Just notice where you are.</p>
      <MeraCharacter state="grounding" size={112} className="mt-12" still={reducedMotion} />
      <p className="mt-6 text-small text-muted" aria-live="off">
        Continuing on its own in a moment.
      </p>
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
      <MeraCharacter state="breathing" size={180} scale={reducedMotion ? 1 : breathScale(m)} label="MERA, breathing slowly" still />
      {/* The words carry the timing; the animation is only an echo of them. */}
      <p className="mt-10 font-display text-h1 text-ink" aria-live="polite" data-testid="breath-phase">
        {label}
      </p>
      <p className="mt-2 text-h3 text-ink-2 tabular" aria-hidden>
        {m.done ? " " : m.secondsLeft}
      </p>
      <p className="mt-6 text-small text-muted">
        {m.done ? " " : `Breath ${m.cycle} of ${cycles} · in 4, hold 2, out 6`}
        <span className="sr-only"> ({CYCLE_SECONDS} seconds per breath)</span>
      </p>
    </Scene>
  );
}

export function SenseScene({ step }: { step: SenseScreen["step"] }) {
  const send = useFlow((s) => s.send);
  const { settings } = useFlowEnv();
  const s = senseFor(step, settings);
  return (
    <Scene
      labelledBy={`sense-${s.count}`}
      footer={
        <Button onClick={() => send({ type: "SENSE_DONE" })} data-testid="sense-done">
          {s.cta}
        </Button>
      }
    >
      <p className="font-display text-[6rem] leading-none font-light text-accent tabular" aria-hidden>
        {s.count}
      </p>
      <h1 id={`sense-${s.count}`} tabIndex={-1} className="mt-6 font-display text-h1 font-medium tracking-tight text-balance text-ink">
        {s.lead && <span className="block text-ink-2">{s.lead}</span>}
        {s.prompt}
      </h1>
      {s.support && <p className="mt-4 max-w-xs text-body text-ink-2">{s.support}</p>}
    </Scene>
  );
}

export function EmotionScene() {
  const send = useFlow((s) => s.send);
  const { settings } = useFlowEnv();
  return (
    <Scene title="What feels closest right now?">
      <div className="mt-8 grid w-full grid-cols-2 gap-3" role="group" aria-label="Feelings">
        {EMOTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => send({ type: "PICK_EMOTION", emotion: e })}
            className="min-h-16 rounded-[var(--radius-soft)] border border-line bg-surface px-4 text-h3 font-medium text-ink transition-colors duration-300 hover:border-line-strong hover:bg-elevated"
            data-testid={`emotion-${e}`}
          >
            {EMOTION_LABEL[e]}
          </button>
        ))}
      </div>
      <p className="mt-5 text-small text-muted">
        {settings.aiMode === "remote"
          ? "No need to explain. Only this choice and your reset preferences are shared with Connected AI to pick your reset."
          : "No need to explain. This stays on your device."}
      </p>
    </Scene>
  );
}
