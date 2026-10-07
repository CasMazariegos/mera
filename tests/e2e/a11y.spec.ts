import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const settings = (extra = {}) =>
  JSON.stringify({
    state: { demo: true, aiMode: "off", canGoOutside: "yes", usualMinutes: 5, sound: false, haptics: false, onboarded: true, ...extra },
    version: 1,
  });

async function scan(page: Page, label: string) {
  // Let entrance animations settle so contrast is measured on the final colours.
  await page.waitForTimeout(1500);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test("home, welcome and pages", async ({ page }) => {
      await page.goto("/");
      await page.evaluate((s) => localStorage.setItem("mera.settings", s), settings());
      await page.reload();
      await scan(page, "home");
      for (const route of ["welcome", "about", "settings", "patterns", "journal", "daily", "check-in"]) {
        await page.goto(`/#/${route}`);
        await scan(page, route);
      }
    });

    test("reset flow screens", async ({ page }) => {
      await page.goto("/");
      await page.evaluate((s) => localStorage.setItem("mera.settings", s), settings());
      await page.reload();
      await page.getByRole("button", { name: "GROUND ME" }).click();
      await scan(page, "intro");
      await page.getByTestId("start-reset").click();
      await page.getByTestId("continue").click();
      await page.getByTestId("step-away").click({ timeout: 15_000 });
      await scan(page, "emotion");
      await page.getByTestId("emotion-scattered").click();
      await expect(page.getByTestId("mission-title")).toBeVisible();
      await scan(page, "mission");
      await page.getByTestId("im-going").click();
      await expect(page.getByTestId("countdown")).toBeVisible({ timeout: 10_000 });
      await scan(page, "phone-down");
      await page.getByTestId("end-early").click();
      await scan(page, "return");
      await page.getByTestId("outcome-better").click();
      await page.getByTestId("skip-note").click();
      await expect(page.getByTestId("back-in-world")).toBeVisible();
      await scan(page, "complete");
    });
  });
}

test("no horizontal scroll at common phone widths; GROUND ME stays big", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("mera.settings", s), settings());
  for (const width of [320, 360, 375, 390, 414, 430]) {
    await page.setViewportSize({ width, height: 740 });
    for (const route of ["", "#/welcome", "#/about", "#/settings", "#/patterns"]) {
      await page.goto(`/${route}`);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px ${route || "home"}`).toBeLessThanOrEqual(0);
    }
    await page.goto("/");
    const box = await page.getByRole("button", { name: "GROUND ME" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(88);
    expect(box!.width).toBeGreaterThanOrEqual(width - 80);
  }
});
