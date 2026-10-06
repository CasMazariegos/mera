/** One consistent icon language (lucide), mapped to MERA's concepts. Always decorative next to text. */
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BatteryLow,
  CloudRain,
  Ear,
  Eye,
  Flame,
  Flower2,
  Footprints,
  Hand,
  Heart,
  HelpCircle,
  House,
  Leaf,
  Minus,
  MoreHorizontal,
  Shuffle,
  Sparkles,
  Sun,
  TreePine,
  Volume2,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Emotion, Environment, MissionCategory, Outcome } from "@/types";

export const EMOTION_ICON: Record<Emotion, LucideIcon> = {
  overwhelmed: Waves,
  anxious: Zap,
  angry: Flame,
  sad: CloudRain,
  overstimulated: Volume2,
  scattered: Shuffle,
  drained: BatteryLow,
  not_sure: HelpCircle,
};

/** Soft per-feeling tints (token names), used as quiet backgrounds only. */
export const EMOTION_TINT: Record<Emotion, string> = {
  overwhelmed: "var(--sky-soft)",
  anxious: "var(--sand-soft)",
  angry: "var(--clay-soft)",
  sad: "var(--sky-soft)",
  overstimulated: "var(--sunrise-soft)",
  scattered: "var(--accent-soft)",
  drained: "var(--sand-soft)",
  not_sure: "var(--surface-sunk)",
};

export const CATEGORY_ICON: Record<MissionCategory, LucideIcon> = { nature: Leaf, movement: Footprints, sensory: Wind, indoor: House };
export const CATEGORY_LABEL: Record<MissionCategory, string> = { nature: "Nature", movement: "Movement", sensory: "Senses", indoor: "Indoors" };
export const CATEGORY_TINT: Record<MissionCategory, string> = {
  nature: "var(--accent-soft)",
  movement: "var(--sunrise-soft)",
  sensory: "var(--sky-soft)",
  indoor: "var(--sand-soft)",
};

export const ENVIRONMENT_ICON: Record<Environment, LucideIcon> = { outdoor: TreePine, indoor: House, either: Sun };
export const ENVIRONMENT_LABEL: Record<Environment, string> = { outdoor: "Outdoors", indoor: "Indoors", either: "Anywhere" };

export const SENSE_ICON = { see: Eye, feel: Hand, hear: Ear, smell: Flower2, appreciate: Heart } as const;

export const OUTCOME_ICON: Record<Outcome, LucideIcon> = { better: ArrowUp, same: Minus, worse: ArrowDown, other: MoreHorizontal };

export { ArrowRight, Sparkles };
