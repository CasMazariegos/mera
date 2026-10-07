/** Which intelligence MERA would use right now, in plain words (no scary jargon). */
import { useEffect, useState } from "react";
import { useLocalModel } from "@/ai/local/manager";
import { useSettings } from "@/store/settings";

export type AiStatus = { label: "LOCAL AI" | "CONNECTED AI" | "OFFLINE RESET"; detail: string };

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useAiStatus(): AiStatus {
  const mode = useSettings((s) => s.aiMode);
  const local = useLocalModel();
  const online = useOnline();
  if (mode === "local" && (local.kind === "ready" || local.kind === "busy"))
    return { label: "LOCAL AI", detail: "Local Gemma: mission personalization runs on this device." };
  if (mode === "remote" && online)
    return { label: "CONNECTED AI", detail: "Connected Gemma: mission personalization uses MERA’s configured AI service (opt-in)." };
  if (mode === "local" && local.kind === "loading")
    return { label: "OFFLINE RESET", detail: "Local Gemma is getting ready. Until then, MERA uses its built-in grounding mission library." };
  return { label: "OFFLINE RESET", detail: "Offline reset: MERA is using its built-in grounding mission library. Works without internet." };
}
