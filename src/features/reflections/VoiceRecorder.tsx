/**
 * Voice reflection: talk instead of looking at the screen. Audio stays on this
 * device; it is not transcribed or analysed (browser speech recognition would
 * send audio to a third party, so MERA doesn't use it).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

const MAX_SECONDS = 90;

export function VoiceRecorder({ onSave, onCancel }: { onSave: (audio: Blob, mime: string, seconds: number) => void; onCancel: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "denied" | "unsupported">(() =>
    typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia ? "unsupported" : "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const started = useRef(0);

  useEffect(
    () => () => {
      rec.current?.stream.getTracks().forEach((t) => t.stop());
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        blob.current = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        setUrl(URL.createObjectURL(blob.current));
        setState("recorded");
      };
      rec.current = r;
      started.current = Date.now();
      r.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  }

  if (state === "unsupported" || state === "denied") {
    return (
      <div className="w-full text-center">
        <p className="text-body text-ink-2">
          {state === "denied"
            ? "The microphone isn’t available. You can type instead, or skip."
            : "Voice notes aren’t supported in this browser. You can type instead, or skip."}
        </p>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {state === "recording" ? (
        <>
          <p className="font-display text-h1 text-ink tabular" aria-live="off">
            {String(Math.floor(seconds / 60)).padStart(1, "0")}:{String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-small text-ink-2" role="status">
            Recording. Take your time — you don’t need to look at the screen.
          </p>
          <Button onClick={() => rec.current?.stop()}>Stop</Button>
        </>
      ) : state === "recorded" && url ? (
        <>
          <audio controls src={url} className="w-full" />
          <div className="flex w-full flex-col gap-3">
            <Button onClick={() => blob.current && onSave(blob.current, blob.current.type, seconds)} data-testid="save-voice">
              Keep this note
            </Button>
            <Button variant="ghost" onClick={() => setState("idle")}>
              Record again
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button onClick={() => void start()}>Start recording</Button>
          <p className="text-small text-muted">Up to 90 seconds. Saved only on this device; not transcribed.</p>
          <Button variant="ghost" onClick={onCancel}>
            Back
          </Button>
        </>
      )}
    </div>
  );
}
