/**
 * Hero GIF for the DEV post: the real GROUND ME flow on the live site (judge demo,
 * Connected Gemma), each scene captioned beside a phone.
 *   npx tsx scripts/press-gif.ts [baseUrl] [gifencDir]
 * gifencDir: a folder with `gifenc` and `pngjs` installed (kept out of the app's dependencies).
 */
import { chromium, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "https://mera.casmazariegos.workers.dev";
const req = createRequire(`${process.argv[3]}/package.json`);
const { GIFEncoder, quantize, applyPalette } = req("gifenc");
const { PNG } = req("pngjs");

type Frame = { png: Buffer; caption: string; sub: string; ms: number };
const frames: Frame[] = [];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, reducedMotion: "no-preference" })).newPage();

async function grab(caption: string, sub: string, ms: number, settle = 900) {
  await page.waitForTimeout(settle);
  frames.push({ png: await page.screenshot(), caption, sub, ms });
}

await page.goto(base);
await page.evaluate(() =>
  localStorage.setItem(
    "mera.settings",
    JSON.stringify({ state: { demo: true, aiMode: "off", canGoOutside: "yes", usualMinutes: 5, sound: false, haptics: false, onboarded: true }, version: 1 }),
  ),
);
await page.reload();
await page.goto(`${base}/#/settings`);
await page
  .getByText("Model:")
  .waitFor({ timeout: 15_000 })
  .catch(() => {});
await page.getByTestId("judge-demo").click();
await page.getByTestId("ground-me").waitFor();
await grab("One button.", "For when everything feels like too much.", 2200, 1500);
await page.getByTestId("ground-me").click();
await page.getByTestId("start-reset").click();
await grab("“I’m here.”", "Both feet on the ground first.", 1800);
await page.getByTestId("continue").click();
// One full breath, sampled (in 4, hold 2, out 6), played back a little faster.
for (let i = 0; i < 8; i++) await grab("Breathe together.", "In 4, hold 2, out 6. One breath is enough.", 650, 1500);
await page.getByTestId("step-away").waitFor({ timeout: 20_000 });
await grab("Then it lets you go.", "“I’m ready to step away” after a single breath.", 1800, 300);
await page.getByTestId("step-away").click();
await grab("One tap.", "What feels closest right now?", 1600);
await page.getByTestId("emotion-overstimulated").click();
await page
  .getByTestId("outside-yes")
  .click({ timeout: 3000 })
  .catch(() => {});
await page.getByTestId("mission-title").waitFor({ timeout: 30_000 });
const source = await page.getByTestId("mission-source").textContent();
console.log("mission:", await page.getByTestId("mission-title").textContent(), "|", source);
await page.getByText("Why this reset?").click();
await grab("Gemma picks one small thing.", "Built from what has helped you before, and it shows why.", 3400, 1200);
await page.getByTestId("im-going").click();
await page.getByText("Now put me away.").waitFor();
await grab("Good. Now put me away.", "The whole app is built around this moment.", 1800, 1600);
await page.getByText("Go touch grass.").waitFor();
await grab("Good. Now put me away.", "The whole app is built around this moment.", 2200, 1200);
await page.getByTestId("end-early").waitFor({ timeout: 20_000 });
await grab("Boring on purpose.", "A quiet timer. Nothing to read, nothing to scroll.", 2400, 2500);
await page.getByTestId("end-early").click();
await page.getByTestId("outcome-better").click();
await page.getByTestId("skip-note").click();
await page.getByTestId("recap").waitFor();
await grab("The only number it shows.", "Time back in the world. No streaks, no points.", 3400, 1500);

// Compose: caption on the left, the phone on the right.
const W = 1000;
const H = 562;
const comp = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await comp.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Figtree:wght@500;600&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{width:${W}px;height:${H}px;background:#f5f1e8;font-family:Figtree,sans-serif;display:flex;align-items:center;gap:56px;padding:0 64px;overflow:hidden}
.t{flex:1}.brand{font-family:Fraunces,serif;letter-spacing:.3em;font-size:18px;color:#4b6141;font-weight:500}
h1{font-family:Fraunces,serif;font-weight:500;font-size:46px;line-height:1.08;color:#24271f;margin-top:18px}p{font-size:21px;line-height:1.4;color:#575b50;margin-top:14px}
.ph{width:236px;height:510px;border-radius:34px;padding:8px;background:#24271f;}.ph img{width:100%;height:100%;border-radius:27px;object-fit:cover;object-position:top;display:block}
.dots{display:flex;gap:7px;margin-top:30px}.dots i{width:8px;height:8px;border-radius:9px;background:#c9d4bb}.dots i.on{background:#4b6141;width:22px}</style></head>
<body><div class="t"><div class="brand">MERA</div><h1 id="c"></h1><p id="s"></p><div class="dots" id="d"></div></div><div class="ph"><img id="i"></div></body></html>`);
await comp.evaluate(() => document.fonts.ready);
const scenes = [...new Set(frames.map((f) => f.caption))];

const gif = GIFEncoder();
for (const f of frames) {
  await comp.evaluate(
    ({ src, caption, sub, idx, n }) => {
      (document.getElementById("i") as HTMLImageElement).src = src;
      document.getElementById("c")!.textContent = caption;
      document.getElementById("s")!.textContent = sub;
      document.getElementById("d")!.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k === idx ? "on" : ""}"></i>`).join("");
      return new Promise((r) => ((document.getElementById("i") as HTMLImageElement).onload = r));
    },
    { src: `data:image/png;base64,${f.png.toString("base64")}`, caption: f.caption, sub: f.sub, idx: scenes.indexOf(f.caption), n: scenes.length },
  );
  const shot = await comp.screenshot({ type: "png" });
  if (process.env.DUMP) writeFileSync(`${process.env.DUMP}/frame-${String(frames.indexOf(f)).padStart(2, "0")}.png`, shot);
  const png = PNG.sync.read(shot);
  const palette = quantize(png.data, 256);
  gif.writeFrame(applyPalette(png.data, palette), W, H, { palette, delay: f.ms });
}
gif.finish();
writeFileSync("public/press/hero.gif", gif.bytes());
console.log(`hero.gif: ${frames.length} frames, ${(gif.bytes().length / 1e6).toFixed(2)} MB`);
await browser.close();
