import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { useRoute, href } from "./router";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import { GroundFlow } from "@/features/grounding/GroundFlow";
import { Home } from "@/features/home/Home";
import { DailyReset } from "@/features/daily-reset/DailyReset";
import { CheckIn } from "@/features/check-in/CheckIn";
import { PatternsPage } from "@/features/patterns/PatternsPage";
import { JournalPage } from "@/features/journal/JournalPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AboutPage } from "@/features/about/AboutPage";
import { GroundMeFab } from "@/components/GroundMe";

/** Comfort settings → <html> attributes the design tokens respond to. */
function useComfortSettings() {
  const { theme, contrast, textSize, reducedMotion, demo } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") delete el.dataset.theme;
    else el.dataset.theme = theme;
    el.dataset.contrast = contrast;
    el.dataset.text = textSize;
    if (reducedMotion === "reduce") el.dataset.motion = "reduced";
    else delete el.dataset.motion;
    el.dataset.demo = demo ? "on" : "off";
  }, [theme, contrast, textSize, reducedMotion, demo]);
}

function SubPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <a href={href("/")} className="inline-flex min-h-11 items-center rounded-full pr-3 text-small font-medium text-ink-2 hover:text-ink">
          <span aria-hidden className="mr-1.5">
            ←
          </span>{" "}
          Home
        </a>
        <span className="font-display text-small font-semibold tracking-[0.24em] text-ink-2" aria-hidden>
          MERA
        </span>
      </header>
      <main id="main">{children}</main>
      <GroundMeFab />
    </>
  );
}

export function App() {
  useComfortSettings();
  const route = useRoute();
  const step = useFlow((s) => s.flow.step);
  const reduce = useSettings((s) => s.reducedMotion === "reduce");
  const demo = useSettings((s) => s.demo);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const inFlow = step !== "IDLE";
  let page: React.ReactNode;
  switch (route) {
    case "/daily":
      page = <DailyReset />;
      break;
    case "/check-in":
      page = <CheckIn />;
      break;
    case "/patterns":
      page = <PatternsPage />;
      break;
    case "/journal":
      page = <JournalPage />;
      break;
    case "/settings":
      page = <SettingsPage />;
      break;
    case "/about":
      page = <AboutPage />;
      break;
    default:
      page = null;
  }

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {demo && !inFlow && (
        <p
          className="mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] w-fit rounded-full bg-sunrise-soft px-3 py-1 text-micro font-semibold tracking-[0.12em] text-ink uppercase"
          data-testid="demo-badge"
        >
          Demo mode · short timers
        </p>
      )}
      {/* While a reset runs, the rest of the app is hidden from view and from assistive tech. */}
      <div aria-hidden={inFlow || undefined} inert={inFlow || undefined} className={inFlow ? "hidden" : undefined}>
        {page ? <SubPage>{page}</SubPage> : <Home />}
      </div>
      {inFlow && <GroundFlow />}
    </MotionConfig>
  );
}
