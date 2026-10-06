/**
 * The GROUND ME experience: everything else disappears. Renders the current
 * machine step; scenes only send events. Exit is always one tap (or Escape).
 */
import { useEffect } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useFlow } from "@/store/flow";
import { useFlowEnv } from "@/hooks/useFlowEnv";
import { takeBeforePhoto } from "@/store/photos";
import type { Step } from "./machine";
import { Hills, LeafDrift, Sky } from "@/components/Scenery";

/** How much fog veils the sky at each step, and whether the hills are showing. */
const WORLD: Record<Step, { calm: number; hills: boolean; sun?: boolean }> = {
  IDLE: { calm: 0, hills: true },
  INTRO: { calm: 0.3, hills: true },
  BODY_AWARENESS: { calm: 0.3, hills: true },
  BREATHING: { calm: 0.45, hills: false },
  SENSE_5: { calm: 0.5, hills: false },
  SENSE_4: { calm: 0.52, hills: false },
  SENSE_3: { calm: 0.54, hills: false },
  SENSE_2: { calm: 0.56, hills: false },
  SENSE_1: { calm: 0.58, hills: false },
  EMOTION_CHECK: { calm: 0.6, hills: false },
  MISSION_GENERATION: { calm: 0.4, hills: false },
  MISSION_READY: { calm: 0.1, hills: true },
  PHONE_DOWN: { calm: 0.82, hills: false, sun: false },
  RETURN: { calm: 0.15, hills: true },
  REFLECTION: { calm: 0.5, hills: false },
  AI_REFLECTION: { calm: 0.5, hills: false },
  COMPLETE: { calm: 0.1, hills: true },
};
import { BodyScene, BreathingScene, EmotionScene, IntroScene, SenseScene } from "./scenes/GroundingScenes";
import { MissionGenerationScene, MissionReadyScene, PhoneDownScene } from "./scenes/MissionScenes";
import { AiReflectionScene, CompleteScene, ReflectionScene, ReturnScene } from "./scenes/ReturnScenes";

function SceneFor({ step }: { step: Step }) {
  switch (step) {
    case "INTRO":
      return <IntroScene />;
    case "BODY_AWARENESS":
      return <BodyScene />;
    case "BREATHING":
      return <BreathingScene />;
    case "SENSE_5":
    case "SENSE_4":
    case "SENSE_3":
    case "SENSE_2":
    case "SENSE_1":
      return <SenseScene step={step} />;
    case "EMOTION_CHECK":
      return <EmotionScene />;
    case "MISSION_GENERATION":
      return <MissionGenerationScene />;
    case "MISSION_READY":
      return <MissionReadyScene />;
    case "PHONE_DOWN":
      return <PhoneDownScene />;
    case "RETURN":
      return <ReturnScene />;
    case "REFLECTION":
      return <ReflectionScene />;
    case "AI_REFLECTION":
      return <AiReflectionScene />;
    case "COMPLETE":
      return <CompleteScene />;
    default:
      return null;
  }
}

export function GroundFlow() {
  const step = useFlow((s) => s.flow.step);
  const send = useFlow((s) => s.send);
  const { reducedMotion } = useFlowEnv();
  const exit = () => {
    takeBeforePhoto();
    send({ type: "EXIT" });
  };

  useEffect(() => {
    document.body.dataset.mode = "grounding";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      delete document.body.dataset.mode;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quietChrome = step === "PHONE_DOWN";
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <div role="dialog" aria-modal="true" aria-label="Grounding reset" className="fixed inset-0 z-50 overflow-y-auto bg-grounding" data-testid="ground-flow">
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <Sky calm={WORLD[step].calm} sun={WORLD[step].sun ?? true} />
          <div
            className={`absolute inset-x-0 bottom-0 transition-[opacity,transform] duration-[1200ms] ease-[var(--ease-calm)] ${WORLD[step].hills ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            <Hills height={180} flowers={step !== "BODY_AWARENESS"} />
          </div>
          {step === "COMPLETE" && !reducedMotion && <LeafDrift />}
        </div>
        {!quietChrome && step !== "COMPLETE" && (
          <button
            type="button"
            onClick={exit}
            className="glass fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-10 inline-flex min-h-11 items-center rounded-full px-4 text-small font-medium text-ink-2 shadow-gentle hover:text-ink"
            data-testid="exit-flow"
          >
            <span aria-hidden className="mr-1.5">
              ←
            </span>{" "}
            Exit
          </button>
        )}
        <div className="relative">
          <AnimatePresence mode="wait">
            <SceneFor key={step} step={step} />
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
