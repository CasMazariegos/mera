/** Welcome: what MERA is, how a reset works, how the AI and your data behave, and how to get started. */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Cloud,
  Cpu,
  Download,
  Ear,
  EyeOff,
  Footprints,
  HeartHandshake,
  Library,
  Lock,
  MousePointerClick,
  PenLine,
  ShieldCheck,
  Smartphone,
  Sprout,
  TimerOff,
  UserX,
  WifiOff,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { MeraCharacter } from "@/components/MeraCharacter";
import { Hills, Sky } from "@/components/Scenery";
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_TINT, ENVIRONMENT_ICON, ENVIRONMENT_LABEL } from "@/components/icons";
import { href } from "@/app/router";
import { GroundMeButton } from "@/components/GroundMe";
import { useSettings } from "@/store/settings";
import { LIBRARY } from "@/features/missions/library";

const rise = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
};

const STEPS: Array<{ icon: LucideIcon; title: string; body: string; time: string }> = [
  { icon: MousePointerClick, title: "Tap GROUND ME", body: "One big button, on every screen. No menus when you’re overwhelmed.", time: "1 tap" },
  { icon: Footprints, title: "Feet on the ground", body: "MERA asks for one tiny thing: notice where you are.", time: "10 sec" },
  { icon: Wind, title: "Breathe together", body: "In 4, hold 2, out 6. MERA breathes with you, with words, not just motion.", time: "~1 min" },
  { icon: Ear, title: "5-4-3-2-1", body: "See, feel, hear, smell, appreciate. A classic way back into your senses.", time: "~1 min" },
  { icon: HeartHandshake, title: "Name it", body: "One tap: overwhelmed, anxious, drained… No typing, no explaining.", time: "1 tap" },
  { icon: Sprout, title: "One real-world mission", body: "A small thing to do away from the screen, picked for how you feel.", time: "2–10 min" },
  { icon: TimerOff, title: "Put me away", body: "MERA tells you to put the phone down. It waits quietly, it doesn’t ping you.", time: "phone down" },
  { icon: PenLine, title: "Come back", body: "Better, same or worse? Leave a note if you want. MERA remembers what helps.", time: "optional" },
];

const SAMPLE_IDS = ["nature-greens-001", "nature-sky-002"];
const samples = [
  ...LIBRARY.filter((m) => SAMPLE_IDS.includes(m.id)).slice(0, 1),
  ...(["movement", "sensory", "indoor"] as const).map((c) => LIBRARY.find((m) => m.category === c)).filter((m) => !!m),
];

const FAQ: Array<[string, string]> = [
  [
    "Is MERA therapy?",
    "No. MERA is a grounding and wellness tool. It isn’t therapy, diagnosis or treatment, and it isn’t a crisis service. If you’re in danger, contact local emergency services or a crisis line where you live.",
  ],
  [
    "Do I need an account?",
    "No. There’s no sign-up. Everything you do is saved in this browser on this device, and you can export or delete it all in Privacy & AI.",
  ],
  ["Does it work offline?", "Yes, once it has loaded. Resets come from MERA’s built-in library of real-world missions, which needs no internet."],
  [
    "What does the AI actually do?",
    "Gemma, an open-weight model, picks one mission from how you feel and what helped before, and writes a sentence or two afterwards. Every answer is checked; if anything looks off, MERA uses its library instead.",
  ],
  ["Will it send me notifications or streaks?", "No. MERA is built to get you off your phone. No streaks, no badges, no nudges to come back."],
  ["What if I can’t go outside?", "Tell MERA in setup. It can stick to indoor resets, gentler seated ones, or skip sound- and smell-based ones."],
];

export function Welcome() {
  const setOnboarded = () => useSettings.getState().set({ onboarded: true });
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden" data-testid="welcome">
      {/* Hero */}
      <section className="relative isolate">
        <Sky />
        <div className="relative mx-auto w-full max-w-5xl px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <header className="flex items-center justify-between">
            <p className="font-display text-h3 font-semibold tracking-[0.28em] text-ink">MERA</p>
            <a
              href={href("/start")}
              className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-semibold text-ink shadow-gentle"
            >
              Get started <ArrowRight aria-hidden className="size-4" />
            </a>
          </header>
          <main id="main" className="grid items-center gap-8 pt-10 pb-4 md:grid-cols-[1.1fr_1fr] md:pt-16">
            <div className="text-center md:text-left">
              <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-surface/70 px-3 py-1.5 text-micro font-semibold tracking-[0.14em] text-ink-2 uppercase shadow-gentle">
                <Sprout aria-hidden className="size-3.5 text-accent-strong" /> Meep Emotional Reset Assistant
              </p>
              <h1 className="mt-5 animate-rise font-display text-h1 font-medium tracking-tight text-balance text-ink [animation-delay:80ms] sm:text-display">
                Come back to <em className="font-normal text-accent-strong">yourself.</em>
              </h1>
              {/* The first thing to press is the thing MERA is for. Everything else can wait. */}
              <div className="mt-8 animate-rise [animation-delay:160ms]">
                <GroundMeButton onPress={() => setOnboarded()} />
              </div>
              <p className="mt-5 animate-rise text-body text-ink-2 [animation-delay:200ms]">For when everything feels like too much.</p>
              <p className="mt-1 animate-rise text-small text-muted [animation-delay:200ms]">Ground here. Then go be somewhere else.</p>
              <p className="mt-6 flex animate-rise flex-wrap items-center justify-center gap-x-2 text-small [animation-delay:240ms] md:justify-start">
                <a
                  href={href("/start")}
                  className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent-strong hover:underline"
                  data-testid="get-started"
                >
                  New here? Set up in 3 taps <ArrowRight aria-hidden className="size-4" />
                </a>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => document.getElementById("idea")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex min-h-11 items-center font-medium text-ink-2 hover:text-ink"
                >
                  How it works
                </button>
              </p>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-small text-ink-2 md:justify-start">
                {[
                  [UserX, "No account"],
                  [WifiOff, "Works offline"],
                  [Lock, "History stays on your device"],
                ].map(([Icon, t]) => {
                  const I = Icon as LucideIcon;
                  return (
                    <li key={t as string} className="inline-flex items-center gap-1.5">
                      <I aria-hidden className="size-4 text-accent-strong" /> {t as string}
                    </li>
                  );
                })}
              </ul>
            </div>
            <HeroPreview />
          </main>
        </div>
        <Hills height={150} />
      </section>

      <div className="relative mx-auto w-full max-w-5xl px-6">
        {/* The idea */}
        <motion.section {...rise} aria-labelledby="idea" className="mx-auto max-w-2xl pt-10 text-center">
          <h2 id="idea" className="font-display text-h2 font-medium text-balance text-ink">
            Most wellness apps want more of your screen time. <em className="text-accent-strong">MERA wants less.</em>
          </h2>
          <p className="mt-4 text-body text-ink-2">
            It helps you ground yourself in a couple of minutes, hands you one real-world thing to do, then asks you to put the phone down. Success is you
            closing the app.
          </p>
        </motion.section>

        {/* Three pillars */}
        <section aria-label="What MERA does" className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Wind,
              title: "Ground",
              body: "Breathing and the 5-4-3-2-1 senses, paced gently, in big words you can follow when your head is loud.",
              tint: "var(--sky-soft)",
            },
            {
              icon: Footprints,
              title: "Go",
              body: "One small mission: find three greens, feel the air, walk to the corner. Then the phone goes away.",
              tint: "var(--accent-soft)",
            },
            {
              icon: Sprout,
              title: "Notice",
              body: "After a few resets, MERA quietly shows what tends to help you, and leans that way next time.",
              tint: "var(--sunrise-soft)",
            },
          ].map((p, i) => (
            <motion.article
              key={p.title}
              {...rise}
              transition={{ ...rise.transition, delay: i * 0.08 }}
              className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 shadow-gentle"
            >
              <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-2xl text-ink" style={{ background: p.tint }}>
                <p.icon className="size-6" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 font-display text-h2 font-medium text-ink">{p.title}</h3>
              <p className="mt-2 text-body text-ink-2">{p.body}</p>
            </motion.article>
          ))}
        </section>

        {/* How a reset works */}
        <section aria-labelledby="how" className="mt-16 grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-start">
          <motion.div {...rise} className="md:sticky md:top-10">
            <p className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">How a reset works</p>
            <h2 id="how" className="mt-2 font-display text-h1 font-medium tracking-tight text-balance text-ink">
              About five minutes. <br />
              Most of it without me.
            </h2>
            <p className="mt-4 text-body text-ink-2">
              You can skip ahead or leave at any moment. The words carry the timing, so it works with motion turned off too.
            </p>
            <div className="mt-8 hidden justify-center md:flex">
              <MeraCharacter state="walking" size={130} />
            </div>
          </motion.div>
          <ol className="relative">
            <span
              aria-hidden
              className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 rounded-full bg-gradient-to-b from-accent/50 via-line-strong to-accent/40"
            />
            {STEPS.map((s, i) => (
              <motion.li key={s.title} {...rise} transition={{ ...rise.transition, delay: 0.04 * i }} className="relative flex gap-4 pb-4">
                <span
                  aria-hidden
                  className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full border-4 border-bg bg-accent-soft text-ink shadow-gentle"
                >
                  <s.icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="flex-1 rounded-[var(--radius-soft)] border border-line/70 bg-surface p-4 shadow-gentle">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-body font-semibold text-ink">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <span className="shrink-0 rounded-full bg-surface-sunk px-2.5 py-0.5 text-micro font-semibold text-ink-2">{s.time}</span>
                  </div>
                  <p className="mt-1 text-small text-ink-2">{s.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Missions */}
        <section aria-labelledby="missions" className="mt-16">
          <motion.div {...rise} className="max-w-2xl">
            <p className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">Real-world missions</p>
            <h2 id="missions" className="mt-2 font-display text-h1 font-medium tracking-tight text-ink">
              Small enough to actually do.
            </h2>
            <p className="mt-3 text-body text-ink-2">
              {LIBRARY.length} built-in resets across nature, movement, senses and indoors. They respect what you told MERA: indoor-only, low mobility, no
              sound, no smell.
            </p>
          </motion.div>
          <div
            className="-mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0"
            tabIndex={0}
            aria-label="Example missions"
          >
            {samples.map((m, i) => (
              <motion.div key={m.id} {...rise} transition={{ ...rise.transition, delay: 0.06 * i }} className="w-64 shrink-0 snap-start md:w-auto">
                <MiniTicket title={m.title} instruction={m.instruction} category={m.category} environment={m.environment} minutes={m.durationMinutes} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* AI */}
        <section aria-labelledby="ai" className="mt-14 overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-gentle">
          <div className="page-hero px-6 py-8 md:px-10">
            <p className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">Gemma, honestly</p>
            <h2 id="ai" className="mt-2 font-display text-h1 font-medium tracking-tight text-balance text-ink">
              AI that shortens the screen time.
            </h2>
            <p className="mt-3 max-w-2xl text-body text-ink-2">
              MERA uses Gemma, an open-weight model, to pick your mission and write one or two sentences afterwards. Nothing more. You choose where it runs, and
              MERA always tells you which one is on.
            </p>
          </div>
          <div className="grid gap-px bg-line/60 md:grid-cols-3">
            <AiMode
              tint="var(--sand-soft)"
              icon={Library}
              label="OFFLINE RESET"
              title="Built-in library"
              body="No AI at all. Hand-written missions chosen by simple rules. Works instantly, offline, on any phone."
            />
            <AiMode
              tint="var(--accent-soft)"
              icon={Cpu}
              label="LOCAL AI"
              title="On this device"
              body="Gemma runs inside your browser after a one-time download on Wi-Fi. Your words never leave the phone."
            />
            <AiMode
              tint="var(--sky-soft)"
              icon={Cloud}
              label="CONNECTED AI"
              title="Connected (opt-in)"
              body="Gemma on MERA’s server. It only gets the feeling you tapped and your preferences. Never your journal or location."
            />
          </div>
        </section>

        {/* Install + honest */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <motion.article {...rise} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 shadow-gentle">
            <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-2xl bg-sky-soft text-ink">
              <Smartphone className="size-6" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-display text-h2 font-medium text-ink">Keep it one tap away</h2>
            <p className="mt-2 text-body text-ink-2">MERA is a web app you can add to your Home Screen, so GROUND ME is there when you need it.</p>
            <ul className="mt-4 space-y-2 text-small text-ink">
              <li className="flex gap-2">
                <Download aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-strong" /> iPhone: Share → Add to Home Screen
              </li>
              <li className="flex gap-2">
                <Download aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-strong" /> Android: menu → Install app
              </li>
            </ul>
          </motion.article>
          <motion.article {...rise} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 shadow-gentle">
            <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-ink">
              <ShieldCheck className="size-6" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-display text-h2 font-medium text-ink">Honest by design</h2>
            <ul className="mt-4 space-y-2.5 text-small text-ink">
              {[
                [EyeOff, "No tracking, no ads, no analytics."],
                [TimerOff, "No streaks, badges or come-back notifications."],
                [Lock, "Notes and voice memos are saved only in this browser."],
                [ShieldCheck, "Export or delete everything, any time."],
              ].map(([Icon, t]) => {
                const I = Icon as LucideIcon;
                return (
                  <li key={t as string} className="flex gap-2">
                    <I aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-strong" /> {t as string}
                  </li>
                );
              })}
            </ul>
          </motion.article>
        </section>

        {/* Get started */}
        <motion.section {...rise} aria-labelledby="start" className="mt-14">
          <p className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">Getting started</p>
          <h2 id="start" className="mt-2 font-display text-h1 font-medium tracking-tight text-ink">
            Ready in under a minute.
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Tell MERA a little", "Can you usually step outside? How much time do you tend to have? Three quick taps."],
              ["Choose your AI", "Built-in library, Gemma on your device, or Connected AI. Change it any time."],
              ["Keep GROUND ME close", "Add MERA to your Home Screen. Next time it’s too much, tap once."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 shadow-gentle">
                <span aria-hidden className="btn-primary inline-flex size-10 items-center justify-center rounded-full font-display text-h3">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-h3 font-semibold text-ink">{t}</h3>
                <p className="mt-1 text-body text-ink-2">{b}</p>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mx-auto mt-16 max-w-2xl">
          <h2 id="faq" className="font-display text-h1 font-medium tracking-tight text-ink">
            Questions
          </h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-[var(--radius-soft)] border border-line/70 bg-surface px-5 py-2 shadow-gentle">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-body font-semibold text-ink">
                  {q}
                  <span
                    aria-hidden
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-h3 transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-3 text-body text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <motion.section {...rise} className="relative mt-16 overflow-hidden rounded-[var(--radius-card)] shadow-lift">
          <div className="btn-primary flex flex-col items-center gap-5 px-6 py-10 text-center md:flex-row md:px-10 md:text-left">
            <div className="rounded-full bg-white/15 p-3">
              <MeraCharacter state="resting" size={84} still />
            </div>
            <div className="flex-1">
              <p className="font-display text-h1 font-medium">Come back to yourself.</p>
              <p className="mt-1 text-body opacity-85">Free. No account. Ready when you are.</p>
            </div>
            <a
              href={href("/start")}
              className="inline-flex min-h-14 items-center gap-2 rounded-full bg-surface px-7 text-body font-semibold text-ink shadow-gentle"
            >
              Get started <ArrowRight aria-hidden className="size-5" />
            </a>
          </div>
        </motion.section>

        <footer className="py-10 text-center text-micro text-muted">
          <p>MERA is a grounding tool, not therapy or a crisis service.</p>
          <p className="mt-2">
            <a className="underline underline-offset-4 hover:text-ink" href={href("/about")}>
              About MERA
            </a>{" "}
            · by Cass - NextRealm Interactive
          </p>
        </footer>
      </div>
    </div>
  );
}

/** A non-interactive illustration of the reset, in the app's own visual language. */
function HeroPreview() {
  const m = LIBRARY[0];
  return (
    <motion.figure
      initial={{ opacity: 0, y: 30, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-sm"
      aria-label="Illustration: a MERA reset"
    >
      <div aria-hidden className="relative z-10 -mb-5 flex justify-end pr-8">
        <MeraCharacter state="listening" size={104} />
      </div>
      <div aria-hidden className="glass rounded-[2.25rem] p-3 shadow-lift">
        <div className="rounded-[1.75rem] bg-bg/80 p-4">
          <div className="flex items-center justify-between text-micro font-semibold tracking-[0.14em] text-ink-2 uppercase">
            <span>Your reset</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent" /> Example
            </span>
          </div>
          <div className="mt-3">
            <MiniTicket title={m.title} instruction={m.instruction} category={m.category} environment={m.environment} minutes={m.durationMinutes} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-small font-semibold">
            <span className="btn-primary rounded-full py-3">I’m going</span>
            <span className="rounded-full bg-surface py-3 text-ink-2">Something else</span>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">An example mission card, as it appears during a reset.</figcaption>
    </motion.figure>
  );
}

function MiniTicket({
  title,
  instruction,
  category,
  environment,
  minutes,
}: {
  title: string;
  instruction: string;
  category: keyof typeof CATEGORY_ICON;
  environment: keyof typeof ENVIRONMENT_ICON;
  minutes: number;
}) {
  const Cat = CATEGORY_ICON[category];
  const Env = ENVIRONMENT_ICON[environment];
  return (
    <article className="h-full overflow-hidden rounded-[var(--radius-soft)] border border-line/70 bg-surface text-left shadow-gentle">
      <div className="flex items-center justify-between px-4 py-3" style={{ background: CATEGORY_TINT[category] }}>
        <span className="inline-flex items-center gap-1.5 text-small font-semibold text-ink">
          <Cat aria-hidden className="size-4" strokeWidth={1.75} /> {CATEGORY_LABEL[category]}
        </span>
        <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-micro font-semibold text-ink tabular">{minutes} min</span>
      </div>
      <div className="border-t-2 border-dashed border-line px-4 pt-3 pb-4">
        <h3 className="font-display text-h3 font-medium text-ink">{title}</h3>
        <p className="mt-1 text-small text-ink-2">{instruction}</p>
        <p className="mt-3 inline-flex items-center gap-1 text-micro font-semibold text-ink-2">
          <Env aria-hidden className="size-3.5" /> {ENVIRONMENT_LABEL[environment]}
        </p>
      </div>
    </article>
  );
}

function AiMode({ icon: Icon, label, title, body, tint }: { icon: LucideIcon; label: string; title: string; body: ReactNode; tint: string }) {
  return (
    <motion.div {...rise} className="bg-surface p-6">
      <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-2xl text-ink" style={{ background: tint }}>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-micro font-semibold tracking-[0.14em] text-accent-strong">{label}</p>
      <h3 className="mt-1 text-h3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-small text-ink-2">{body}</p>
    </motion.div>
  );
}
