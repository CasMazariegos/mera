/** The app's single MeraAI instance, reading the person's current AI and privacy settings on every call. */
import { useSettings } from "@/store/settings";
import { createMeraAI } from "./mera-ai";

export const meraAI = createMeraAI(() => {
  const s = useSettings.getState();
  return { mode: s.aiMode, reflectionAnalysis: s.aiReflectionAnalysis, allowNotesRemote: s.allowNotesRemote };
});
