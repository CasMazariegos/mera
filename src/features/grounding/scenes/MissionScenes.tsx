/** Scenes 6–8: one AI-chosen real-world mission, the signature hand-off, and phone-down mode. */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Button, Eyebrow } from "@/components/ui";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import { useFlowEnv } from "@/hooks/useFlowEnv";
import { meraAI } from "@/ai";
import { statusLabel } from "@/ai/mera-ai";
import { buildMissionRequest } from "@/features/patterns/patterns";
import { completedResets } from "@/data/db";
import { cue } from "@/lib/cues";
import { setBeforePhoto } from "@/store/photos";
import type { GeneratedMission } from "@/types";
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_TINT, ENVIRONMENT_ICON, ENVIRONMENT_LABEL, Sparkles } from "@/components/icons";
import { ProgressRing } from "@/components/Scenery";
import { Scene } from "../Scene";

const SOURCE_NOTE: Record<GeneratedMission["source"], string> = {
  "local-gemma": "Chosen by Gemma, on this device",
  "remote-gemma": "Chosen by Gemma (Connected AI)",
  library: "From MERA’s reset library",
};

export function MissionGenerationScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const prefs = useSettings();
  const outside = prefs.canGoOutside === "ask_each_time" ? flow.outside : prefs.canGoOutside === "yes";
  const setOutside = (v: boolean) => send({ type: "SET_OUTSIDE", outside: v });
  const started = useRef(false);

  useEffect(() => {
    if (outside === null || started.current) return;
    started.current = true;
    const t0 = Date.now();
    void (async () => {
      const history = await completedResets(50).catch(() => []);
      const req = buildMissionRequest({
        emotion: flow.emotion ?? "not_sure",
        prefs: { ...prefs, canGoOutside: outside ? "yes" : "indoor_only" },
        history,
        now: new Date(),
      });
      // "Something else": don't hand back the one just shown.
      if (flow.mission) req.recentTitles = [flow.mission.title, ...req.recentTitles].slice(0, 5);
      const mission = await meraAI.generateResetMission(req);
      // Never flash: a calm minimum pause, even when the library answers instantly.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - t0))));
      send({ type: "MISSION_READY", mission });
    })();
  }, [outside, flow.emotion, flow.mission, prefs, send]);

  if (outside === null) {
    return (
      <Scene
        title="Can you step outside right now?"
        footer={
          <>
            <Button onClick={() => setOutside(true)} data-testid="outside-yes">
              Yes, I can
            </Button>
            <Button variant="quiet" onClick={() => setOutside(false)} data-testid="outside-no">
              I’ll stay in
            </Button>
          </>
        }
      >
        <p className="mt-5 text-body text-ink-2">Either way works. I’ll fit your reset to it.</p>
      </Scene>
    );
  }
  return (
    <Scene title="One small thing…">
      <MeraCharacter state="thinking" size={120} className="mt-10" label="MERA is choosing a reset" />
      <p className="mt-6 text-body text-ink-2" aria-live="polite">
        Finding something real-world for you.
      </p>
    </Scene>
  );
}

export function MissionReadyScene() {
  const mission = useFlow((s) => s.flow.mission)!;
  const send = useFlow((s) => s.send);
  const { timing } = useFlowEnv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(false);
  return (
    <Scene
      labelledBy="mission-title"
      footer={
        <>
          <Button onClick={() => send({ type: "GO", now: Date.now(), durationMs: timing.phoneDownMs ?? undefined })} data-testid="im-going">
            I’m going
          </Button>
          <Button variant="ghost" onClick={() => send({ type: "REGENERATE" })} data-testid="something-else">
            Something else
          </Button>
        </>
      }
    >
      {(() => {
        const CatIcon = CATEGORY_ICON[mission.category];
        const EnvIcon = ENVIRONMENT_ICON[mission.environment];
        const seconds = timing.phoneDownMs ? Math.round(timing.phoneDownMs / 1000) : null;
        return (
          <motion.article
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="glass relative w-full overflow-hidden rounded-[var(--radius-card)] text-left shadow-lift"
          >
            {/* Ticket header: the kind of reset, as a small window of colour. */}
            <div className="flex items-center justify-between px-6 pt-6 pb-5" style={{ background: CATEGORY_TINT[mission.category] }}>
              <div>
                <Eyebrow>Your reset</Eyebrow>
                <p className="mt-1 inline-flex items-center gap-1.5 text-small font-semibold text-ink">
                  <CatIcon aria-hidden className="size-4" strokeWidth={1.75} /> {CATEGORY_LABEL[mission.category]}
                </p>
              </div>
              <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-surface/80 shadow-gentle">
                <svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
                  <circle cx="32" cy="32" r="29" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="32"
                    cy="32"
                    r="29"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={182}
                    strokeDashoffset={182 * (1 - Math.min(1, (seconds ? 1 : mission.durationMinutes) / (seconds ? 1 : 10)))}
                  />
                </svg>
                <span className="relative text-center leading-none">
                  <span className="block font-display text-h3 text-ink tabular">{seconds ?? mission.durationMinutes}</span>
                  <span className="block text-[0.625rem] font-semibold tracking-[0.12em] text-ink-2 uppercase">{seconds ? "sec" : "min"}</span>
                </span>
              </span>
            </div>
            {/* Perforation */}
            <div aria-hidden className="relative h-0 border-t-2 border-dashed border-line">
              <span className="absolute -top-3 -left-3 size-6 rounded-full bg-grounding" />
              <span className="absolute -top-3 -right-3 size-6 rounded-full bg-grounding" />
            </div>
            <div className="px-6 pt-5 pb-6">
              <h1
                id="mission-title"
                tabIndex={-1}
                className="font-display text-h1 font-medium tracking-tight text-ink outline-none"
                data-testid="mission-title"
              >
                {mission.title}
              </h1>
              <p className="mt-3 text-h3 leading-snug text-balance text-ink">{mission.instruction}</p>
              {mission.secondaryInstruction && <p className="mt-2 text-body text-ink-2">{mission.secondaryInstruction}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-2 text-micro font-semibold text-ink-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1.5">
                  <EnvIcon aria-hidden className="size-3.5" strokeWidth={2} /> {ENVIRONMENT_LABEL[mission.environment]}
                </span>
                {seconds && <span className="rounded-full bg-sunrise-soft px-3 py-1.5 text-ink">Demo timer</span>}
              </div>
            </div>
          </motion.article>
        );
      })()}
      <p className="mt-5 inline-flex items-center gap-1.5 text-micro text-ink-2" data-testid="mission-source">
        <Sparkles aria-hidden className="size-3.5" />
        {SOURCE_NOTE[mission.source]} · {statusLabel(mission.source === "library" ? "fallback" : mission.source)}
      </p>
      <button type="button" className="mt-2 min-h-11 text-micro text-muted underline underline-offset-4" onClick={() => fileRef.current?.click()}>
        {photo ? "Before photo saved on this device" : "Optional: take a “before” photo"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setBeforePhoto(f);
            setPhoto(true);
          }
        }}
      />
    </Scene>
  );
}

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "Good." → "Now put me away." → "Go touch grass. I'll be here when you get back." → the quietest screen in the app. */
export function PhoneDownScene() {
  const flow = useFlow((s) => s.flow);
  const send = useFlow((s) => s.send);
  const settings = useSettings();
  const { cues, reducedMotion } = useFlowEnv();
  const endsAt = flow.phoneDownEndsAt ?? 0;
  const startedAt = flow.phoneDownStartedAt ?? 0;
  // The signature hand-off plays once, right after "I'm going" (not after a refresh).
  const [fresh] = useState(() => Date.now() - startedAt < 4000);
  const [beat, setBeat] = useState(fresh ? 0 : 3);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (!fresh) return;
    const ts = [setTimeout(() => setBeat(1), 1100), setTimeout(() => setBeat(2), 2600), setTimeout(() => setBeat(3), reducedMotion ? 4200 : 5600)];
    return () => ts.forEach(clearTimeout);
  }, [fresh, reducedMotion]);

  // Absolute end time: correct after backgrounding, screen lock or refresh.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    if (now >= endsAt && !fired.current) {
      fired.current = true;
      cue.timerDone(cues);
      send({ type: "PHONE_DOWN_FINISHED", now: Date.now() });
    }
  }, [now, endsAt, cues, send]);

  if (beat < 3) {
    return (
      <Scene labelledBy="handoff">
        <h1 id="handoff" tabIndex={-1} className="sr-only">
          Good. Now put me away. Go touch grass. I’ll be here when you get back.
        </h1>
        <motion.div animate={beat >= 2 && !reducedMotion ? { x: 60, opacity: 0.85 } : { x: 0, opacity: 1 }} transition={{ duration: 3, ease: "easeInOut" }}>
          <MeraCharacter state={beat >= 2 ? "walking" : "listening"} size={120} />
        </motion.div>
        <div className="mt-10 min-h-40" aria-hidden>
          <AnimatePresence mode="wait">
            {beat === 0 && (
              <motion.p
                key="good"
                className="font-display text-display text-ink"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                Good.
              </motion.p>
            )}
            {beat === 1 && (
              <motion.p
                key="away"
                className="font-display text-h1 text-ink"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                Now put me away.
              </motion.p>
            )}
            {beat === 2 && (
              <motion.div key="grass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                <p className="font-display text-h1 text-ink">Go touch grass.</p>
                <p className="mt-2 text-h3 text-ink-2">I’ll be here when you get back.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Scene>
    );
  }

  const left = endsAt - now;
  return (
    <section
      aria-labelledby="pd-title"
      className="flex min-h-[100dvh] flex-col items-center justify-between px-6 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))] text-center"
      data-testid="phone-down"
    >
      <h1 id="pd-title" className="sr-only">
        Phone down. {mmss(left)} left. You don’t need to look at me.
      </h1>
      <div aria-hidden className="flex flex-col items-center">
        <ProgressRing value={1 - Math.max(0, left) / Math.max(1, endsAt - startedAt)} size={270} stroke={2}>
          <div className="flex flex-col items-center">
            <p className="font-display text-[4.25rem] leading-none font-light text-ink-2 tabular" data-testid="countdown">
              {mmss(left)}
            </p>
            <div className="mt-6 opacity-70">
              <MeraCharacter state="resting" size={40} still />
            </div>
          </div>
        </ProgressRing>
        <p className="mt-8 text-small text-muted">You don’t need to look at me.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-small">
        <button
          type="button"
          aria-pressed={settings.sound}
          onClick={() => settings.set({ sound: !settings.sound })}
          className="min-h-11 rounded-full px-4 text-muted hover:text-ink"
        >
          Audio {settings.sound ? "on" : "off"}
        </button>
        <button
          type="button"
          aria-pressed={settings.haptics}
          onClick={() => settings.set({ haptics: !settings.haptics })}
          className="min-h-11 rounded-full px-4 text-muted hover:text-ink"
        >
          Haptics {settings.haptics ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => send({ type: "END_EARLY", now: Date.now() })}
          className="min-h-11 rounded-full px-4 text-muted underline underline-offset-4 hover:text-ink"
          data-testid="end-early"
        >
          End early
        </button>
      </div>
    </section>
  );
}
