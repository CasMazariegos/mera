/** Home: sky → MERA on her hill → GROUND ME → the ground, where everything else quietly lives. */
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, HeartHandshake, Sprout, Sun, type LucideIcon } from "lucide-react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { GroundMeButton } from "@/components/GroundMe";
import { Hills, Sky } from "@/components/Scenery";
import { href, type Route } from "@/app/router";
import { useAiStatus } from "@/hooks/useAiStatus";
import { completedResets } from "@/data/db";
import { countWord, thisWeek } from "@/features/patterns/patterns";
import { greeting } from "@/lib/daypart";

const SECONDARY: Array<{ to: Route; label: string; hint: string; icon: LucideIcon; tint: string }> = [
  { to: "/daily", label: "Daily reset", hint: "One small thing, before it piles up", icon: Sun, tint: "var(--sunrise-soft)" },
  { to: "/check-in", label: "Check in", hint: "How are you, really?", icon: HeartHandshake, tint: "var(--clay-soft)" },
  { to: "/patterns", label: "My patterns", hint: "What seems to help", icon: Sprout, tint: "var(--accent-soft)" },
  { to: "/journal", label: "Journal", hint: "Notes to yourself", icon: BookOpen, tint: "var(--sky-soft)" },
];

export function Home() {
  const status = useAiStatus();
  const [week, setWeek] = useState(0);
  const [hour] = useState(() => new Date().getHours());
  useEffect(() => {
    void completedResets().then((h) => setWeek(thisWeek(h)));
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      {/* The world */}
      <section className="relative isolate">
        <Sky />
        <div className="relative mx-auto flex w-full max-w-xl flex-col items-center px-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
          <header className="flex w-full items-center justify-between">
            <p className="font-display text-h3 font-semibold tracking-[0.28em] text-ink" aria-label="MERA">
              MERA
            </p>
            <a
              href={href("/settings")}
              className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-micro font-semibold tracking-[0.12em] text-ink-2 shadow-gentle hover:text-ink"
              title={status.detail}
              data-testid="ai-status"
            >
              <span aria-hidden className="relative flex size-2">
                <span
                  className={`absolute inline-flex size-full rounded-full ${status.label === "OFFLINE RESET" ? "bg-sky" : "bg-accent"} opacity-60 motion-safe:animate-ping`}
                />
                <span className={`relative inline-flex size-2 rounded-full ${status.label === "OFFLINE RESET" ? "bg-sky" : "bg-accent"}`} />
              </span>
              {status.label}
              <span className="sr-only">: {status.detail} Open privacy and AI settings.</span>
            </a>
          </header>

          <main id="main" className="contents">
            <p className="mt-10 animate-rise text-small font-medium tracking-[0.08em] text-ink-2">{greeting(hour)}</p>
            <h1 className="mt-2 animate-rise font-display text-h1 font-medium tracking-tight text-balance text-ink [animation-delay:80ms] sm:text-display">
              Come back to <em className="font-normal text-accent-strong">yourself.</em>
            </h1>
            <div className="relative z-10 mt-6 -mb-16 animate-rise [animation-delay:160ms]">
              <MeraCharacter state="resting" size={150} />
            </div>
          </main>
        </div>
        <Hills height={170} />
      </section>

      {/* The ground */}
      <div className="relative mx-auto w-full max-w-xl px-6 pb-12">
        <div className="-mt-6 animate-rise text-center [animation-delay:240ms]">
          <GroundMeButton />
          <p className="mt-5 text-body text-ink-2">For when everything feels like too much.</p>
        </div>

        <nav aria-label="More" className="mt-12">
          <ul className="grid grid-cols-2 gap-3">
            {SECONDARY.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.to}>
                  <a
                    href={href(s.to)}
                    className="group flex min-h-32 flex-col justify-between rounded-[var(--radius-soft)] border border-line/70 bg-surface p-4 text-left shadow-gentle transition-[transform,box-shadow] duration-500 ease-[var(--ease-calm)] hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-2xl text-ink" style={{ background: s.tint }}>
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span>
                      <span className="flex items-center justify-between text-body font-semibold text-ink">
                        {s.label}
                        <ArrowRight aria-hidden className="size-4 text-muted transition-transform duration-500 group-hover:translate-x-0.5" />
                      </span>
                      <span className="mt-0.5 block text-micro text-ink-2">{s.hint}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {week > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-[var(--radius-soft)] bg-accent-soft/60 px-5 py-4">
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: Math.min(week, 7) }, (_, i) => (
                <Sprout key={i} className="size-4 text-accent-strong" strokeWidth={2} />
              ))}
            </span>
            <p className="text-small text-ink">
              You made time for yourself {countWord(week)} {week === 1 ? "time" : "times"} this week.
            </p>
          </div>
        )}

        <footer className="mt-10 text-center text-micro text-muted">
          <a className="underline underline-offset-4 hover:text-ink" href={href("/settings")}>
            Privacy & AI
          </a>{" "}
          ·{" "}
          <a className="underline underline-offset-4 hover:text-ink" href={href("/about")}>
            About MERA
          </a>
          <p className="mt-2">by Cass - NextRealm Interactive</p>
        </footer>
      </div>
    </div>
  );
}
