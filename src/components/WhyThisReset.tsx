/**
 * "Why this reset?" — a tiny, closed-by-default disclosure. Shows the one-line
 * reason and the exact facts from the person's own history it was based on
 * (the same structured signals the model received). Never the model's raw text.
 */
import { ChevronDown } from "lucide-react";
import { signalText } from "@/features/missions/signals";
import type { GeneratedMission } from "@/types";

const WHO: Record<GeneratedMission["source"], string> = {
  "local-gemma": "Gemma chose this on your device",
  "remote-gemma": "Gemma chose this through Connected AI",
  library: "MERA’s built-in library chose this",
};

export function WhyThisReset({ mission, className = "" }: { mission: GeneratedMission; className?: string }) {
  // The facts behind the reason, minus any the reason already says word for word.
  const facts = (mission.signals ?? [])
    .map(signalText)
    .filter((t): t is string => !!t && !(mission.reason ?? "").includes(t))
    .slice(0, 3);
  return (
    <details className={`group w-full max-w-sm text-left ${className}`} data-testid="why-this-reset">
      <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-small font-medium text-ink-2 hover:text-ink">
        Why this reset?
        <ChevronDown aria-hidden className="size-4 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-[var(--radius-soft)] border border-line/70 bg-surface/90 p-4 text-small text-ink-2 shadow-gentle">
        {mission.reason ? (
          <p className="text-body text-ink" data-testid="why-reason">
            {mission.reason}
          </p>
        ) : (
          <p className="text-body text-ink">There isn’t enough history yet to personalize, so this fits how you feel, your settings and the time of day.</p>
        )}
        {facts.length > 0 && (
          <>
            <p className="mt-3 text-micro font-semibold tracking-[0.12em] text-muted uppercase">Also from your own resets</p>
            <ul className="mt-1.5 space-y-1">
              {facts.map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-micro text-muted">
          {WHO[mission.source]}.{" "}
          {mission.source === "remote-gemma"
            ? "Connected AI received only these short facts and your settings, never your history or notes."
            : "Nothing left this device."}
        </p>
      </div>
    </details>
  );
}
