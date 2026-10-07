/** About: the idea, why Gemma, a live look at what Gemma receives, and where MERA runs. */
import { useState } from "react";
import { Leaf, Play } from "lucide-react";
import { Button, Page } from "@/components/ui";
import { MeraCharacter } from "@/components/MeraCharacter";
import { meraAI } from "@/ai";
import { statusLabel } from "@/ai/mera-ai";
import { signalText } from "@/features/missions/signals";
import { missionRequestFor } from "@/features/missions/request";
import { useSettings } from "@/store/settings";
import { useAiStatus } from "@/hooks/useAiStatus";
import { EMOTIONS, EMOTION_LABEL, type Emotion, type GeneratedMission } from "@/types";
import type { MissionRequest } from "@/ai/schemas/mission";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-micro font-semibold tracking-[0.14em] text-accent-strong uppercase">{title}</h2>
      <div className="mt-3 space-y-3 text-body text-ink">{children}</div>
    </section>
  );
}

const MODES = [
  ["LOCAL AI", "Local Gemma", "Mission personalization runs on this device. Nothing about your resets leaves it."],
  [
    "CONNECTED AI",
    "Connected Gemma",
    "Mission personalization uses MERA’s configured AI service. It receives the feeling you tapped, your reset settings and short facts like “walking helped twice”. Never notes, voice, photos or location.",
  ],
  ["OFFLINE RESET", "Offline reset", "MERA uses its built-in, safety-checked mission library, still personalized by simple rules from your history."],
] as const;

export function AboutPage() {
  const prefs = useSettings();
  const status = useAiStatus();
  const [emotion, setEmotion] = useState<Emotion>("overstimulated");
  const [req, setReq] = useState<MissionRequest | null>(null);
  const [out, setOut] = useState<GeneratedMission | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setOut(null);
    const r = await missionRequestFor(emotion, { ...prefs, canGoOutside: prefs.canGoOutside === "ask_each_time" ? "yes" : prefs.canGoOutside });
    setReq(r);
    setOut(await meraAI.generateResetMission(r));
    setBusy(false);
  }

  return (
    <Page
      icon={Leaf}
      eyebrow="Meep Emotional Reset Assistant"
      title="MERA"
      intro="Come back to yourself. A grounding companion for the moments that feel like too much."
    >
      <div className="flex items-center gap-4">
        <MeraCharacter state="resting" size={72} still />
        <p className="text-small text-ink-2">Built for Hacktoberfest 2026, Week 1: Touch Grass. By Cass - NextRealm Interactive.</p>
      </div>

      <section className="mt-10 rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 text-center shadow-gentle">
        <p className="font-display text-h2 text-ink-2">Most apps measure how long you stay.</p>
        <p className="mt-1 font-display text-h1 font-medium text-ink">
          MERA measures how quickly <em className="text-accent-strong">you can leave.</em>
        </p>
        <p className="mt-4 text-body text-ink-2">
          MERA uses open-weight AI to work out what kind of reset may help, gives you one real-world action, and gets out of the way. The AI is brief on
          purpose. The phone-down screen is boring on purpose. The part that matters happens away from the app.
        </p>
      </section>

      <Block title="Why Gemma">
        <ol className="space-y-2.5">
          {[
            [
              "Personal missions.",
              "Gemma builds your mission from what has actually helped you before: which kinds of resets, which activities, what helped last time you felt this way.",
            ],
            ["Short reflections.", "After a reset, Gemma writes one or two sentences from how it went (and your note, only if you allow it)."],
            [
              "Gentle patterns.",
              "Gemma rephrases observations MERA counts on your device, like “walking helped in 3 of your last 4 resets”. Every number is checked.",
            ],
            ["Private by design.", "Gemma is open-weight, so it can run inside your browser. Your history never has to leave the phone."],
            ["Never broken.", "If Gemma is unavailable, slow or gives an answer that fails MERA’s checks, the built-in library takes over."],
          ].map(([b, t], i) => (
            <li key={b} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold text-accent-strong"
              >
                {i + 1}
              </span>
              <span>
                <strong className="font-semibold">{b}</strong> {t}
              </span>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="AI where it helps, plain code where it must">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-soft)] bg-accent-soft/40 p-4">
            <p className="text-small font-semibold text-ink">Gemma</p>
            <ul className="mt-1.5 space-y-1 text-small text-ink-2">
              <li>Personalizes the reset mission from your own history</li>
              <li>Personalizes the Daily reset the same way</li>
              <li>Writes the short reflection after a reset</li>
              <li>Rephrases observations in My Patterns</li>
            </ul>
          </div>
          <div className="rounded-[var(--radius-soft)] bg-surface-sunk/70 p-4">
            <p className="text-small font-semibold text-ink">Deterministic code</p>
            <ul className="mt-1.5 space-y-1 text-small text-ink-2">
              <li>The grounding sequence, breathing and 5-4-3-2-1</li>
              <li>The phone-down timer and time back in the world</li>
              <li>Safety rules and every check on Gemma’s answers</li>
              <li>The offline mission library and its fallback choice</li>
              <li>Counting the patterns (Gemma never invents a number)</li>
            </ul>
          </div>
        </div>
      </Block>

      <Block title="See what Gemma receives">
        <p className="text-small text-ink-2">
          This runs the real mission request from your history on this device. You see the structured input and the checked output, never hidden model text.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-small text-ink-2">
            Feeling
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value as Emotion)}
              className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-body text-ink"
            >
              {EMOTIONS.map((e) => (
                <option key={e} value={e}>
                  {EMOTION_LABEL[e]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="quiet" onClick={() => void run()} disabled={busy} data-testid="gemma-demo">
            <Play aria-hidden className="mr-1.5 size-4" /> {busy ? "Getting your reset ready…" : "Run a mission request"}
          </Button>
        </div>
        {req && (
          <div className="rounded-[var(--radius-soft)] border border-line/70 bg-surface p-4 text-small" data-testid="gemma-input">
            <p className="text-micro font-semibold tracking-[0.12em] text-muted uppercase">Input</p>
            <p className="mt-1 text-ink">
              Feeling: {EMOTION_LABEL[req.emotion]} · {req.timeOfDay} · up to {req.minutes} min · outside: {req.canGoOutside === "yes" ? "yes" : "no"}
            </p>
            {req.signals.length ? (
              <ul className="mt-2 space-y-1">
                {req.signals.map((id) => (
                  <li key={id} className="text-ink-2">
                    <code className="rounded bg-surface-sunk px-1.5 py-0.5 text-micro">{id}</code> {signalText(id)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ink-2">
                No history yet, so nothing to personalize from. Turn on Demo mode in Privacy & AI to load clearly labelled sample resets.
              </p>
            )}
          </div>
        )}
        {out && (
          <div className="rounded-[var(--radius-soft)] border border-accent/40 bg-accent-soft/40 p-4 text-small" data-testid="gemma-output">
            <p className="text-micro font-semibold tracking-[0.12em] text-muted uppercase">
              Output · {statusLabel(out.source === "library" ? "fallback" : out.source)}
            </p>
            <p className="mt-1 font-display text-h3 text-ink">{out.title}</p>
            <p className="text-ink">{out.instruction}</p>
            {out.secondaryInstruction && <p className="text-ink-2">{out.secondaryInstruction}</p>}
            <p className="mt-2 text-ink">
              <strong className="font-semibold">Why this reset?</strong> {out.reason ?? "No history to draw on yet."}
            </p>
          </div>
        )}
      </Block>

      <Block title="AI mode">
        <p className="text-small text-ink-2">
          Right now: <strong className="font-semibold text-ink">{status.label}</strong>. Change it in Privacy & AI.
        </p>
        <ul className="space-y-2">
          {MODES.map(([label, name, body]) => (
            <li
              key={label}
              className={`rounded-[var(--radius-soft)] border p-4 ${status.label === label ? "border-accent bg-accent-soft/30" : "border-line/70 bg-surface"}`}
            >
              <p className="text-small font-semibold text-ink">
                {name} {status.label === label && <span className="text-micro text-accent-strong">· active</span>}
              </p>
              <p className="text-small text-ink-2">{body}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="How it fits together">
        <pre
          tabIndex={0}
          aria-label="How MERA fits together"
          className="overflow-x-auto rounded-[var(--radius-soft)] border border-line/70 bg-surface p-4 text-micro leading-relaxed text-ink-2"
        >{`GROUND ME → grounding (quick or full)
         → feeling (one tap)
         → mission request: feeling + settings + signal ids
              ├─ Local Gemma (in this browser)
              ├─ Connected Gemma (opt-in, server)
              └─ Library (offline, always there)
         → schema check → safety check → reason check
              (fail → one repair → library)
         → "Now put me away." → phone-down timer
         → Welcome back → reflection → time back in the world`}</pre>
      </Block>

      <Block title="Where MERA runs">
        <p>
          MERA is deployed on <strong className="font-semibold">Render</strong> as a Node web service from its Blueprint (<code>render.yaml</code>): the app,
          the offline service worker and the small API, with a health check and auto-deploy from GitHub. A mirror on Cloudflare Workers runs Connected Gemma on
          Workers AI. Both use the same code. Local Gemma and the offline library work on either.
        </p>
      </Block>

      <Block title="What MERA is not">
        <p>
          MERA is a grounding and wellness tool. It isn’t therapy, a diagnosis, a treatment, or a crisis service, and it doesn’t replace professional care. If
          you’re in danger or thinking about harming yourself, contact local emergency services or a crisis line where you live.
        </p>
      </Block>

      <p className="mt-12 text-center font-display text-h3 text-ink-2 italic">MERA is designed to help you leave MERA.</p>
    </Page>
  );
}
