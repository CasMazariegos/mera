/** Real Connected-Gemma mission on the live site, with the judge-demo sample history (for the DEV post). */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://mera.casmazariegos.workers.dev";
const browser = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
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
    .catch(() => {}); // server config loaded
  await page.getByTestId("judge-demo").click();
  await page.getByTestId("ground-me").click();
  await page.getByTestId("start-reset").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("step-away").click({ timeout: 20_000 });
  await page.getByTestId("emotion-overstimulated").click();
  await page
    .getByTestId("outside-yes")
    .click({ timeout: 3000 })
    .catch(() => {});
  await page
    .getByTestId("mission-title")
    .waitFor({ timeout: 30_000 })
    .catch(async (e) => {
      await page.screenshot({ path: "C:/Users/Ellie/AppData/Local/Temp/claude/C--Users-Ellie/152bfc87-970a-4b41-8c07-0df580623af8/scratchpad/stuck.png" });
      throw e;
    });
  console.log(scheme, await page.getByTestId("mission-title").textContent(), "|", await page.getByTestId("mission-source").textContent());
  await page.getByText("Why this reset?").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/screenshots/${scheme}-07-mission-gemma.png` });
}
await browser.close();
