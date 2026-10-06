/**
 * Gentle cues. Every cue is optional, respects the person's sound/haptics
 * settings, and is skipped in quiet mode. Visual text always carries the same
 * information, so nothing depends on hearing or feeling a cue.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A soft sine tone with a slow attack and long release — never a beep. */
export function chime(freq = 432, seconds = 1.6, volume = 0.06) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.05);
}

export function haptic(pattern: number | number[] = 20) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported (e.g. iOS Safari) — the visual cue carries the information
  }
}

export interface CueOptions {
  sound: boolean;
  haptics: boolean;
  quiet: boolean;
}

export const cue = {
  breathPhase(o: CueOptions, phase: "in" | "hold" | "out") {
    if (o.quiet) return;
    if (o.haptics) haptic(phase === "hold" ? 10 : 18);
    if (o.sound) chime(phase === "in" ? 396 : phase === "hold" ? 432 : 352, phase === "out" ? 2.4 : 1.4, 0.04);
  },
  timerDone(o: CueOptions) {
    if (o.quiet) return;
    if (o.haptics) haptic([40, 120, 40]);
    if (o.sound) {
      chime(392, 2.2, 0.07);
      setTimeout(() => chime(523, 2.6, 0.05), 380);
    }
  },
};
