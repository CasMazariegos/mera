/** Home: sky → MERA on her hill → GROUND ME → the ground, where everything else quietly lives. */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Compass, HeartHandshake, Settings2, Sprout, Sun, type LucideIcon } from "lucide-react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { GroundMeButton } from "@/components/GroundMe";
import { Hills, Sky } from "@/components/Scenery";
import { Sparkles } from "@/components/icons";
import { href, type Route } from "@/app/router";
import { useAiStatus } from "@/hooks/useAiStatus";
import { completedResets } from "@/data/db";
import { countWord, minutesThisWeek, thisWeek } from "@/features/patterns/patterns";
import { greeting } from "@/lib/daypart";
import type { ResetRecord } from "@/types";

const SECONDARY: Array<{ to: Route; label: string; hint: string; icon: LucideIcon; tint: string }> = [
  { to: "/daily", label: "Daily reset", hint: "One small thing, before it piles up", icon: Sun, tint: "var(--sunrise-soft)" },
  { to: "/check-in", label: "Check in", hint: "How are you, really?", icon: HeartHandshake, tint: "var(--clay-soft)" },
  { to: "/patterns", label: "My patterns", hint: "What seems to help", icon: Sprout, tint: "var(--accent-soft)" },
  { to: "/journal", label: "Journal", hint: "Notes to yourself", icon: BookOpen, tint: "var(--sky-soft)" },
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_MS = 86_400_000;

export function Home() {
  const status = useAiStatus();
  const [history, setHistory] = useState<ResetRecord[]>([]);
  const [now] = useState(() => new Date());
  useEffect(() => {
    void completedResets(50).then(setHistory);
  }, []);

  const week = thisWeek(history, now);
  const minutes = minutesThisWeek(history, now);
  const days = useMemo(() => {
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return DAYS.map((label, i) => {
      const start = monday.getTime() + i * DAY_MS;
      const done = history.some((r) => r.completedAt && r.completedAt >= start && r.completedAt < start + DAY_MS);
      return { label, done, today: i === (now.getDay() + 6) % 7 };
    });
  }, [history, now]);
  const last = history.find((r) => r.insight);

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
            <div className="flex items-center gap-2">
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
              <a
                href={href("/welcome")}
                className="glass inline-flex size-11 items-center justify-center rounded-full text-ink-2 shadow-gentle hover:text-ink"
                aria-label="How MERA works"
              >
                <Compass aria-hidden className="size-5" strokeWidth={1.75} />
              </a>
            </div>
          </header>

          <main id="main" className="contents">
            <p className="mt-10 animate-rise text-small font-medium tracking-[0.08em] text-ink-2">{greeting(now.getHours())}</p>
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
          <p className="mt-1 text-small text-muted">A short grounding reset that ends outside the app.</p>
        </div>

        {/* This week, gently. No streaks. */}
        <section
          aria-labelledby="week-h"
          className="mt-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 shadow-gentle"
          data-testid="home-week"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="week-h" className="text-micro font-semibold tracking-[0.14em] text-ink-2 uppercase">
              This week
            </h2>
            <a href={href("/patterns")} className="inline-flex min-h-11 items-center text-micro font-semibold text-accent-strong hover:underline">
              What helps →
            </a>
          </div>
          <ol className="mt-2 grid grid-cols-7 gap-1.5" aria-label="Days this week with a reset">
            {days.map((d, i) => (
              <li key={i} className="flex flex-col items-center gap-1.5">
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-full ${d.done ? "bg-accent-soft text-accent-strong" : "bg-surface-sunk text-muted"} ${d.today ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-surface" : ""}`}
                >
                  {d.done ? <Sprout aria-hidden className="size-5" strokeWidth={2} /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                  <span className="sr-only">{d.done ? "Reset done" : "No reset"}</span>
                </span>
                <span aria-hidden className={`text-micro ${d.today ? "font-bold text-ink" : "text-muted"}`}>
                  {d.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-small text-ink">
            {week > 0 ? (
              <>
                <span className="font-semibold">{minutes} minutes back in the world</span> this week, over {countWord(week)} {week === 1 ? "reset" : "resets"}.
              </>
            ) : (
              "Nothing yet this week, and that’s fine. MERA is here when you need it."
            )}
          </p>
        </section>

        {last?.insight && (
          <section aria-label="Last note from MERA" className="glass mt-4 flex gap-3 rounded-[var(--radius-card)] p-5 shadow-gentle">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sunrise-soft text-ink">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-micro font-semibold tracking-[0.14em] text-ink-2 uppercase">Last time</p>
              <p className="mt-1 text-body text-ink">{last.insight}</p>
            </div>
          </section>
        )}

        <nav aria-label="More" className="mt-10">
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

        <a
          href={href("/welcome")}
          className="group mt-4 flex items-center gap-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 shadow-gentle transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-soft text-ink">
            <Compass className="size-6" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-body font-semibold text-ink">How MERA works</span>
            <span className="block text-small text-ink-2">The reset step by step, the AI, and your privacy.</span>
          </span>
          <ArrowRight aria-hidden className="size-5 text-muted transition-transform duration-500 group-hover:translate-x-0.5" />
        </a>

        <a
          href={href("/settings")}
          className="group mt-3 flex items-center gap-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 shadow-gentle transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sand-soft text-ink">
            <Settings2 className="size-6" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-body font-semibold text-ink">Privacy & AI</span>
            <span className="block text-small text-ink-2">Where Gemma runs, comfort settings, export or delete.</span>
          </span>
          <ArrowRight aria-hidden className="size-5 text-muted transition-transform duration-500 group-hover:translate-x-0.5" />
        </a>

        <footer className="mt-10 text-center text-micro text-muted">
          <p className="mb-3 font-display text-small text-ink-2 italic">MERA is designed to help you leave MERA.</p>
          <a className="underline underline-offset-4 hover:text-ink" href={href("/about")}>
            About MERA
          </a>
          <p className="mt-2">by Cass - NextRealm Interactive</p>
        </footer>
      </div>
    </div>
  );
}
