/** Daily Reset: one small proactive thing, before overwhelm. No streaks. */
import { Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Page } from "@/components/ui";
import { meraAI } from "@/ai";
import { useSettings } from "@/store/settings";
import { useFlow } from "@/store/flow";
import { completedResets, newId } from "@/data/db";
import { buildMissionRequest, countWord, thisWeek } from "@/features/patterns/patterns";
import type { GeneratedMission } from "@/types";

export function DailyReset() {
  const prefs = useSettings();
  const send = useFlow((s) => s.send);
  const [mission, setMission] = useState<GeneratedMission | null>(null);
  const [week, setWeek] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const history = await completedResets(50);
      if (live) setWeek(thisWeek(history));
      const req = buildMissionRequest({
        emotion: "not_sure",
        prefs: { ...prefs, canGoOutside: prefs.canGoOutside === "ask_each_time" ? "yes" : prefs.canGoOutside },
        history,
        now: new Date(),
      });
      const m = await meraAI.generateDailyReset(req);
      if (live) setMission(m);
    })();
    return () => {
      live = false;
    };
    // Generate once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page icon={Sun} eyebrow="Daily reset" title="One small thing." intro="Then back to your day.">
      {mission ? (
        <div className="rounded-[var(--radius-soft)] border border-line bg-surface p-6" data-testid="daily-mission">
          <p className="font-display text-h2 text-ink">{mission.title}</p>
          <p className="mt-3 text-h3 leading-snug text-ink">{mission.instruction}</p>
          {mission.secondaryInstruction && <p className="mt-2 text-body text-ink-2">{mission.secondaryInstruction}</p>}
          <p className="mt-4 text-small font-semibold tracking-[0.12em] text-ink-2 uppercase">{mission.durationMinutes} minutes</p>
          <Button className="mt-6 w-full" onClick={() => send({ type: "START_MISSION", resetId: newId(), now: Date.now(), mission })} data-testid="daily-go">
            Do it now
          </Button>
          <p className="mt-3 text-center text-micro text-muted">
            {mission.source === "library"
              ? "From MERA’s reset library"
              : mission.source === "local-gemma"
                ? "Chosen by Gemma, on this device"
                : "Chosen by Gemma (Connected AI)"}
          </p>
        </div>
      ) : (
        <p className="text-body text-ink-2" role="status">
          Finding one for today…
        </p>
      )}
      {week > 0 && (
        <p className="mt-8 text-body text-ink-2">
          You made time for yourself {countWord(week)} {week === 1 ? "time" : "times"} this week.
        </p>
      )}
    </Page>
  );
}
