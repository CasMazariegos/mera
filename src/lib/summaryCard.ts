/**
 * An optional, private "proof of touching grass" image: mission title and time
 * back in the world. Never includes notes, feelings or photos. Saved to the
 * device; MERA doesn't upload or share it.
 */
export async function downloadSummaryCard(input: { missionTitle: string; seconds: number; date: Date }): Promise<void> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return;
  if (document.fonts?.ready) await document.fonts.ready;

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#d6e4ea");
  sky.addColorStop(0.55, "#f3ecdc");
  sky.addColorStop(1, "#f5efe4");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.78, H * 0.16, 10, W * 0.78, H * 0.16, 420);
  sun.addColorStop(0, "rgba(255,226,170,0.85)");
  sun.addColorStop(1, "rgba(255,226,170,0)");
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);

  // Hills
  const hill = (y: number, color: string, amp: number) => {
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(W * 0.3, y - amp, W * 0.6, y + amp * 0.6, W, y - amp * 0.4);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  hill(H - 330, "#c9d4bb", 60);
  hill(H - 250, "#a9bb95", 50);
  hill(H - 170, "#869e70", 40);

  const serif = '"Fraunces Variable", Georgia, serif';
  const sans = '"Figtree Variable", system-ui, sans-serif';
  g.fillStyle = "#26301f";
  g.textAlign = "center";
  g.font = `600 44px ${serif}`;
  g.letterSpacing = "18px";
  g.fillText("MERA", W / 2, 150);
  g.letterSpacing = "0px";

  const minutes = input.seconds >= 60 ? Math.round(input.seconds / 60) : input.seconds;
  const unit = input.seconds >= 60 ? (minutes === 1 ? "minute" : "minutes") : input.seconds === 1 ? "second" : "seconds";
  g.font = `400 300px ${serif}`;
  g.fillText(String(minutes), W / 2, 560);
  g.font = `italic 400 72px ${serif}`;
  g.fillStyle = "#3f5a33";
  g.fillText(`${unit} back in the world`, W / 2, 660);

  g.fillStyle = "#4a5246";
  g.font = `500 40px ${sans}`;
  g.fillText(input.missionTitle, W / 2, 780);
  g.font = `400 32px ${sans}`;
  g.fillText(input.date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), W / 2, 836);

  g.fillStyle = "#f6f2e8";
  g.font = `italic 400 46px ${serif}`;
  g.fillText("Come back to yourself.", W / 2, H - 80);

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mera-reset-${input.date.toISOString().slice(0, 10)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
