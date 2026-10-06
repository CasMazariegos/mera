/**
 * Schemas for everything the AI is allowed to produce. Model output that controls
 * the app is parsed with these, then checked by the safety rules; anything that
 * fails is never shown.
 */
import { z } from "zod";
import { CATEGORIES, EMOTIONS, ENVIRONMENTS } from "@/types";

const sentence = (max: number) =>
  z
    .string()
    .trim()
    .min(8)
    .max(max)
    // No markup, links or code — plain words only.
    .refine((s) => !/[<>{}[\]`]|https?:|www\./i.test(s), "plain_text_only");

export const missionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .refine((s) => !/[<>{}[\]`]/.test(s), "plain_text_only"),
  durationMinutes: z.number().int().min(2).max(10),
  category: z.enum(CATEGORIES),
  environment: z.enum(ENVIRONMENTS),
  instruction: sentence(140),
  secondaryInstruction: sentence(120)
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
});
export type MissionOutput = z.infer<typeof missionSchema>;

export const reflectionSummarySchema = z.object({
  summary: sentence(220),
});

export const patternPhraseSchema = z.object({
  sentence: sentence(160),
});

export const dailyResetSchema = missionSchema;

/** What the providers receive to make a mission. Only structured, non-free-text data. */
export const missionRequestSchema = z.object({
  emotion: z.enum(EMOTIONS),
  canGoOutside: z.enum(["yes", "indoor_only", "ask_each_time"]),
  minutes: z.number().int().min(2).max(10),
  lowMobility: z.boolean(),
  avoidSound: z.boolean(),
  avoidSmell: z.boolean(),
  /** Coarse time of day only — never location. */
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  /** Categories that helped / didn't, from local history (counts, no text). */
  helped: z.partialRecord(z.enum(CATEGORIES), z.number().int().min(0).max(1000)),
  notHelped: z.partialRecord(z.enum(CATEGORIES), z.number().int().min(0).max(1000)),
  /** Titles used recently, so the AI avoids repeating them. */
  recentTitles: z.array(z.string().max(40)).max(5),
});
export type MissionRequest = z.infer<typeof missionRequestSchema>;
