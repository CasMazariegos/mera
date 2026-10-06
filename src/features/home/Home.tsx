/** Home: one dominant action. Everything else is secondary and quiet. */
import { useEffect, useState } from "react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { GroundMeButton } from "@/components/GroundMe";
import { href, type Route } from "@/app/router";
import { useAiStatus } from "@/hooks/useAiStatus";
import { completedResets } from "@/data/db";
import { countWord, thisWeek } from "@/features/patterns/patterns";

const SECONDARY: Array<{ to: Route; label: string; hint: string }> = [
  { to: "/daily", label: "Daily reset", hint: "One small thing, before it piles up" },
  { to: "/check-in", label: "Check in", hint: "How are you, really?" },
  { to: "/patterns", label: "My patterns", hint: "What seems to help" },
  { to: "/journal", label: "Journal", hint: "Notes to yourself" },
];

export function Home() {
  const status = useAiStatus();
  const [week, setWeek] = useState(0);
  useEffect(() => {
    void completedResets().then((h) => setWeek(thisWeek(h)));
  }, []);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between">
        <p className="font-display text-h3 font-semibold tracking-[0.24em] text-ink" aria-label="MERA">
          MERA
        </p>
        <a href={href("/settings")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-micro font-semibold tracking-[0.12em] text-ink-2 hover:border-line-strong" title={status.detail} data-testid="ai-status">
          <span aria-hidden className={`size-2 rounded-full ${status.label === "OFFLINE RESET" ? "bg-sky" : "bg-accent"}`} />
          {status.label}
          <span className="sr-only">: {status.detail} Open privacy and AI settings.</span>
        </a>
      </header>

      <main id="main" className="flex flex-1 flex-col items-center text-center">
        <h1 className="mt-10 font-display text-h1 font-medium tracking-tight text-ink sm:text-display">Come back to yourself.</h1>
        <MeraCharacter state="resting" size={150} className="mt-8" />
        <div className="mt-8 w-full max-w-sm">
          <GroundMeButton />
          <p className="mt-4 text-body text-ink-2">For when everything feels like too much.</p>
        </div>

        <nav aria-label="More" className="mt-auto w-full pt-14">
          <ul className="grid grid-cols-2 gap-3">
            {SECONDARY.map((s) => (
              <li key={s.to}>
                <a href={href(s.to)} className="flex min-h-20 flex-col justify-center rounded-[var(--radius-soft)] border border-line bg-surface/70 px-4 py-3 text-left transition-colors duration-300 hover:border-line-strong hover:bg-surface">
                  <span className="text-body font-semibold text-ink">{s.label}</span>
                  <span className="text-micro text-ink-2">{s.hint}</span>
                </a>
              </li>
            ))}
          </ul>
          {week > 0 && <p className="mt-6 text-small text-ink-2">You made time for yourself {countWord(week)} {week === 1 ? "time" : "times"} this week.</p>}
          <p className="mt-6 text-micro text-muted">
            <a className="underline underline-offset-4 hover:text-ink" href={href("/settings")}>
              Privacy & AI
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-4 hover:text-ink" href={href("/about")}>
              About MERA
            </a>{" "}
            · by Cass - NextRealm Interactive
          </p>
        </nav>
      </main>
    </div>
  );
}
