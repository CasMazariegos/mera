import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Demo mode (short timers) + library missions, so the run is quick and deterministic.
  await page.evaluate(() =>
    localStorage.setItem(
      "mera.settings",
      JSON.stringify({ state: { demo: true, aiMode: "off", canGoOutside: "yes", usualMinutes: 5, sound: false, haptics: false, onboarded: true }, version: 1 }),
    ),
  );
  await page.reload();
});

test("HOME → GROUND ME → reset → mission → phone down → return → reflection → complete", async ({ page }) => {
  await page.getByRole("button", { name: "GROUND ME" }).click();
  await expect(page.getByRole("heading", { name: "I’m here." })).toBeVisible();
  await page.getByTestId("start-reset").click();
  await expect(page.getByRole("heading", { name: "Put both feet on the ground." })).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("breath-phase")).toHaveText(/Breathe in|Hold|Breathe out/);
  // After one breath MERA offers to step away; doing nothing keeps grounding (demo: two breaths, 24 s).
  await expect(page.getByTestId("step-away")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Notice five things you can see/ })).toBeVisible({ timeout: 45_000 });
  for (const cta of ["I see them", "I feel them", "I hear them", "Done", "I have one"]) await page.getByRole("button", { name: cta }).click();
  await page.getByTestId("emotion-overwhelmed").click();
  await expect(page.getByTestId("mission-title")).toBeVisible();
  await expect(page.getByTestId("mission-source")).toContainText("reset library");
  await page.getByTestId("im-going").click();
  await expect(page.getByText("Now put me away.")).toBeVisible();
  await expect(page.getByTestId("countdown")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("end-early").click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await page.getByTestId("outcome-better").click();
  await page.getByTestId("type-note").click();
  await page.getByTestId("note-text").fill("The cold air helped.");
  await page.getByTestId("save-note").click();
  await expect(page.getByTestId("recap")).toContainText("Overwhelmed");
  await expect(page.getByTestId("recap")).toContainText("Better");
  await expect(page.getByTestId("back-in-world")).toContainText("back in the world");
  await expect(page.getByTestId("insight")).toBeVisible();
  await expect(page.getByText("Go live your life.")).toBeVisible();
  await page.getByTestId("done").click();
  await expect(page.getByRole("button", { name: "GROUND ME" })).toBeVisible();

  // The note is in the journal, on this device.
  await page.goto("/#/journal");
  await expect(page.getByText("The cold air helped.")).toBeVisible();
});

test("quick path: one breath, then 'I'm ready to step away' reaches a personalized mission fast", async ({ page }) => {
  // Clearly labelled sample history (two walks that helped, with notes), as a judge would set it up.
  await page.goto("/#/settings");
  await page.getByTestId("judge-demo").click();
  await expect(page.getByRole("button", { name: "GROUND ME" })).toBeVisible();
  const t0 = Date.now();
  await page.getByRole("button", { name: "GROUND ME" }).click();
  await page.getByTestId("start-reset").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("step-away").click({ timeout: 15_000 });
  await page.getByTestId("emotion-overstimulated").click();
  await expect(page.getByTestId("mission-title")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(90_000);
  // "Why this reset?" is closed until asked, then shows the person's own history behind it.
  await expect(page.getByTestId("why-reason")).toBeHidden();
  await page.getByText("Why this reset?").click();
  await expect(page.getByTestId("why-reason")).toContainText("helped");
  await expect(page.getByTestId("why-this-reset")).toContainText("Nothing left this device.");
});

test("after 'Worse': no fake positivity, and a different reset is one tap away", async ({ page }) => {
  await page.getByRole("button", { name: "GROUND ME" }).click();
  await page.getByTestId("start-reset").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("step-away").click({ timeout: 15_000 });
  await page.getByTestId("emotion-anxious").click();
  const first = await page.getByTestId("mission-title").textContent();
  await page.getByTestId("im-going").click();
  await page.getByTestId("end-early").click({ timeout: 10_000 });
  await page.getByTestId("outcome-worse").click();
  await expect(page.getByRole("heading", { name: "Thanks for checking back in." })).toBeVisible();
  await page.getByTestId("try-another").click();
  await expect(page.getByTestId("mission-title")).toBeVisible();
  expect(await page.getByTestId("mission-title").textContent()).not.toBe(first);
});

test("phone-down survives a refresh (timer from timestamps)", async ({ page }) => {
  await page.goto("/#/daily");
  await page.getByTestId("daily-go").click();
  await page.getByTestId("im-going").click();
  await expect(page.getByTestId("countdown")).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expect(page.getByText("Now put me away.")).toBeHidden();
  await page.getByTestId("end-early").click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});

test("timer ends while the screen is off: MERA waits, and that time counts as time away", async ({ page }) => {
  await page.goto("/#/daily");
  await page.getByTestId("daily-go").click();
  await page.getByTestId("im-going").click();
  await expect(page.getByTestId("countdown")).toBeVisible({ timeout: 10_000 });
  // Screen off: the page reports itself hidden.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(36_000); // demo timer is 30 s; it ends while "away"
  await expect(page.getByTestId("phone-down")).toBeVisible();
  // Coming back to the screen.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  const away = await page.evaluate(() => JSON.parse(localStorage.getItem("mera.flow") ?? "{}").state.flow.phoneDownSeconds);
  expect(away).toBeGreaterThanOrEqual(35);
});

test("works offline once loaded (app shell + reset library)", async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "GROUND ME" }).click();
  await page.getByTestId("start-reset").click();
  await page.getByTestId("continue").click();
  await page.getByRole("button", { name: "Skip breathing" }).click();
  for (let i = 0; i < 5; i++) await page.getByTestId("sense-done").click();
  await page.getByTestId("emotion-scattered").click();
  await expect(page.getByTestId("mission-title")).toBeVisible();
  await context.setOffline(false);
});

test("privacy controls: delete all data", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByTestId("delete-all").click();
  await page.getByTestId("delete-all-confirm").click();
  await expect(page.getByText("All MERA data on this device was deleted.")).toBeVisible();
});

test.describe("first visit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("welcome explains MERA, then get started sets preferences and lands on Home", async ({ page }) => {
    await expect(page.getByTestId("welcome")).toBeVisible();
    await expect(page.getByRole("heading", { name: /How a reset works|About five minutes/ })).toBeVisible();
    await page.getByTestId("get-started").click();
    await page.getByTestId("option-indoor_only").click();
    await page.getByTestId("option-2").click();
    await page.getByTestId("option-off").click();
    await expect(page.getByRole("heading", { name: "You’re all set." })).toBeVisible();
    await page.getByTestId("finish-setup").click();
    await expect(page.getByRole("heading", { level: 1, name: "Come back to yourself." })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mera.settings") ?? "{}").state);
    expect(saved).toMatchObject({ onboarded: true, canGoOutside: "indoor_only", usualMinutes: 2, aiMode: "off" });
  });

  test("GROUND ME is still one tap away on the welcome page", async ({ page }) => {
    await page.getByRole("button", { name: "I need it right now" }).click();
    await expect(page.getByRole("heading", { name: "I’m here." })).toBeVisible();
  });
});
