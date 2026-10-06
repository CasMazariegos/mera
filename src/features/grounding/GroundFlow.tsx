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
        {!quietChrome && step !== "COMPLETE" && (
          <button
            type="button"
            onClick={exit}
            className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-10 inline-flex min-h-11 items-center rounded-full px-4 text-small font-medium text-muted hover:text-ink"
            data-testid="exit-flow"
          >
            <span aria-hidden className="mr-1.5">
              ←
            </span>{" "}
            Exit
          </button>
        )}
        <AnimatePresence mode="wait">
          <SceneFor key={step} step={step} />
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
