/**
 * MERA's world: a soft sky that follows the time of day, drifting clouds, a sun
 * glow, and rolling hills with grass. Pure SVG/CSS, decorative (aria-hidden),
 * and still when motion is reduced.
 */
import type { CSSProperties } from "react";

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

/** Full-bleed sky. `calm` (0–1) veils it with fog — the deeper into a reset, the quieter. */
export function Sky({ calm = 0, sun = true, className }: { calm?: number; sun?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 48%, var(--sky-low) 100%)" }} />
      {sun && (
        <div
          className="absolute -top-24 right-[-6rem] size-[26rem] rounded-full"
          style={{ background: "radial-gradient(circle, var(--sun) 0%, var(--sun-glow) 28%, transparent 66%)" }}
        />
      )}
      <div className="absolute top-[14%] left-[-12%] h-16 w-72 animate-drift rounded-full bg-white/45 blur-2xl" />
      <div className="absolute top-[30%] right-[-8%] h-12 w-60 animate-drift rounded-full bg-white/35 blur-2xl [animation-delay:-6s]" />
      <div className="absolute inset-0 transition-opacity duration-[1500ms]" style={{ background: "var(--grounding)", opacity: calm }} />
    </div>
  );
}

function GrassTufts({ y, color, count = 28, seed = 1 }: { y: number; color: string; count?: number; seed?: number }) {
  const blades = [];
  for (let i = 0; i < count; i++) {
    const x = ((i * 37 + seed * 13) % 100) * 4 + ((i * 7) % 5);
    const h = 8 + ((i * 11 + seed) % 9);
    const lean = ((i * 5 + seed) % 7) - 3;
    blades.push(<path key={i} d={`M${x} ${y} q${lean} ${-h / 2} ${lean * 1.6} ${-h}`} stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />);
  }
  return (
    <g className="origin-bottom animate-sway" style={{ transformBox: "fill-box" } as CSSProperties}>
      {blades}
    </g>
  );
}

/** Rolling hills along the bottom. The near hill blends into `--background` so content can continue below. */
export function Hills({ className, height = 220, flowers = true }: { className?: string; height?: number; flowers?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="none" className={cx("pointer-events-none relative block w-full", className)} style={{ height }}>
      <path d="M0 120 C60 92 120 96 170 108 C230 122 290 84 400 98 L400 220 L0 220 Z" fill="var(--hill-far)" />
      <path d="M0 150 C70 124 140 132 210 146 C280 160 330 128 400 136 L400 220 L0 220 Z" fill="var(--hill-mid)" />
      <path d="M0 180 C90 160 170 166 240 176 C310 186 350 168 400 172 L400 220 L0 220 Z" fill="var(--hill-near)" />
      <GrassTufts y={178} color="var(--grass)" seed={3} />
      {flowers &&
        [
          [52, 172, "var(--sunrise)"],
          [118, 168, "#f3efe4"],
          [302, 179, "var(--clay)"],
          [348, 172, "#f3efe4"],
        ].map(([x, y, c], i) => (
          <g key={i}>
            <path d={`M${x} ${y} v-8`} stroke="var(--grass)" strokeWidth="1.4" />
            <circle cx={x as number} cy={(y as number) - 9} r="2.6" fill={c as string} />
          </g>
        ))}
      <rect x="0" y="206" width="400" height="14" fill="var(--background)" />
      <path d="M0 196 C120 190 280 192 400 198 L400 210 L0 210 Z" fill="var(--background)" opacity="0.5" />
    </svg>
  );
}

/** Concentric rings that breathe with MERA (scale ~0.86–1.08). */
export function BreathRings({ scale, still }: { scale: number; still?: boolean }) {
  const s = still ? 1 : scale;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[1.9, 1.55, 1.25].map((k, i) => (
        <div
          key={k}
          className="absolute rounded-full border transition-transform duration-300 ease-linear"
          style={{
            width: 190 * k,
            height: 190 * k,
            transform: `scale(${1 + (s - 1) * (2.2 - i * 0.5)})`,
            borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
            background: i === 2 ? "radial-gradient(circle, color-mix(in srgb, var(--accent-soft) 70%, transparent), transparent 70%)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** A few leaves drifting down — a quiet celebration. Hidden under reduced motion via CSS. */
export function LeafDrift() {
  const leaves = [
    { left: "12%", delay: "0s", dur: "9s", rot: -20 },
    { left: "34%", delay: "2.4s", dur: "11s", rot: 30 },
    { left: "68%", delay: "1.2s", dur: "10s", rot: -10 },
    { left: "86%", delay: "3.6s", dur: "12s", rot: 15 },
  ];
  return (
    <div aria-hidden className="leaf-drift pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes mera-fall{0%{transform:translate3d(0,-10vh,0) rotate(0)}100%{transform:translate3d(30px,105vh,0) rotate(220deg)}}@media (prefers-reduced-motion: reduce){.leaf-drift{display:none}}html[data-motion="reduced"] .leaf-drift{display:none}`}</style>
      {leaves.map((l, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          width="18"
          height="18"
          className="absolute top-0"
          style={{ left: l.left, animation: `mera-fall ${l.dur} linear ${l.delay} infinite`, rotate: `${l.rot}deg` }}
        >
          <path d="M10 2 C16 4 18 10 10 18 C2 10 4 4 10 2 Z" fill="var(--grass)" opacity="0.75" />
        </svg>
      ))}
    </div>
  );
}

/** A thin progress ring (0–1). */
export function ProgressRing({ value, size = 260, stroke = 3, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      {children}
    </div>
  );
}
