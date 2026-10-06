/**
 * MERA — a quiet Meep. Canonical anatomy: one soft rounded body, two black oval
 * eyes, two cheeks, a tiny mouth, two fingerless arms, two feet, and one sprout
 * with exactly two leaves. Restrained states; motion is slow and optional.
 */
import { motion, useReducedMotion } from "motion/react";

export type MeraState = "resting" | "listening" | "breathing" | "grounding" | "thinking" | "walking" | "waiting" | "returning" | "celebrating";

export function MeraCharacter({
  state = "resting",
  size = 160,
  scale = 1,
  label,
  className,
  still = false,
}: {
  state?: MeraState;
  size?: number;
  /** Externally driven body scale (breathing). */
  scale?: number;
  /** Accessible description; omit to make MERA decorative. */
  label?: string;
  className?: string;
  /** Force no idle motion (quiet mode). */
  still?: boolean;
}) {
  const reduce = useReducedMotion() || still;
  const eyesClosed = state === "resting" || state === "grounding";
  const lookUp = state === "thinking";
  const armUp = state === "returning" || state === "celebrating";
  const settle = state === "grounding" || state === "waiting" ? 6 : 0;

  return (
    <motion.svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      initial={false}
      animate={reduce ? { y: settle } : { y: [settle, settle - 2, settle] }}
      transition={reduce ? { duration: 0.6 } : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
      style={{ overflow: "visible" }}
    >
      <ellipse cx="60" cy="134" rx={30 * scale} ry="4" fill="var(--meep-ink)" opacity="0.08" />
      <motion.g
        initial={false}
        animate={{ scale }}
        transition={{ duration: reduce ? 0 : 0.35, ease: "linear" }}
        style={{ transformOrigin: "60px 128px", transformBox: "view-box" }}
      >
        {/* sprout: one stem, exactly two leaves */}
        <motion.g
          initial={false}
          animate={reduce || state === "resting" ? { rotate: 0 } : { rotate: [-2, 2, -2] }}
          transition={{ duration: 7, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "60px 34px", transformBox: "view-box" }}
        >
          <path d="M60 36 C60 28 60 22 61 16" stroke="var(--meep-sprout)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M61 18 C52 10 44 12 42 16 C48 22 56 22 61 18 Z" fill="var(--meep-sprout)" />
          <path d="M61 18 C68 9 77 9 80 13 C75 20 67 21 61 18 Z" fill="var(--meep-sprout)" />
        </motion.g>

        {/* arms (fingerless) */}
        <path d="M24 82 C14 86 12 94 16 98" stroke="var(--meep-body-shade)" strokeWidth="9" strokeLinecap="round" fill="none" />
        <motion.path
          initial={false}
          animate={{ d: armUp ? "M96 78 C106 70 108 60 104 54" : "M96 82 C106 86 108 94 104 98" }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 0.61, 0.36, 1] }}
          stroke="var(--meep-body-shade)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />

        {/* feet */}
        <motion.ellipse
          cx="46"
          cy="126"
          rx="11"
          ry="6"
          fill="var(--meep-body-shade)"
          animate={state === "walking" && !reduce ? { cy: [126, 123, 126] } : { cy: 126 }}
          transition={{ duration: 1.4, repeat: state === "walking" && !reduce ? Infinity : 0 }}
        />
        <motion.ellipse
          cx="74"
          cy="126"
          rx="11"
          ry="6"
          fill="var(--meep-body-shade)"
          animate={state === "walking" && !reduce ? { cy: [126, 126, 123, 126] } : { cy: 126 }}
          transition={{ duration: 1.4, repeat: state === "walking" && !reduce ? Infinity : 0 }}
        />

        {/* body */}
        <path d="M60 34 C88 34 102 58 102 86 C102 112 84 126 60 126 C36 126 18 112 18 86 C18 58 32 34 60 34 Z" fill="var(--meep-body)" />
        <path
          d="M30 98 C38 114 50 120 60 120 C72 120 84 114 92 100 C86 118 74 124 60 124 C44 124 34 116 30 98 Z"
          fill="var(--meep-body-shade)"
          opacity="0.55"
        />

        {/* face */}
        {eyesClosed ? (
          <>
            <path d="M43 78 Q48 82 53 78" stroke="var(--meep-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M67 78 Q72 82 77 78" stroke="var(--meep-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx="48" cy={lookUp ? 74 : 78} rx="4" ry="5.6" fill="var(--meep-ink)" />
            <ellipse cx="72" cy={lookUp ? 74 : 78} rx="4" ry="5.6" fill="var(--meep-ink)" />
          </>
        )}
        <ellipse cx="38" cy="90" rx="6" ry="3.6" fill="var(--meep-cheek)" opacity="0.75" />
        <ellipse cx="82" cy="90" rx="6" ry="3.6" fill="var(--meep-cheek)" opacity="0.75" />
        <path
          d={state === "celebrating" || state === "returning" ? "M55 91 Q60 95 65 91" : "M56 91 Q60 93 64 91"}
          stroke="var(--meep-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </motion.g>
    </motion.svg>
  );
}
