/** Shared domain types for MERA. */

export const EMOTIONS = ["overwhelmed", "anxious", "angry", "sad", "overstimulated", "scattered", "drained", "not_sure"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_LABEL: Record<Emotion, string> = {
  overwhelmed: "Overwhelmed",
  anxious: "Anxious",
  angry: "Angry",
  sad: "Sad",
  overstimulated: "Overstimulated",
  scattered: "Scattered",
  drained: "Drained",
  not_sure: "Not sure",
};

export const CATEGORIES = ["nature", "movement", "sensory", "indoor"] as const;
export type MissionCategory = (typeof CATEGORIES)[number];

export const ENVIRONMENTS = ["outdoor", "indoor", "either"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export type Outcome = "better" | "same" | "worse" | "other";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  better: "Better",
  same: "About the same",
  worse: "Worse",
  other: "Something else",
};

/** Where a mission came from — shown honestly in the UI and stored with the reset. */
export type MissionSource = "local-gemma" | "remote-gemma" | "library";

export interface Mission {
  title: string;
  durationMinutes: number;
  category: MissionCategory;
  environment: Environment;
  instruction: string;
  secondaryInstruction?: string;
}

export interface GeneratedMission extends Mission {
  source: MissionSource;
  /** Library id when the mission came from (or fell back to) the library. */
  libraryId?: string;
  /** "Why this reset?" in one sentence, based only on this person's own history. */
  reason?: string;
  /** The personalization signal ids the reason is based on. */
  signals?: string[];
}

/** The person's own preferences that shape missions. All local. */
export interface Preferences {
  /** "indoor" means never suggest going outside. */
  canGoOutside: "yes" | "indoor_only" | "ask_each_time";
  /** Minutes the person usually has; missions stay within 2–10. */
  usualMinutes: number;
  /** Prefer gentle, low-mobility missions (seated, no walking). */
  lowMobility: boolean;
  /** Avoid suggestions that involve sound (e.g. hard of hearing) or smell. */
  avoidSound: boolean;
  avoidSmell: boolean;
}

export interface ResetRecord {
  id: string;
  startedAt: number;
  emotion: Emotion | null;
  mission: GeneratedMission | null;
  /** Seconds actually away from the screen ("back in the world"). */
  phoneDownSeconds: number;
  /** Planned phone-down length in seconds. */
  plannedSeconds?: number;
  /** True if the timer ran its course, false if ended early. */
  timerCompleted?: boolean;
  /** Quick ("I'm ready to step away") or full grounding. */
  path?: "quick" | "full";
  outcome: Outcome | null;
  /** Whether the person chose "something quieter" for this reset. */
  quiet: boolean;
  /** Local hour 0–23 when the reset started (used for "you tend to use MERA in the evening"). */
  hour: number;
  completedAt: number | null;
  reflectionId?: string;
  /** Short non-clinical AI or template summary shown after the reflection. */
  insight?: string;
  demo?: boolean;
}

export interface JournalEntry {
  id: string;
  createdAt: number;
  kind: "text" | "voice";
  text?: string;
  /** Voice notes are stored as audio on this device; they are not transcribed or analyzed. */
  audio?: Blob;
  audioMime?: string;
  durationSeconds?: number;
  mood?: Emotion;
  outcome?: Outcome;
  resetId?: string;
  missionTitle?: string;
  photo?: Blob;
  photoMime?: string;
  demo?: boolean;
}

export interface CheckIn {
  id: string;
  createdAt: number;
  emotion: Emotion;
  /** 1 (heavy) – 5 (light). */
  level: number;
}
