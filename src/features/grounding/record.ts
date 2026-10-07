/** Turning a finished (or tried-and-moved-on) flow into the record MERA keeps on this device. */
import type { FlowState } from "./machine";
import type { ResetRecord } from "@/types";
import { newId } from "@/data/db";

export function resetRecordFrom(flow: FlowState, extra: { insight?: string; demo?: boolean } = {}): ResetRecord {
  const startedAt = flow.startedAt ?? Date.now();
  return {
    id: flow.resetId ?? newId(),
    startedAt,
    emotion: flow.emotion,
    mission: flow.mission,
    phoneDownSeconds: flow.phoneDownSeconds,
    plannedSeconds: flow.phoneDownPlannedSeconds || undefined,
    timerCompleted: flow.phoneDownStartedAt ? flow.phoneDownCompleted : undefined,
    path: flow.path,
    outcome: flow.outcome,
    quiet: flow.quiet,
    hour: new Date(startedAt).getHours(),
    completedAt: Date.now(),
    reflectionId: flow.reflectionId ?? undefined,
    insight: extra.insight,
    demo: extra.demo || undefined,
  };
}

/** "6 minutes" / "40 seconds": the quiet headline number. Never compared, never shamed. */
export function timeAway(seconds: number): { value: string; unit: string } {
  if (seconds < 60) return { value: String(Math.max(0, seconds)), unit: seconds === 1 ? "second" : "seconds" };
  const m = Math.round(seconds / 60);
  return { value: String(m), unit: m === 1 ? "minute" : "minutes" };
}
