/** 5-4-3-2-1 grounding: one sense per screen, no typing. */
import type { Step } from "@/features/grounding/machine";

export interface SenseScreen {
  step: Extract<Step, "SENSE_5" | "SENSE_4" | "SENSE_3" | "SENSE_2" | "SENSE_1">;
  count: number;
  sense: "see" | "feel" | "hear" | "smell" | "appreciate";
  lead?: string;
  prompt: string;
  support?: string;
  cta: string;
}

export const SENSES: SenseScreen[] = [
  { step: "SENSE_5", count: 5, sense: "see", lead: "Look around.", prompt: "Notice five things you can see.", cta: "I see them" },
  {
    step: "SENSE_4",
    count: 4,
    sense: "feel",
    prompt: "Notice four things you can physically feel.",
    support: "Your feet. Your clothing. The chair. The air.",
    cta: "I feel them",
  },
  { step: "SENSE_3", count: 3, sense: "hear", lead: "Listen.", prompt: "Notice three sounds around you.", cta: "I hear them" },
  { step: "SENSE_2", count: 2, sense: "smell", prompt: "Notice two things you can smell.", support: "Nothing noticeable counts too.", cta: "Done" },
  {
    step: "SENSE_1",
    count: 1,
    sense: "appreciate",
    prompt: "Find one thing you can appreciate in this moment.",
    support: "It doesn't have to be profound.",
    cta: "I have one",
  },
];

/** Gentler wording when the person has said sound or smell isn't useful for them. */
export function senseFor(step: SenseScreen["step"], opts: { avoidSound: boolean; avoidSmell: boolean }): SenseScreen {
  const s = SENSES.find((x) => x.step === step)!;
  if (s.sense === "hear" && opts.avoidSound)
    return { ...s, lead: "Look again.", prompt: "Notice three things that are moving, even slightly.", cta: "I notice them" };
  if (s.sense === "smell" && opts.avoidSmell)
    return { ...s, prompt: "Notice two temperatures — warm or cool spots on your skin.", support: "Hands, face, feet. Anything counts.", cta: "Done" };
  return s;
}
