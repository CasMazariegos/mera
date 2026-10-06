/** Welcome + get started, light and dark (browser simulation at phone size). */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4173";
const out = "docs/screenshots";
const browser = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${scheme}-00-welcome.png` });
  // Reveal scroll-triggered sections, then capture the whole page.
  for (let y = 0; y < 9000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${scheme}-00-welcome-full.png`, fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId("get-started").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${scheme}-00-setup-1.png` });
  await page.getByTestId("option-yes").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${scheme}-00-setup-2.png` });
  await page.getByTestId("option-5").click();
  await page.getByTestId("option-local").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${scheme}-00-setup-ready.png` });
  await page.getByTestId("finish-setup").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${scheme}-01-home-full.png`, fullPage: true });
  console.log(scheme);
}
await browser.close();
