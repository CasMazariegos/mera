/** My Patterns: observations from local history — inspectable and deletable. */
import { Sprout } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Page } from "@/components/ui";
import { meraAI } from "@/ai";
import { completedResets, db } from "@/data/db";
import { detectPatterns, minutesThisWeek, MIN_RESETS_FOR_PATTERNS } from "./patterns";
import { EMOTION_LABEL, OUTCOME_LABEL, type ResetRecord } from "@/types";
import type { PatternResult } from "@/ai/providers/types";

export function PatternsPage() {
  const [history, setHistory] = useState<ResetRecord[] | null>(null);
  const [patterns, setPatterns] = useState<PatternResult[]>([]);

  const load = useCallback(
    () =>
      completedResets(200).then(async (h) => {
        setHistory(h);
        const facts = detectPatterns(h);
        setPatterns(facts.length ? await meraAI.analyzePatterns(facts) : []);
      }),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await db.resets.delete(id);
    await load();
  }

  if (!history)
    return (
      <Page icon={Sprout} eyebrow="My patterns" title="What seems to help">
        {null}
      </Page>
    );
  return (
    <Page
      icon={Sprout}
      eyebrow="My patterns"
      title="What seems to help"
      intro="Observations from your own resets, on this device. Not conclusions, just what you might notice too."
    >
      <div className="mb-6 rounded-[var(--radius-card)] border border-line/70 bg-surface px-6 py-6 text-center shadow-gentle" data-testid="week-minutes">
        <p className="font-display text-[3.5rem] leading-none font-light text-accent-strong tabular">{minutesThisWeek(history)}</p>
        <p className="mt-2 font-display text-h3 text-ink italic">minutes back in the world this week</p>
        <p className="mt-2 text-micro text-muted">Time spent away from the screen during resets. Not a goal, just a quiet count.</p>
      </div>
      {patterns.length === 0 ? (
        <EmptyState
          title="Nothing to analyze yet."
          body={`Use MERA a few times (${MIN_RESETS_FOR_PATTERNS} resets with a “how do you feel” answer) and patterns may begin to appear.`}
        />
      ) : (
        <ul className="space-y-3" data-testid="patterns">
          {patterns.slice(0, 3).map((p) => (
            <li key={p.key} className="rounded-[var(--radius-soft)] border border-line/70 bg-surface px-5 py-4 text-body text-ink shadow-gentle">
              {p.text}
              <span className="mt-1 block text-micro text-muted">
                {p.source === "fallback"
                  ? "Counted on this device"
                  : p.source === "local-gemma"
                    ? "Counted on this device · phrased by Gemma locally"
                    : "Counted on this device · phrased by Gemma (Connected AI)"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <details className="group mt-10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-body font-semibold text-ink">
            Your recent resets ({history.length})
            <span aria-hidden className="text-h3 text-ink-2 transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-1 text-small text-ink-2">Remove any reset and it’s no longer counted.</p>
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-soft)] border border-line bg-surface">
            {history.slice(0, 20).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-body text-ink">
                    {r.mission?.title ?? "Grounding only"}
                    {r.demo && <span className="ml-2 rounded-full bg-sunrise-soft px-2 py-0.5 text-micro text-ink">sample</span>}
                  </p>
                  <p className="text-micro text-ink-2">
                    {new Date(r.startedAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {r.emotion ? ` · ${EMOTION_LABEL[r.emotion]}` : ""}
                    {r.outcome ? ` → ${OUTCOME_LABEL[r.outcome]}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="min-h-11 shrink-0 rounded-full px-3 text-small text-ink-2 underline underline-offset-4 hover:text-ink"
                  aria-label={`Remove reset “${r.mission?.title ?? "Grounding only"}”`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Page>
  );
}
