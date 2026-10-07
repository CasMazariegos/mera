/**
 * Visual evidence (browser simulation, not a phone test). Walks the real GROUND ME
 * flow in demo mode and captures each scene at phone size, light and dark.
 *   npm run build && npx vite preview --port 4173 &
 *   npx tsx scripts/screenshots.ts [baseUrl]
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4173";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
}

const browser = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.setItem(
      "mera.settings",
      JSON.stringify({
        state: { demo: true, aiMode: "off", canGoOutside: "ask_each_time", usualMinutes: 5, sound: false, haptics: false, onboarded: true },
        version: 1,
      }),
    );
  });
  await page.reload();
  // Clearly labelled sample history, so personalization ("Why this reset?") is visible.
  await page.goto(`${base}/#/settings`);
  await page.getByTestId("judge-demo").click();
  await page.getByTestId("ground-me").waitFor();
  await shot(page, `${scheme}-01-home`);
  await page.getByTestId("ground-me").click();
  await shot(page, `${scheme}-02-intro`);
  await page.getByTestId("start-reset").click();
  await shot(page, `${scheme}-03-body`);
  await page.getByTestId("continue").click();
  await page.getByTestId("step-away").waitFor({ timeout: 20_000 });
  await shot(page, `${scheme}-04-breathing`);
  await page.getByTestId("keep-grounding").click();
  await page.getByRole("button", { name: "Skip breathing" }).click();
  await shot(page, `${scheme}-05-sense5`);
  for (let i = 0; i < 5; i++)
    await page
      .getByTestId("sense-done")
      .click({ timeout: 5000 })
      .catch(() => {});
  await shot(page, `${scheme}-06-emotion`);
  await page.getByTestId("emotion-overwhelmed").click();
  await page.getByTestId("outside-yes").click();
  await page.getByTestId("mission-title").waitFor();
  await page.getByText("Why this reset?").click();
  await shot(page, `${scheme}-07-mission`);
  await page.getByTestId("im-going").click();
  await page.waitForTimeout(1500);
  await shot(page, `${scheme}-08-put-me-away`);
  await page.waitForTimeout(5000);
  await shot(page, `${scheme}-09-phone-down`);
  await page.getByTestId("end-early").click();
  await shot(page, `${scheme}-10-return`);
  await page.getByTestId("outcome-better").click();
  await shot(page, `${scheme}-11-reflection`);
  await page.getByTestId("skip-note").click();
  await page.getByTestId("recap").waitFor();
  await shot(page, `${scheme}-12-complete`);
  await page.getByTestId("done").click();
  await page.goto(`${base}/#/patterns`);
  await shot(page, `${scheme}-14-patterns`);
  await page.goto(`${base}/#/settings`);
  await shot(page, `${scheme}-13-privacy`);
  await ctx.close();
}
await browser.close();
