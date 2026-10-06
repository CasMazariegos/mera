/** Get started: three quick, skippable taps that personalise resets. Everything can be changed later in Privacy & AI. */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Cloud, Cpu, Clock3, Hourglass, House, Library, MessagesSquare, Timer, TreePine, type LucideIcon } from "lucide-react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Hills, Sky } from "@/components/Scenery";
import { navigate } from "@/app/router";
import { useSettings, type AiMode } from "@/store/settings";
import { useGroundMe } from "@/hooks/useGroundMe";
import type { Preferences } from "@/types";

type Option<T> = { value: T; label: string; hint: string; icon: LucideIcon; tint: string };

const OUTSIDE: Array<Option<Preferences["canGoOutside"]>> = [
  { value: "yes", label: "Usually, yes", hint: "MERA can suggest stepping outside.", icon: TreePine, tint: "var(--accent-soft)" },
  { value: "ask_each_time", label: "It depends", hint: "MERA asks before an outdoor reset.", icon: MessagesSquare, tint: "var(--sky-soft)" },
  { value: "indoor_only", label: "Indoors only", hint: "MERA keeps every reset indoors.", icon: House, tint: "var(--sand-soft)" },
];

const MINUTES: Array<Option<number>> = [
  { value: 2, label: "A couple of minutes", hint: "Short and simple.", icon: Timer, tint: "var(--sunrise-soft)" },
  { value: 5, label: "About five", hint: "Most resets fit here.", icon: Clock3, tint: "var(--accent-soft)" },
  { value: 10, label: "Up to ten", hint: "Room for a short walk.", icon: Hourglass, tint: "var(--sky-soft)" },
];

const AI: Array<Option<AiMode>> = [
  { value: "off", label: "Built-in library", hint: "No AI. Works instantly and offline.", icon: Library, tint: "var(--sand-soft)" },
  { value: "local", label: "Gemma on this device", hint: "Private. Download it later in Privacy & AI, on Wi-Fi.", icon: Cpu, tint: "var(--accent-soft)" },
  { value: "remote", label: "Connected AI", hint: "Opt-in. Gets only the feeling you tap, never your notes.", icon: Cloud, tint: "var(--sky-soft)" },
];

const STEPS = ["outside", "minutes", "ai", "ready"] as const;

export function GetStarted() {
  const s = useSettings();
  const ground = useGroundMe();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const next = () => setI((n) => Math.min(n + 1, STEPS.length - 1));
  const finish = (then?: () => void) => {
    s.set({ onboarded: true });
    navigate("/");
    then?.();
  };

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden" data-testid="get-started-page">
      <Sky calm={0.1} />
      <header className="relative mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))]">
        {i > 0 && step !== "ready" ? (
          <button
            type="button"
            onClick={() => setI(i - 1)}
            className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-medium text-ink-2 shadow-gentle"
          >
            <ArrowLeft aria-hidden className="size-4" /> Back
          </button>
        ) : (
          <span className="font-display text-h3 font-semibold tracking-[0.28em] text-ink">MERA</span>
        )}
        {step !== "ready" && (
          <button
            type="button"
            onClick={() => finish()}
            className="min-h-11 rounded-full px-3 text-small font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Skip setup
          </button>
        )}
      </header>

      <div
        className="relative mx-auto mt-6 flex w-full max-w-xl gap-2 px-6"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={i + 1}
      >
        {STEPS.map((k, n) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${n <= i ? "bg-accent" : "bg-line-strong/60"}`} />
        ))}
      </div>

      <main id="main" className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-8 pb-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === "outside" && (
              <Question
                n={1}
                title="Can you usually step outside?"
                body="Many resets are about touching grass, literally. MERA will respect this every time."
                options={OUTSIDE}
                value={s.canGoOutside}
                onPick={(v) => {
                  s.set({ canGoOutside: v });
                  next();
                }}
              />
            )}
            {step === "minutes" && (
              <Question
                n={2}
                title="How much time do you usually have?"
                body="Missions stay within this, so a reset never turns into a project."
                options={MINUTES}
                value={s.usualMinutes}
                onPick={(v) => {
                  s.set({ usualMinutes: v });
                  next();
                }}
              >
                <fieldset className="mt-6 rounded-[var(--radius-soft)] border border-line/70 bg-surface/80 p-4">
                  <legend className="px-1 text-small font-semibold text-ink">Anything MERA should avoid? (optional)</legend>
                  {(
                    [
                      ["lowMobility", "Keep it seated and gentle"],
                      ["avoidSound", "No sound-based resets"],
                      ["avoidSmell", "No smell-based resets"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--accent-strong)]"
                        checked={s[k]}
                        onChange={(e) => s.set({ [k]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </Question>
            )}
            {step === "ai" && (
              <Question
                n={3}
                title="Where should MERA’s AI run?"
                body="Gemma only picks your mission and writes a line afterwards. Every option works; you can switch any time."
                options={AI}
                value={s.aiMode}
                onPick={(v) => {
                  s.set({ aiMode: v });
                  next();
                }}
              />
            )}
            {step === "ready" && (
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  <span aria-hidden className="absolute inset-0 -m-6 rounded-full bg-sunrise-soft/70 blur-2xl" />
                  <div className="relative">
                    <MeraCharacter state="celebrating" size={130} />
                  </div>
                </motion.div>
                <h1 className="mt-6 font-display text-h1 font-medium tracking-tight text-ink">You’re all set.</h1>
                <p className="mt-3 max-w-sm text-h3 leading-snug text-balance text-ink-2">
                  Next time it all feels like too much, tap GROUND ME. I’ll take it from there.
                </p>
                <ul className="mt-8 w-full space-y-3 text-left">
                  {[
                    ["Add MERA to your Home Screen", "iPhone: Share → Add to Home Screen. Android: menu → Install app."],
                    ["Try one now, while it’s calm", "It’s easier to reach for something you’ve done before."],
                    ["Change anything later", "Privacy & AI has every switch, plus export and delete."],
                  ].map(([t, b]) => (
                    <li key={t} className="flex gap-3 rounded-[var(--radius-soft)] border border-line/70 bg-surface/90 p-4 shadow-gentle">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong"
                      >
                        <Check className="size-4" strokeWidth={2.5} />
                      </span>
                      <span>
                        <span className="block text-body font-semibold text-ink">{t}</span>
                        <span className="block text-small text-ink-2">{b}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex w-full flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => finish(ground)}
                    className="btn-primary inline-flex min-h-14 items-center justify-center rounded-full px-8 text-body font-semibold"
                    data-testid="try-reset"
                  >
                    Try a reset now
                  </button>
                  <button
                    type="button"
                    onClick={() => finish()}
                    className="glass inline-flex min-h-14 items-center justify-center rounded-full px-8 text-body font-semibold text-ink shadow-gentle"
                    data-testid="finish-setup"
                  >
                    Take me to MERA
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <Hills height={130} />
      </div>
    </div>
  );
}

function Question<T extends string | number>({
  n,
  title,
  body,
  options,
  value,
  onPick,
  children,
}: {
  n: number;
  title: string;
  body: string;
  options: Array<Option<T>>;
  value: T;
  onPick: (v: T) => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <p className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">Step {n} of 3</p>
      <h1 className="mt-2 font-display text-h1 font-medium tracking-tight text-balance text-ink">{title}</h1>
      <p className="mt-3 text-body text-ink-2">{body}</p>
      <div className="mt-6 space-y-3" role="radiogroup" aria-label={title}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.value)}
              className={`flex w-full items-center gap-4 rounded-[var(--radius-soft)] border-2 bg-surface/90 p-4 text-left shadow-gentle transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-lift ${on ? "border-accent" : "border-transparent"}`}
              data-testid={`option-${o.value}`}
            >
              <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink" style={{ background: o.tint }}>
                <o.icon className="size-6" strokeWidth={1.75} />
              </span>
              <span className="flex-1">
                <span className="block text-body font-semibold text-ink">{o.label}</span>
                <span className="block text-small text-ink-2">{o.hint}</span>
              </span>
              <span
                aria-hidden
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent bg-accent text-on-accent" : "border-line-strong"}`}
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      {children}
    </>
  );
}
