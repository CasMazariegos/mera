/**
 * The live GROUND ME flow. Wraps the pure state machine; persisted in this
 * browser so an accidental refresh (or the OS reclaiming the tab during
 * phone-down mode) resumes where the person was.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialState, transition, type FlowEvent, type FlowState } from "@/features/grounding/machine";

interface FlowStore {
  flow: FlowState;
  send: (e: FlowEvent) => void;
}

export const useFlow = create<FlowStore>()(
  persist(
    (set) => ({
      flow: initialState,
      send: (e) => set((s) => ({ flow: transition(s.flow, e) })),
    }),
    {
      name: "mera.flow",
      version: 1,
      partialize: (s) => ({ flow: s.flow }),
      // A flow abandoned long ago shouldn't greet someone days later.
      merge: (persisted, current) => {
        const p = (persisted as { flow?: FlowState } | undefined)?.flow;
        // Someone who put the phone down (or came back to it) can still finish that reset the next day.
        const waiting = p?.step === "PHONE_DOWN" || p?.step === "RETURN" || p?.step === "REFLECTION";
        const maxAge = (waiting ? 24 : 6) * 60 * 60 * 1000;
        if (!p || !p.startedAt || Date.now() - p.startedAt > maxAge) return current;
        // Mid-generation can't resume a model call; go back to the check-in.
        const flow = p.step === "MISSION_GENERATION" ? { ...p, step: "EMOTION_CHECK" as const } : p;
        return { ...current, flow };
      },
    },
  ),
);
