/** Privacy & AI: what runs where, what leaves the device (and when), and full control of your data. */
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Page, Segmented, Toggle } from "@/components/ui";
import { useSettings, type AiMode } from "@/store/settings";
import { disableLocal, enableLocal, expectedDownloadBytes, removeLocalDownload, retryLocal, useLocalModel } from "@/ai/local/manager";
import { LOCAL_MODEL } from "@/ai/local/protocol";
import { deleteAllData, deleteDemoData, deleteJournal, deleteResetHistory, exportAll } from "@/data/db";
import { addSampleHistory } from "@/data/demo";
import { download } from "@/lib/download";
import { navigate } from "@/app/router";
import { useAiStatus } from "@/hooks/useAiStatus";

function LocalModelPanel() {
  const status = useLocalModel();
  const [asking, setAsking] = useState(false);
  const mb = Math.round(expectedDownloadBytes() / 1_000_000);
  let text: string;
  switch (status.kind) {
    case "checking":
      text = "Checking this device…";
      break;
    case "unsupported":
      text = "This browser can’t run the model. MERA uses its reset library instead.";
      break;
    case "incapable":
      text =
        status.reason === "ios"
          ? "iPhone and iPad browsers can’t run this model yet. MERA uses its reset library — or turn on Connected AI."
          : "This device doesn’t have enough memory for the model. MERA uses its reset library instead.";
      break;
    case "off":
      text = status.cached ? "Downloaded, currently off." : `Not downloaded. About ${mb} MB, once.`;
      break;
    case "offline":
      text = "You’re offline, so the model can’t download yet.";
      break;
    case "loading":
      text = status.pct === null ? "Getting ready…" : `Downloading to this device… ${status.pct}%`;
      break;
    case "ready":
    case "busy":
      text = `Ready on this device (${status.device === "webgpu" ? "GPU" : "CPU"}).`;
      break;
    case "error":
      text = "The model couldn’t run here. MERA uses its reset library instead.";
      break;
  }
  return (
    <div className="mt-3 rounded-[var(--radius-soft)] border border-line bg-surface p-5" data-testid="local-model">
      <p className="text-body font-semibold text-ink">{LOCAL_MODEL.label} on this device</p>
      <p className="mt-1 text-small text-ink-2" role="status">
        {text}
      </p>
      {status.kind === "loading" && status.pct !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunk" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${status.pct}%` }} />
        </div>
      )}
      {status.kind === "error" && (
        <details className="mt-2 text-micro text-muted">
          <summary className="min-h-9 cursor-pointer font-semibold">Technical details</summary>
          {status.file && <p>File: {status.file}</p>}
          {status.downloadedBytes !== undefined && <p>Saved before it stopped: {(status.downloadedBytes / 1_000_000).toFixed(1)} MB (resumes next time)</p>}
          {status.detail && <pre className="mt-1 whitespace-pre-wrap break-words">{status.detail}</pre>}
        </details>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {status.kind === "off" &&
          (status.cached || asking ? null : (
            <Button variant="quiet" onClick={() => setAsking(true)} data-testid="local-enable">
              Download the model
            </Button>
          ))}
        {status.kind === "off" && status.cached && (
          <Button variant="quiet" onClick={enableLocal}>
            Turn on
          </Button>
        )}
        {(status.kind === "ready" || status.kind === "busy" || status.kind === "loading") && (
          <Button variant="ghost" onClick={() => void disableLocal()}>
            Turn off
          </Button>
        )}
        {status.kind === "error" && (
          <Button variant="quiet" onClick={retryLocal}>
            Try again
          </Button>
        )}
        {((status.kind === "off" && status.cached) || status.kind === "ready") && (
          <Button variant="ghost" onClick={() => void removeLocalDownload()}>
            Remove download
          </Button>
        )}
      </div>
      {asking && status.kind === "off" && (
        <div className="mt-4 rounded-2xl border border-line-strong p-4" role="region" aria-label="Download consent">
          <p className="text-body font-semibold text-ink">One-time download</p>
          <p className="mt-1 text-small text-ink-2">
            This downloads {LOCAL_MODEL.label} (about {mb} MB) from Hugging Face to this browser, once. After that MERA’s AI works offline, and your check-ins
            and notes are processed here — never sent anywhere. License: {LOCAL_MODEL.license}. Wi-Fi recommended.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => {
                setAsking(false);
                enableLocal();
              }}
              data-testid="local-accept"
            >
              Download
            </Button>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What this deployment offers (from MERA's server; absent on a plain static host). */
function useServerConfig() {
  const [cfg, setCfg] = useState<{ remoteAI: boolean; remoteModel: string | null } | null | "none">(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c) => setCfg(c))
      .catch(() => setCfg("none"));
  }, []);
  return cfg;
}

export function SettingsPage() {
  const s = useSettings();
  const server = useServerConfig();
  const status = useAiStatus();
  const [confirm, setConfirm] = useState<null | "all" | "resets" | "journal">(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Page
      icon={ShieldCheck}
      eyebrow="Settings"
      title="Privacy & AI"
      intro={
        <>
          Right now: <strong className="text-ink">{status.label}</strong> — {status.detail}
        </>
      }
    >
      <section aria-labelledby="ai-h">
        <h2 id="ai-h" className="text-h3 font-semibold text-ink">
          Where MERA’s AI runs
        </h2>
        <Segmented<AiMode>
          name="ai-mode"
          label="Gemma"
          value={s.aiMode}
          onChange={(v) => s.set({ aiMode: v })}
          options={[
            { value: "local", label: "On this device" },
            { value: "remote", label: "Connected AI" },
            { value: "off", label: "Off" },
          ]}
        />
        {s.aiMode === "local" && <LocalModelPanel />}
        {s.aiMode === "remote" && (
          <div className="mt-3 rounded-[var(--radius-soft)] border border-line bg-surface p-5 text-small text-ink-2">
            <p className="text-body font-semibold text-ink">Connected AI is opt-in</p>
            {server !== null && (server === "none" || !server.remoteAI) && (
              <p className="mt-2 rounded-xl bg-sunrise-soft px-3 py-2 text-ink" role="status">
                Connected AI isn’t set up on this server, so MERA will use its reset library.
              </p>
            )}
            {server && server !== "none" && server.remoteAI && <p className="mt-2 text-ink">Model: {server.remoteModel}</p>}
            <p className="mt-1">
              Gemma runs on MERA’s server instead of your device. To choose a reset, MERA sends only: the feeling you tapped, your reset preferences, the time
              of day, and counts of which kinds of resets helped before. Never your location, your journal or your voice notes. MERA’s server doesn’t store or
              log them; the Gemma host it forwards to (set by whoever runs this MERA) processes them under its own terms.
            </p>
            <Toggle
              id="notes-remote"
              label="Also send a note’s text for the after-reset summary"
              hint="Off by default. When off, Connected AI never sees what you write."
              checked={s.allowNotesRemote}
              onChange={(v) => s.set({ allowNotesRemote: v })}
            />
          </div>
        )}
        {s.aiMode === "off" && <p className="mt-3 text-small text-ink-2">MERA uses its built-in reset library. Everything still works, offline.</p>}
        <Toggle
          id="reflection-ai"
          label="AI reflection on my notes"
          hint="Gemma writes 1–2 sentences after a reset. Turn off to use simple built-in wording instead."
          checked={s.aiReflectionAnalysis}
          onChange={(v) => s.set({ aiReflectionAnalysis: v })}
        />
      </section>

      <section aria-labelledby="prefs-h" className="mt-10 border-t border-line pt-6">
        <h2 id="prefs-h" className="text-h3 font-semibold text-ink">
          Your resets
        </h2>
        <Segmented
          name="outside"
          label="Going outside"
          value={s.canGoOutside}
          onChange={(v) => s.set({ canGoOutside: v })}
          options={[
            { value: "ask_each_time", label: "Ask each time" },
            { value: "yes", label: "Usually fine" },
            { value: "indoor_only", label: "Indoors only" },
          ]}
        />
        <Segmented
          name="minutes"
          label="Time I usually have"
          value={String(s.usualMinutes)}
          onChange={(v) => s.set({ usualMinutes: Number(v) })}
          options={["3", "5", "8", "10"].map((m) => ({ value: m, label: `${m} min` }))}
        />
        <Toggle
          id="low-mobility"
          label="Gentle, low-mobility resets"
          hint="No walking or standing exercises."
          checked={s.lowMobility}
          onChange={(v) => s.set({ lowMobility: v })}
        />
        <Toggle id="avoid-sound" label="Skip listening-based steps" checked={s.avoidSound} onChange={(v) => s.set({ avoidSound: v })} />
        <Toggle id="avoid-smell" label="Skip smell-based steps" checked={s.avoidSmell} onChange={(v) => s.set({ avoidSmell: v })} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="quiet"
            onClick={() => {
              s.set({ personalizationSince: Date.now() });
              setMsg("Personalization reset. New missions won’t draw on resets or notes from before now. Your history is still here.");
            }}
            data-testid="reset-personalization"
          >
            Reset personalization
          </Button>
          <Button variant="ghost" onClick={() => (s.resetPersonalization(), setMsg("Reset preferences restored to defaults."))}>
            Restore default preferences
          </Button>
        </div>
        {s.personalizationSince && (
          <p className="mt-2 text-small text-ink-2">
            Personalizing from {new Date(s.personalizationSince).toLocaleDateString()} onward.{" "}
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => s.set({ personalizationSince: null })}>
              Use all history again
            </button>
          </p>
        )}
      </section>

      <section aria-labelledby="comfort-h" className="mt-10 border-t border-line pt-6">
        <h2 id="comfort-h" className="text-h3 font-semibold text-ink">
          Comfort
        </h2>
        <Segmented
          name="theme"
          label="Appearance"
          value={s.theme}
          onChange={(v) => s.set({ theme: v })}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <Segmented
          name="text"
          label="Text size"
          value={s.textSize}
          onChange={(v) => s.set({ textSize: v })}
          options={[
            { value: "normal", label: "Default" },
            { value: "large", label: "Large" },
            { value: "larger", label: "Larger" },
          ]}
        />
        <Toggle id="contrast" label="Higher contrast" checked={s.contrast === "more"} onChange={(v) => s.set({ contrast: v ? "more" : "normal" })} />
        <Toggle
          id="motion"
          label="Reduce motion"
          hint="MERA stays still; breathing is guided by words and numbers."
          checked={s.reducedMotion === "reduce"}
          onChange={(v) => s.set({ reducedMotion: v ? "reduce" : "system" })}
        />
        <Toggle
          id="sound"
          label="Gentle sounds"
          hint="Soft tones for breathing and when the timer ends. Always shown as text too."
          checked={s.sound}
          onChange={(v) => s.set({ sound: v })}
        />
        <Toggle
          id="haptics"
          label="Haptics"
          hint="Light vibration where your device supports it."
          checked={s.haptics}
          onChange={(v) => s.set({ haptics: v })}
        />
      </section>

      <section aria-labelledby="data-h" className="mt-10 border-t border-line pt-6">
        <h2 id="data-h" className="text-h3 font-semibold text-ink">
          Your data
        </h2>
        <p className="mt-1 text-small text-ink-2">
          Resets, check-ins and journal entries are stored only in this browser. No account, no analytics, nothing sold.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="quiet" onClick={() => void exportAll().then((b) => download(b, `mera-export-${new Date().toISOString().slice(0, 10)}.json`))}>
            Export everything
          </Button>
          <Button variant="ghost" onClick={() => setConfirm("resets")} data-testid="delete-resets">
            Delete reset history
          </Button>
          <Button variant="ghost" onClick={() => setConfirm("journal")} data-testid="delete-journal">
            Delete journal
          </Button>
          <Button variant="ghost" onClick={() => setConfirm("all")} data-testid="delete-all">
            Delete all data
          </Button>
        </div>
        {confirm && (
          <div role="alertdialog" aria-labelledby="confirm-h" className="mt-4 rounded-[var(--radius-soft)] border border-warning/50 bg-surface p-4">
            <p id="confirm-h" className="text-body font-semibold text-ink">
              {confirm === "all"
                ? "Delete every reset, note, voice note, photo and check-in on this device?"
                : confirm === "resets"
                  ? "Delete your reset history? Patterns and personalization start over."
                  : "Delete all journal notes, voice notes and photos?"}
            </p>
            <p className="mt-1 text-small text-ink-2">This can’t be undone. Export first if you want a copy.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="quiet"
                className="border-warning text-warning"
                onClick={async () => {
                  const which = confirm;
                  if (which === "all") await deleteAllData();
                  else if (which === "resets") await deleteResetHistory();
                  else await deleteJournal();
                  setConfirm(null);
                  setMsg(which === "all" ? "All MERA data on this device was deleted." : which === "resets" ? "Reset history deleted." : "Journal deleted.");
                }}
                data-testid="delete-all-confirm"
              >
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="demo-h" className="mt-10 border-t border-line pt-6">
        <h2 id="demo-h" className="text-h3 font-semibold text-ink">
          Demo mode
        </h2>
        <Toggle
          id="demo"
          label="Demo mode"
          hint="Shorter timers (30-second phone-down, and the step-away choice after one breath) for presentations. The AI and everything else is real."
          checked={s.demo}
          onChange={(v) => s.set({ demo: v })}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              void addSampleHistory().then(() => {
                s.set({ demo: true, onboarded: true, personalizationSince: null });
                navigate("/");
              })
            }
            data-testid="judge-demo"
          >
            Set up judge demo
          </Button>
          <Button
            variant="quiet"
            onClick={() => void addSampleHistory().then((n) => setMsg(`Added ${n} sample resets and 2 sample notes (labelled “sample”).`))}
          >
            Add sample history
          </Button>
          <Button variant="ghost" onClick={() => void deleteDemoData().then(() => setMsg("Sample history removed."))}>
            Remove sample history
          </Button>
        </div>
      </section>

      <p className="mt-8 text-small text-ink-2" role="status" aria-live="polite">
        {msg}
      </p>
    </Page>
  );
}
