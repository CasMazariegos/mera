/** GROUND ME — the most important control in MERA. One tap from anywhere. */
import { useGroundMe } from "@/hooks/useGroundMe";

export function GroundMeButton({ onPress }: { onPress?: () => void } = {}) {
  const ground = useGroundMe();
  const start = () => {
    onPress?.();
    ground();
  };
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Two slow halos, breathing out from the button. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 animate-halo rounded-full border-2 border-accent/40" />
      <span aria-hidden className="pointer-events-none absolute inset-0 animate-halo rounded-full border-2 border-accent/30 [animation-delay:3s]" />
      <button
        type="button"
        onClick={start}
        className="relative inline-flex min-h-24 w-full items-center justify-center overflow-hidden rounded-full px-8 font-display text-h2 font-semibold tracking-[0.2em] text-on-accent shadow-lift transition-[transform,filter] duration-500 ease-[var(--ease-calm)] hover:brightness-[1.06] active:scale-[0.985]"
        style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--accent) 82%, white) 0%, var(--accent) 45%, var(--accent-strong) 100%)" }}
        data-testid="ground-me"
      >
        <span aria-hidden className="absolute inset-x-8 top-0 h-1/2 rounded-b-full bg-white/12 blur-md" />
        <span className="relative">GROUND ME</span>
      </button>
    </div>
  );
}

/** Persistent quick access on every other screen. */
export function GroundMeFab() {
  const start = useGroundMe();
  return (
    <button
      type="button"
      onClick={start}
      className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-14 items-center gap-2 rounded-full px-6 text-small font-bold tracking-[0.16em] text-on-accent shadow-lift hover:brightness-[1.06]"
      style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--accent) 82%, white), var(--accent-strong))" }}
      data-testid="ground-me-fab"
    >
      <span aria-hidden className="size-2 rounded-full bg-on-accent/80" />
      GROUND ME
    </button>
  );
}
