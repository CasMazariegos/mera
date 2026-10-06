/** GROUND ME — the most important control in MERA. One tap from anywhere. */
import { useGroundMe } from "@/hooks/useGroundMe";

export function GroundMeButton() {
  const start = useGroundMe();
  return (
    <button
      type="button"
      onClick={start}
      className="group relative inline-flex min-h-24 w-full items-center justify-center rounded-full bg-accent px-8 font-display text-h2 font-semibold tracking-[0.18em] text-on-accent shadow-meep transition-[transform,filter] duration-500 ease-[var(--ease-calm)] hover:brightness-110 active:scale-[0.985]"
      data-testid="ground-me"
    >
      <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-accent opacity-25 blur-xl transition-opacity duration-700 group-hover:opacity-40" />
      GROUND ME
    </button>
  );
}

/** Persistent quick access on every other screen. */
export function GroundMeFab() {
  const start = useGroundMe();
  return (
    <button
      type="button"
      onClick={start}
      className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-14 items-center gap-2 rounded-full bg-accent px-6 text-small font-bold tracking-[0.16em] text-on-accent shadow-meep hover:brightness-110"
      data-testid="ground-me-fab"
    >
      GROUND ME
    </button>
  );
}
